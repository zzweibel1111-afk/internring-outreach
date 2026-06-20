import { google } from "googleapis";
import { prisma } from "./db";
import type { Contact } from "@prisma/client";

function sheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Queued",
  RESEARCHING: "Researching",
  NEEDS_VERIFICATION: "Needs Verification",
  RESEARCH_FAILED: "Research Failed",
  DRAFT_CREATED: "Draft Created",
  CONTACTED: "Contacted",
  FOLLOW_UP_NEEDED: "Follow Up Needed",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  DEMO_SCHEDULED: "Demo Scheduled",
  ASKED_FOR_MORE_INFO: "Asked for More Info",
  WRONG_CONTACT: "Wrong Contact",
  OUT_OF_OFFICE: "Out of Office",
  NOT_INTERESTED: "Not Interested",
  NEEDS_ZACH_REVIEW: "NEEDS ZACH REVIEW",
};

function fmtDate(d?: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function contactBlock(label: string, c?: Contact): string[][] {
  return [
    [label],
    ["Name:", c?.name ?? ""],
    ["Title:", c?.title ?? ""],
    ["Email:", c?.email ?? ""],
    ["Phone:", c?.phone ?? ""],
    ["Extension:", c?.extension ?? ""],
  ];
}

/**
 * The database is the source of truth; the Sheet is a rendered view in the
 * exact section-per-school layout from the spec. We rewrite the whole sheet
 * each sync, so rows can never drift or corrupt.
 */
export async function renderSheet(): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return;

  const schools = await prisma.school.findMany({
    include: { contacts: { where: { status: "APPROVED" } } },
    orderBy: [{ score: "desc" }, { name: "asc" }],
  });

  const rows: string[][] = [
    ["INTERN RING OUTREACH — synced " + new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC"],
    [],
  ];

  for (const s of schools) {
    const byCat = (cat: string) => s.contacts.find((c) => c.category === cat);
    rows.push(
      ["SCHOOL:", s.name],
      ["STATUS:", STATUS_LABEL[s.status] ?? s.status],
      ["TIME ZONE:", s.timeZone ?? ""],
      ["SCORE:", `${s.score}/10`],
      [],
      ...contactBlock("HEAD OF SCHOOL", byCat("HEAD_OF_SCHOOL")),
      [],
      ...contactBlock("ADVANCEMENT / DEVELOPMENT", byCat("ADVANCEMENT")),
      [],
      ...contactBlock("ALUMNI RELATIONS", byCat("ALUMNI")),
      [],
      ["LAST CONTACT DATE:", fmtDate(s.lastContactDate)],
      ["LAST REPLY DATE:", fmtDate(s.lastReplyDate)],
      ["AI SUMMARY:", s.aiSummary ?? ""],
      ["CONCERNS:", s.concerns ?? ""],
      ["NEXT STEPS:", s.nextSteps ?? ""],
      ["THREAD SUMMARY:", s.threadSummary ?? ""],
      [], // two blank rows between schools, per spec
      []
    );
  }

  const sheets = sheetsClient();
  await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: "A:Z" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "A1",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}
