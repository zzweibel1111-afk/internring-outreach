import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

function parseJson<T>(text: string): T {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(clean.slice(start, end + 1)) as T;
}

// ───────────────────────── Contact research ─────────────────────────

export interface ExtractedContact {
  category: "HEAD_OF_SCHOOL" | "ADVANCEMENT" | "ALUMNI";
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  extension: string | null;
  sourceUrl: string | null;
  confidence: number; // 0-1
}

export async function extractContacts(
  schoolName: string,
  pages: { url: string; text: string }[]
): Promise<ExtractedContact[]> {
  const corpus = pages
    .map((p) => `=== PAGE: ${p.url} ===\n${p.text.slice(0, 12000)}`)
    .join("\n\n")
    .slice(0, 90000);

  const prompt = `You are extracting staff contacts for the private school "${schoolName}" from its own website pages below.

Find ONE best person for each of these three categories:
1. HEAD_OF_SCHOOL — Head of School, President, Headmaster, or Principal
2. ADVANCEMENT — Director of Advancement / Development, Chief Advancement Officer, or closest equivalent
3. ALUMNI — Director of Alumni Relations / Engagement / Affairs, or closest equivalent

Rules:
- Use ONLY information present in the pages. Never invent names, emails, or phone numbers.
- If an exact title doesn't exist, pick the closest equivalent and lower the confidence.
- Phone extensions: if a number is written like "555-1234 x204", put "x204" in extension.
- sourceUrl = the page the person appears on.
- confidence: 1.0 = explicit name+title+email on a staff page; below 0.5 = a guess.
- If a category truly has no candidate, omit it.

Respond with ONLY this JSON, no prose:
{"contacts":[{"category":"HEAD_OF_SCHOOL","name":"","title":"","email":null,"phone":null,"extension":null,"sourceUrl":"","confidence":0.0}]}

PAGES:
${corpus}`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.map((b) => ("text" in b ? b.text : "")).join("");
  const parsed = parseJson<{ contacts: ExtractedContact[] }>(text);
  return (parsed.contacts ?? []).filter((c) => c.name && c.category);
}

// ───────────────────────── Reply analysis ─────────────────────────

export const CLASSIFICATIONS = [
  "Replied",
  "Interested",
  "Demo Scheduled",
  "Asked for More Info",
  "Wrong Contact",
  "Out of Office",
  "Not Interested",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export interface ReplyAnalysis {
  classification: Classification;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  aiSummary: string;
  concerns: string[];
  nextSteps: string;
  threadSummary: string;
  referredContact: { name: string; title: string | null; email: string | null; phone: string | null } | null;
}

export async function analyzeReply(input: {
  schoolName: string;
  newMessage: { from: string; body: string };
  thread: { from: string; preview: string; at: string }[];
}): Promise<ReplyAnalysis> {
  const prompt = `You analyze inbound email replies for Intern Ring, a platform connecting private-school students with parents and alumni for internships. Zach sent cold outreach to "${input.schoolName}" and received the reply below.

THREAD SO FAR (oldest first):
${input.thread.map((t) => `[${t.at}] ${t.from}: ${t.preview}`).join("\n") || "(first reply)"}

NEW REPLY from ${input.newMessage.from}:
${input.newMessage.body.slice(0, 8000)}

Classify the NEW REPLY into exactly one of:
"Replied" | "Interested" | "Demo Scheduled" | "Asked for More Info" | "Wrong Contact" | "Out of Office" | "Not Interested"

Guidance:
- "Wrong Contact" = they redirect to someone else ("please contact Jane Smith"). If so, extract that person's details into referredContact (only what's actually stated; nulls otherwise).
- "Out of Office" = an automatic OOO autoreply.
- concerns = objections/questions/requests (e.g. "Wants pricing", "Wants student privacy information"). Empty array if none.
- nextSteps = one short actionable line for Zach (e.g. "Zach should schedule demo", "Follow up in August").
- aiSummary = 1-2 sentence summary of this reply. threadSummary = 2-4 sentence summary of the whole exchange.

Respond with ONLY this JSON, no prose:
{"classification":"","sentiment":"POSITIVE|NEUTRAL|NEGATIVE","aiSummary":"","concerns":[],"nextSteps":"","threadSummary":"","referredContact":null}`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.map((b) => ("text" in b ? b.text : "")).join("");
  const parsed = parseJson<ReplyAnalysis>(text);
  if (!CLASSIFICATIONS.includes(parsed.classification)) parsed.classification = "Replied";
  return parsed;
}
