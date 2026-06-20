import { prisma } from "./db";
import { followUpDays } from "./settings";
import { createFollowUpDraft } from "./drafts";

/**
 * 20-day rule (configurable): a school that was CONTACTED, has no reply, and
 * isn't flagged stopAutomation gets a Follow-Up template draft in Gmail.
 * The clock starts at the *actual send time* detected by pollSentDrafts, not
 * at draft creation.
 */
export async function runFollowUps(): Promise<number> {
  const days = await followUpDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const due = await prisma.school.findMany({
    where: {
      status: "CONTACTED",
      stopAutomation: false,
      lastReplyDate: null,
      lastContactDate: { lte: cutoff },
    },
  });
  let created = 0;
  for (const s of due) {
    try {
      await createFollowUpDraft(s.id); // also sets status FOLLOW_UP_NEEDED
      created++;
    } catch (err) {
      console.error(`follow-up draft failed for ${s.name}:`, err);
    }
  }
  return created;
}
