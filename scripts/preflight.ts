/**
 * Preflight check — run after setup, before first real use:
 *   npm run preflight
 *
 * Verifies every integration end-to-end and prints PASS/FAIL per item.
 * Safe to run repeatedly: read-only except one tiny AI ping.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let failures = 0;

function pass(name: string, detail = "") {
  console.log(`  ✔ PASS  ${name}${detail ? " — " + detail : ""}`);
}
function fail(name: string, err: unknown) {
  failures++;
  console.log(`  ✘ FAIL  ${name} — ${err instanceof Error ? err.message : String(err)}`);
}

async function main() {
  console.log("\nIntern Ring Outreach Engine — preflight\n");

  // 1. Env vars
  const required = [
    "DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "ALLOWED_EMAILS",
    "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_SHEET_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY",
    "ANTHROPIC_API_KEY", "CRON_SECRET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length === 0) pass("Environment variables");
  else fail("Environment variables", `missing: ${missing.join(", ")}`);

  // 2. Database + seed
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tpl = await prisma.emailTemplate.count();
    if (tpl >= 2) pass("Database", `connected, ${tpl} templates seeded`);
    else fail("Database", "connected, but templates missing — run: npm run db:seed");
  } catch (e) {
    fail("Database", e);
  }

  // 3. Gmail (needs one sign-in at /login first)
  try {
    const account = await prisma.account.findFirst({ where: { provider: "google" } });
    if (!account?.refresh_token) {
      fail("Gmail", "no account connected yet — start the app and sign in at /login, then rerun");
    } else {
      const { getOwnAddress } = await import("../src/lib/gmail");
      const addr = await getOwnAddress();
      pass("Gmail", `connected as ${addr}`);
    }
  } catch (e) {
    fail("Gmail", e);
  }

  // 4. Google Sheets
  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID! });
    pass("Google Sheets", `can access "${meta.data.properties?.title}"`);
  } catch (e) {
    fail("Google Sheets", e instanceof Error && /403|permission/i.test(e.message)
      ? "no access — share the Sheet with the service-account email as Editor"
      : e);
  }

  // 5. Anthropic
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await client.messages.create({
      model: process.env.ANTHROPIC_MODEL_RESEARCH ?? "claude-sonnet-4-6",
      max_tokens: 5,
      messages: [{ role: "user", content: "ping" }],
    });
    pass("Anthropic API");
  } catch (e) {
    fail("Anthropic API", e);
  }

  console.log(
    failures === 0
      ? "\nAll checks passed. Upload a CSV and you're live.\n"
      : `\n${failures} check${failures === 1 ? "" : "s"} failed — fix the items above and rerun.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
