import { google } from "googleapis";
import { prisma } from "./db";

/**
 * One OAuth client per call, credentialed with the connected account's
 * refresh token. googleapis handles access-token refresh automatically —
 * no manual token-refresh plumbing needed — Gmail
 * client library does it for us).
 */
async function gmailClient() {
  const account = await prisma.account.findFirst({ where: { provider: "google" } });
  if (!account?.refresh_token) {
    throw new Error("No Gmail account connected. Sign in at /login first.");
  }
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: account.refresh_token });
  return google.gmail({ version: "v1", auth });
}

function base64url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64url(input: string): string {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function buildRawMessage(to: { name?: string; email: string }[], subject: string, bodyHtml: string): string {
  const toHeader = to.map((r) => (r.name ? `"${r.name.replace(/"/g, "")}" <${r.email}>` : r.email)).join(", ");
  const mime = [
    `To: ${toHeader}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    bodyHtml,
  ].join("\r\n");
  return base64url(mime);
}

export interface DraftInput {
  subject: string;
  bodyHtml: string;
  to: { name?: string; email: string }[];
}

/**
 * Creates a Gmail draft. Only ever calls drafts.create — never drafts.send or
 * messages.send — so the system structurally never sends, regardless of what
 * the granted OAuth scope technically permits.
 *
 * Returns the underlying message id (not the draft container id) — Gmail
 * keeps this id stable when the draft is later sent, which is what makes
 * send-detection possible by polling the same id.
 */
export async function createGmailDraft(input: DraftInput): Promise<{ id: string }> {
  const gmail = await gmailClient();
  const raw = buildRawMessage(input.to, input.subject, input.bodyHtml);
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });
  const messageId = res.data.message?.id;
  if (!messageId) throw new Error("Gmail did not return a draft message id.");
  return { id: messageId };
}

/**
 * Checks whether a previously created draft has been sent manually from
 * Gmail. Gmail keeps the message id stable across the draft → sent
 * transition, just swapping the DRAFT label for SENT — so we poll the same
 * message id and watch its labels — same idea, Gmail-flavored.
 */
export async function checkDraftSent(
  messageId: string
): Promise<{ sent: boolean; sentAt?: Date; conversationId?: string; deleted?: boolean }> {
  const gmail = await gmailClient();
  try {
    const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "minimal" });
    const labels = res.data.labelIds ?? [];
    if (labels.includes("DRAFT")) return { sent: false };
    return {
      sent: true,
      sentAt: res.data.internalDate ? new Date(Number(res.data.internalDate)) : new Date(),
      conversationId: res.data.threadId ?? undefined,
    };
  } catch (err: any) {
    if (err.code === 404 || err.response?.status === 404) return { sent: false, deleted: true };
    throw err;
  }
}

export interface GmailMessage {
  id: string;
  conversationId: string; // threadId
  subject: string;
  bodyPreview: string;
  from?: { emailAddress: { address: string; name?: string } };
  receivedDateTime: string;
}

function headerVal(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseFrom(raw: string): { address: string; name?: string } {
  const m = raw.match(/^(.*)<(.+)>$/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, "") || undefined, address: m[2].trim() };
  return { address: raw.trim() };
}

/**
 * Pulls new Inbox messages using Gmail's history API (the Gmail equivalent of
 * a delta query). The history cursor is persisted in Settings so each run
 * only sees what arrived since the last run. If the cursor has expired
 * (Gmail only retains ~1 week of history), we reset to "now" and accept the
 * small gap rather than failing.
 */
export async function pullInboxDelta(): Promise<GmailMessage[]> {
  const gmail = await gmailClient();
  const cursor = await prisma.setting.findUnique({ where: { key: "gmailHistoryId" } });

  if (!cursor) {
    const profile = await gmail.users.getProfile({ userId: "me" });
    await prisma.setting.upsert({
      where: { key: "gmailHistoryId" },
      update: { value: String(profile.data.historyId) },
      create: { key: "gmailHistoryId", value: String(profile.data.historyId) },
    });
    return []; // first run just establishes the baseline
  }

  const out: GmailMessage[] = [];
  let pageToken: string | undefined;
  let newHistoryId = cursor.value;

  try {
    do {
      const res = await gmail.users.history.list({
        userId: "me",
        startHistoryId: cursor.value,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
        pageToken,
      });
      for (const h of res.data.history ?? []) {
        for (const added of h.messagesAdded ?? []) {
          const id = added.message?.id;
          if (!id) continue;
          const full = await gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] });
          const headers = full.data.payload?.headers ?? [];
          out.push({
            id,
            conversationId: full.data.threadId ?? id,
            subject: headerVal(headers, "Subject"),
            bodyPreview: full.data.snippet ?? "",
            from: { emailAddress: parseFrom(headerVal(headers, "From")) },
            receivedDateTime: full.data.internalDate
              ? new Date(Number(full.data.internalDate)).toISOString()
              : new Date().toISOString(),
          });
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
      if (res.data.historyId) newHistoryId = res.data.historyId;
    } while (pageToken);
  } catch (err: any) {
    // historyId too old — reset baseline rather than erroring forever.
    if (err.code === 404 || err.response?.status === 404) {
      const profile = await gmail.users.getProfile({ userId: "me" });
      newHistoryId = String(profile.data.historyId);
    } else {
      throw err;
    }
  }

  await prisma.setting.upsert({
    where: { key: "gmailHistoryId" },
    update: { value: newHistoryId },
    create: { key: "gmailHistoryId", value: newHistoryId },
  });
  return out;
}

/** Fetches the full body of one message (history only carries a snippet). */
export async function getMessageBody(id: string): Promise<string> {
  const gmail = await gmailClient();
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });

  function findPart(part: any): string | null {
    if (!part) return null;
    if (part.mimeType === "text/html" && part.body?.data) return decodeBase64url(part.body.data);
    if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64url(part.body.data);
    for (const child of part.parts ?? []) {
      const found = findPart(child);
      if (found) return found;
    }
    return null;
  }

  return findPart(res.data.payload) ?? res.data.snippet ?? "";
}

/** Lightweight thread fetch for thread summaries. */
export async function getConversationMessages(conversationId: string): Promise<GmailMessage[]> {
  const gmail = await gmailClient();
  const res = await gmail.users.threads.get({ userId: "me", id: conversationId, format: "metadata" });
  return (res.data.messages ?? []).map((m) => {
    const headers = m.payload?.headers ?? [];
    return {
      id: m.id!,
      conversationId,
      subject: headerVal(headers, "Subject"),
      bodyPreview: m.snippet ?? "",
      from: { emailAddress: parseFrom(headerVal(headers, "From")) },
      receivedDateTime: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString(),
    };
  });
}

/** The signed-in mailbox address, used to skip our own messages during sync. */
export async function getOwnAddress(): Promise<string> {
  const gmail = await gmailClient();
  const res = await gmail.users.getProfile({ userId: "me" });
  return (res.data.emailAddress ?? "").toLowerCase();
}
