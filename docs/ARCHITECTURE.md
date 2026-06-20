# Intern Ring Outreach Engine — Architecture

## 1. System overview

```
                ┌─────────────────────────────────────────────┐
                │              Next.js Web App                │
                │  Dashboard · Schools · Verify queue ·       │
                │  Upload · Templates · Settings              │
                │  (NextAuth: Sign in with Google)            │
                └───────────────┬─────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────────────┐
        │                       │                               │
┌───────▼────────┐    ┌─────────▼─────────┐          ┌──────────▼─────────┐
│   PostgreSQL   │    │  Background Worker │          │   External APIs    │
│ SOURCE OF TRUTH│◄───┤  (node-cron)       ├─────────►│  Gmail API         │
│  schools,      │    │  • research 2 min  │          │  Google Sheets     │
│  contacts,     │    │  • sync 5 min      │          │  Anthropic (AI)    │
│  drafts, msgs  │    │  • follow-ups 1 h  │          │  School websites   │
└───────┬────────┘    └────────────────────┘          └────────────────────┘
        │
┌───────▼────────────────────────────────┐
│  Google Sheet = RENDERED VIEW          │
│  fully regenerated from the DB each    │
│  sync, in the school-section layout    │
└────────────────────────────────────────┘
```

**Core design decisions**

1. **Postgres is the source of truth; the Sheet is a view.** The school-section
   layout (multi-row blocks, blank rows) has no stable row keys, so in-place
   edits would corrupt over time. Instead the whole sheet is regenerated from
   the DB after every change and hourly. Edits belong in the web app, not the
   Sheet.
2. **The system never sends email.** It creates drafts in Gmail Drafts via the
   Gmail API and then *detects* when Zach sends them. Gmail keeps a draft's
   underlying message ID stable when it's sent — we poll that same ID and
   watch its labels (`DRAFT` → `SENT`) to detect a manual send. The code only
   ever calls `drafts.create` / `.get` — never `drafts.send` or
   `messages.send`. (Worth knowing: Gmail's `gmail.compose` OAuth scope
   technically bundles send capability with draft management — there's no
   narrower official scope — so this is a code-level guarantee rather than a
   permission-level one. The system is simply never given the instruction to
   send.)
3. **Review toggle.** With review ON (default), researched contacts wait in a
   verification queue; approving the last pending contact auto-creates the
   draft. With review OFF, contacts are auto-approved and drafts are created
   immediately after research. The same toggle governs Wrong-Contact
   referrals.
4. **Automation halts on judgment calls.** Interested / Demo Scheduled /
   Asked for More Info → status `NEEDS ZACH REVIEW`, `stopAutomation = true`,
   no follow-ups, no AI response drafts. Not Interested also stops automation.
5. **OOO autoreplies are inert.** They set status Out of Office but do not
   count as a reply, do not reset the follow-up clock, and do not overwrite
   AI analysis fields.

## 2. Database schema (Prisma)

See `prisma/schema.prisma`. Key models:

| Model | Purpose |
|---|---|
| `School` | One row per school. `normalizedKey` (name+state) is the CSV dedupe key. Holds status, score, time zone, AI fields, `stopAutomation`. |
| `Contact` | Researched people, one per category (HEAD_OF_SCHOOL / ADVANCEMENT / ALUMNI / OTHER for referrals) with name/title/email/phone/extension, source URL, model confidence, and review status. |
| `EmailTemplate` | Zach's INITIAL and FOLLOW_UP templates with `{{VARIABLES}}`. |
| `OutreachDraft` | One per Gmail draft created: stable Gmail message ID, type, DRAFT/SENT, `conversationId` (threadId) once sent. |
| `InboundMessage` | Every matched inbox message with classification + sentiment; `graphMessageId` unique prevents double-processing. |
| `Setting` | reviewMode, followUpDays, autoSheetSync, plus the inbox delta cursor. |
| NextAuth models | `Account` stores the Graph refresh token used by the worker. |

## 3. State machine

```
QUEUED → RESEARCHING → NEEDS_VERIFICATION → DRAFT_CREATED → CONTACTED
                    ↘ RESEARCH_FAILED (retry → QUEUED)        │
   (review off skips NEEDS_VERIFICATION)                      │ 20 days, no reply
                                                              ▼
            reply classified ◄──────────────────── FOLLOW_UP_NEEDED → CONTACTED (when sent)
                 │
   ┌─────────────┼──────────────────────────────────────────┐
   │ positive (Interested / Demo / More Info)               │
   │   → NEEDS_ZACH_REVIEW, stopAutomation                  │
   │ Replied → REPLIED (score 5)                            │
   │ Wrong Contact → WRONG_CONTACT + referral contact +     │
   │   new initial draft to the referred person             │
   │ Out of Office → OUT_OF_OFFICE (clock not reset)        │
   │ Not Interested → NOT_INTERESTED, stopAutomation        │
   └────────────────────────────────────────────────────────┘
```

Lead scores (spec): Demo 10 · Interested 8 · More Info 6 · Replied 5 ·
OOO 3 · No response 2 · Not Interested 0.

## 4. Research engine (`src/lib/research.ts`)

1. Normalize the website URL from the Niche CSV.
2. Fetch the homepage; rank same-domain links by keywords (directory, staff,
   leadership, advancement, alumni, giving, contact…); fetch the top 6.
   `mailto:` hrefs are surfaced into the text so hidden emails are extracted.
3. Send the page corpus to Claude with a strict "extract only what is present,
   never invent" prompt returning JSON: one best person per category with
   name/title/email/phone/extension/sourceUrl/confidence.
4. Route results by the review toggle. Time zone is derived from the state
   (split states default to the majority zone; manual override in the UI).

**Known limits:** JS-rendered directories and aggressive bot protection will
fail → `RESEARCH_FAILED` with the reason shown and a one-click retry; the
production roadmap adds a headless-browser fallback. The crawler stays on the
school's own domain, identifies itself with a UA string, and touches at most
7 public pages per school.

## 5. Gmail integration

- **OAuth client:** Web application client in Google Cloud Console (the same
  project as Sheets); redirect URI `https://<host>/api/auth/callback/google`;
  scopes `gmail.compose` (draft create/read/update/delete — Google bundles
  send capability into this scope, there's no narrower official option) and
  `gmail.readonly` (inbox monitoring). The code only ever calls
  `drafts.create` / `.get` — never `.send` — so the system structurally never
  sends, by choice of what it's told to do rather than by a withheld
  permission.
- **Auth:** NextAuth Google sign-in (`access_type: offline`, `prompt:
  consent` to guarantee a refresh token on every sign-in) stores it in the
  `Account` row; `src/lib/gmail.ts` builds a fresh authenticated client per
  call using `googleapis`, which handles access-token refresh automatically.
- **Drafts:** `users.drafts.create` with a base64url-encoded RFC 2822 MIME
  message (all three recipients in `To`) → lands in the Drafts folder.
  Returns the underlying *message* ID (not the draft container ID) — that ID
  is what stays stable across the draft → sent transition.
- **Send detection:** poll `users.messages.get` on that same message ID and
  watch `labelIds`; while `DRAFT` is present it's untouched, once it's gone
  the message carries `SENT` — capture `internalDate` as the real send time
  and `threadId` as the conversation key.
- **Inbox monitoring:** Gmail's `users.history.list` (the Gmail equivalent of
  a delta query), cursor (`historyId`) persisted in `Setting`. Five-minute
  polling was chosen over Gmail push notifications (which require a Pub/Sub
  topic and a renewing watch subscription) for v1 — same outcome at this
  volume with far less infrastructure. The production roadmap includes the
  push-notification upgrade. If the stored `historyId` has expired (Gmail
  retains ~1 week of history), the cursor resets to "now" rather than
  failing — a rare gap, not a crash.
- **Reply matching:** `threadId` → `OutreachDraft.conversationId` → school;
  fallback: sender address matched against known contacts.

## 6. Google Sheets integration

Service account (no OAuth dance): create a service account in Google Cloud,
enable the Sheets API, share the spreadsheet with the service-account email as
Editor. `renderSheet()` clears `A:Z` and writes the full layout: per school —
SCHOOL / STATUS / TIME ZONE / SCORE, the three contact blocks
(Name/Title/Email/Phone/Extension), LAST CONTACT DATE, LAST REPLY DATE,
AI SUMMARY, CONCERNS, NEXT STEPS, THREAD SUMMARY, then two blank rows.
Schools are ordered by score (hottest first).

## 7. AI layer (`src/lib/ai.ts`)

Two narrow, JSON-only calls (Claude Sonnet):

- `extractContacts` — pages in, three contacts out, with confidence; hard rule
  against inventing data.
- `analyzeReply` — thread context + new message in; classification (the seven
  spec categories), sentiment, aiSummary, concerns[], nextSteps,
  threadSummary, and `referredContact` extraction for the Wrong-Contact flow.

The AI never writes outreach copy; templates are filled by plain string
substitution (`src/lib/drafts.ts`).

## 8. Compliance posture

Only publicly listed professional contacts on schools' own sites are used; the
crawler respects domain boundaries and low page counts. Because the messages
are commercial, keep a physical mailing address and an opt-out line **in your
templates** (CAN-SPAM), honor any opt-out by setting Not Interested, and spread
sends out rather than bursting. (General information, not legal advice.)

## 9. Deployment plan

**Recommended: Railway (or Render) — one project, three services**

1. **Postgres** — managed addon; copy `DATABASE_URL`.
2. **Web** — this repo; build `npm install && npm run build`, start
   `npm run start`. Set every var from `.env.example`.
3. **Worker** — same repo, second service; start `npm run worker`. Same env.

Steps: provision DB → `npm run db:push && npm run db:seed` → create the Gmail
OAuth client and Google service account → set env vars → deploy → visit
`/login`, sign in with Google → upload first CSV.

If a separate worker isn't possible, point an external cron (e.g.
cron-job.org) at `POST /api/jobs/{research|sync|followups|sheet}` with header
`Authorization: Bearer $CRON_SECRET` (research/sync every 5 min, followups
hourly).

## 10. MVP roadmap (what ships in this codebase)

| Phase | Scope |
|---|---|
| 1. Foundation | Auth (Google sign-in, allow-list), schema, CSV import + dedupe, time zones |
| 2. Research | Crawler + AI extraction, verification queue, review toggle, retry |
| 3. Outreach | Template editor, variable substitution, Gmail draft creation |
| 4. Tracking | Send detection, inbox delta sync, AI classification + analysis, scoring, NEEDS ZACH REVIEW halt, Wrong-Contact flow, 20-day follow-ups |
| 5. Dashboard | Sheet renderer, web dashboard, manual job triggers |

## 11. Production roadmap (next)

1. **Headless-browser research fallback** (Playwright) for JS-rendered
   directories; secondary web-search pass when the site yields nothing.
2. **Gmail push notifications** (Pub/Sub + `users.watch`) to replace polling
   (subscription renews every 7 days; renewal job included).
3. **Observability:** job-run history table, failure alerts to email/Slack,
   Sentry.
4. **Sheet niceties:** batch formatting (bold school names, status colors) via
   `spreadsheets.batchUpdate`.
5. **Throughput:** queue (BullMQ + Redis) once volume passes a few hundred
   schools; per-domain crawl rate limits.
6. **Send pacing assistant:** suggested daily send list by school time zone
   (morning local time), since the spec stores time zones for exactly this.
7. **Multi-user** if anyone joins Intern Ring ops: roles, per-user mailboxes.
