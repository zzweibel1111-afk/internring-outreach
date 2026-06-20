import { prisma } from "./db";
import {
  checkDraftSent,
  pullInboxDelta,
  getMessageBody,
  getConversationMessages,
  getOwnAddress,
} from "./gmail";
import { analyzeReply } from "./ai";
import { scoreForStatus, statusForClassification, POSITIVE_CLASSIFICATIONS } from "./scoring";
import { createWrongContactDraft } from "./drafts";
import { reviewModeOn } from "./settings";

/**
 * Zach sends drafts manually from Gmail, so the system has to *detect*
 * sends. We poll every draft we created; when its isDraft flag flips, we
 * record the real sentAt (this starts the 20-day follow-up clock) and capture
 * the conversationId used to match future replies.
 */
export async function pollSentDrafts(): Promise<number> {
  const drafts = await prisma.outreachDraft.findMany({ where: { status: "DRAFT" } });
  let sent = 0;
  for (const d of drafts) {
    try {
      const res = await checkDraftSent(d.providerMessageId);
      if (res.deleted) continue; // Zach deleted it in Gmail; leave the record
      if (!res.sent) continue;
      await prisma.outreachDraft.update({
        where: { id: d.id },
        data: { status: "SENT", sentAt: res.sentAt, conversationId: res.conversationId },
      });
      const school = await prisma.school.findUnique({ where: { id: d.schoolId } });
      // Sending an outreach email moves the school to CONTACTED unless a reply
      // already advanced it further.
      const advanceable = ["DRAFT_CREATED", "FOLLOW_UP_NEEDED", "QUEUED", "NEEDS_VERIFICATION"];
      await prisma.school.update({
        where: { id: d.schoolId },
        data: {
          lastContactDate: res.sentAt,
          ...(school && advanceable.includes(school.status) ? { status: "CONTACTED" } : {}),
        },
      });
      sent++;
    } catch (err) {
      console.error(`sent-check failed for draft ${d.id}:`, err);
    }
  }
  return sent;
}

/**
 * Pulls new Inbox messages (delta query), matches them to schools via
 * conversationId (fallback: sender email ↔ known contact), runs AI analysis,
 * and applies the status / score / automation rules from the spec.
 */
export async function syncInbox(): Promise<number> {
  const own = await getOwnAddress();
  const messages = await pullInboxDelta();
  let processed = 0;

  for (const m of messages) {
    try {
      if (!m.from?.emailAddress?.address) continue;
      const fromEmail = m.from.emailAddress.address.toLowerCase();
      if (fromEmail === own) continue;
      const existing = await prisma.inboundMessage.findUnique({
        where: { providerMessageId: m.id },
      });
      if (existing) continue;

      // Match to a school: conversation first, then sender address.
      let schoolId: string | null = null;
      const draft = await prisma.outreachDraft.findFirst({
        where: { conversationId: m.conversationId },
      });
      if (draft) schoolId = draft.schoolId;
      if (!schoolId) {
        const contact = await prisma.contact.findFirst({
          where: { email: { equals: fromEmail, mode: "insensitive" } },
        });
        if (contact) schoolId = contact.schoolId;
      }

      const record = await prisma.inboundMessage.create({
        data: {
          providerMessageId: m.id,
          conversationId: m.conversationId,
          schoolId,
          fromEmail,
          fromName: m.from.emailAddress.name,
          receivedAt: new Date(m.receivedDateTime),
          bodyPreview: m.bodyPreview,
        },
      });
      if (!schoolId) continue; // unrelated mail; ignored

      const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
      const body = (await getMessageBody(m.id)).replace(/<[^>]+>/g, " ").slice(0, 12000);
      const thread = (await getConversationMessages(m.conversationId)).map((t) => ({
        from: t.from?.emailAddress?.address ?? "unknown",
        preview: t.bodyPreview ?? "",
        at: t.receivedDateTime,
      }));

      const analysis = await analyzeReply({
        schoolName: school.name,
        newMessage: { from: fromEmail, body },
        thread,
      });

      const isOOO = analysis.classification === "Out of Office";
      const newStatus = statusForClassification(analysis.classification);
      const positive = POSITIVE_CLASSIFICATIONS.includes(analysis.classification);

      await prisma.inboundMessage.update({
        where: { id: record.id },
        data: {
          classification: analysis.classification,
          sentiment: analysis.sentiment,
          processed: true,
        },
      });

      await prisma.school.update({
        where: { id: schoolId },
        data: {
          // OOO autoreplies don't count as a real reply and don't reset the
          // follow-up clock or overwrite analysis fields.
          ...(isOOO
            ? { status: school.stopAutomation ? school.status : "OUT_OF_OFFICE" }
            : {
                lastReplyDate: new Date(m.receivedDateTime),
                status: positive ? "NEEDS_ZACH_REVIEW" : newStatus,
                aiSummary: analysis.aiSummary,
                concerns: analysis.concerns.join("\n"),
                nextSteps: analysis.nextSteps,
                threadSummary: analysis.threadSummary,
              }),
          score: scoreForStatus(positive ? newStatus : isOOO ? school.status : newStatus),
          // Positive replies and hard nos both stop all automation; Zach
          // personally handles everything from here. No AI response drafts.
          ...(positive || analysis.classification === "Not Interested"
            ? { stopAutomation: true }
            : {}),
        },
      });

      // "Please contact Jane Smith" → record Jane + draft her an initial email.
      if (analysis.classification === "Wrong Contact" && analysis.referredContact?.name) {
        const rc = analysis.referredContact;
        const autoApprove = !(await reviewModeOn());
        const contact = await prisma.contact.create({
          data: {
            schoolId,
            category: "OTHER",
            name: rc.name,
            title: rc.title,
            email: rc.email,
            phone: rc.phone,
            status: rc.email && autoApprove ? "APPROVED" : "PENDING_REVIEW",
          },
        });
        if (rc.email && autoApprove) {
          await createWrongContactDraft(schoolId, { name: rc.name, email: rc.email });
        } else if (rc.email) {
          // review mode: Jane appears in the verification queue; approving her
          // there creates the draft.
          void contact;
        }
      }
      processed++;
    } catch (err) {
      console.error(`inbox message ${m.id} failed:`, err);
    }
  }
  return processed;
}
