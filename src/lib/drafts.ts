import { prisma } from "./db";
import { createGmailDraft } from "./gmail";
import type { Contact, DraftType } from "@prisma/client";

function firstNameOrFull(name: string): string {
  return name.trim();
}

/**
 * Fills {{VARIABLES}} into Zach's template. The system never rewrites his
 * messaging — it only substitutes values.
 */
export function renderTemplate(
  text: string,
  vars: Record<string, string | undefined>
): string {
  return text.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

function toHtml(body: string): string {
  if (/<\w+[^>]*>/.test(body)) return body; // already HTML
  return body
    .split(/\n/)
    .map((line) => (line.trim() === "" ? "<br>" : `<p>${line}</p>`))
    .join("");
}

function pickApproved(contacts: Contact[], category: string): Contact | undefined {
  return contacts.find((c) => c.category === category && c.status === "APPROVED" && c.email);
}

async function buildVars(schoolId: string) {
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    include: { contacts: true },
  });
  const head = pickApproved(school.contacts, "HEAD_OF_SCHOOL");
  const adv = pickApproved(school.contacts, "ADVANCEMENT");
  const alum = pickApproved(school.contacts, "ALUMNI");
  const vars = {
    SCHOOL_NAME: school.name,
    HEAD_OF_SCHOOL: head ? firstNameOrFull(head.name) : "",
    ADVANCEMENT_CONTACT: adv ? firstNameOrFull(adv.name) : "",
    ALUMNI_CONTACT: alum ? firstNameOrFull(alum.name) : "",
  };
  const to = [head, adv, alum]
    .filter((c): c is Contact => !!c?.email)
    .map((c) => ({ name: c.name, email: c.email! }));
  return { school, vars, to };
}

async function createDraftFromTemplate(
  schoolId: string,
  templateKey: "INITIAL" | "FOLLOW_UP",
  type: DraftType,
  toOverride?: { name: string; email: string }[]
) {
  const tpl = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: templateKey } });
  const { vars, to } = await buildVars(schoolId);
  const recipients = toOverride ?? to;
  if (recipients.length === 0) {
    throw new Error("No approved contacts with email addresses — nothing to draft.");
  }
  const subject = renderTemplate(tpl.subject, vars);
  const bodyHtml = toHtml(renderTemplate(tpl.body, vars));
  const { id } = await createGmailDraft({ subject, bodyHtml, to: recipients });
  return prisma.outreachDraft.create({
    data: {
      schoolId,
      type,
      providerMessageId: id,
      subject,
      recipients: recipients.map((r) => r.email).join(", "),
    },
  });
}

/** One initial draft per school: all three approved contacts in the To field. */
export async function createInitialDraft(schoolId: string) {
  const draft = await createDraftFromTemplate(schoolId, "INITIAL", "INITIAL");
  await prisma.school.update({ where: { id: schoolId }, data: { status: "DRAFT_CREATED" } });
  return draft;
}

export async function createFollowUpDraft(schoolId: string) {
  const draft = await createDraftFromTemplate(schoolId, "FOLLOW_UP", "FOLLOW_UP");
  await prisma.school.update({ where: { id: schoolId }, data: { status: "FOLLOW_UP_NEEDED" } });
  return draft;
}

/** "Please contact Jane Smith" → fresh initial-template draft to Jane only. */
export async function createWrongContactDraft(
  schoolId: string,
  contact: { name: string; email: string }
) {
  return createDraftFromTemplate(schoolId, "INITIAL", "WRONG_CONTACT", [contact]);
}
