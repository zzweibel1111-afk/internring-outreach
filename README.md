# Intern Ring Outreach Engine

Research private schools, draft personalized outreach in your Gmail (never
auto-sends), track replies with AI, and keep a Google Sheet dashboard in sync.

**The one rule the whole system is built around: it creates drafts; only you hit send.**

## What it does

1. **Upload** a Niche.com CSV → new schools queue for research (existing ones skipped).
2. **Research** each school's website for three contacts — Head of School,
   Advancement/Development, Alumni Relations — plus its time zone.
3. **Verify** (optional, toggle in Settings): researched contacts wait for your
   approval; fix anything, approve, and the draft is created. Turn review off
   and it's fully automatic.
4. **Draft** in Gmail using *your* templates ("Intern Ring Live Demo", all
   three contacts in To). The AI never rewrites your copy — it only fills
   `{{SCHOOL_NAME}}`, `{{HEAD_OF_SCHOOL}}`, `{{ADVANCEMENT_CONTACT}}`, `{{ALUMNI_CONTACT}}`.
5. **Track**: when you send a draft from Gmail, the system notices, starts the
   20-day follow-up clock, and watches the thread. Replies are classified
   (Replied / Interested / Demo Scheduled / Asked for More Info / Wrong Contact /
   Out of Office / Not Interested), summarized, and scored.
6. **Hands off the hot ones**: positive replies flip a school to
   **NEEDS ZACH REVIEW** and stop all automation — no AI replies, ever.
   "Please contact Jane instead" gets Jane added and a fresh initial draft
   created for her.
7. **Google Sheet** dashboard regenerates from the database after every change
   and hourly, in the school-section layout, hottest leads first.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma + PostgreSQL ·
NextAuth (Google sign-in) · Gmail API · Google Sheets API ·
Anthropic API · node-cron worker.

## Setup

### 0. Prereqs
Node 18+, a PostgreSQL database, a Google account (for both Gmail and Sheets),
an Anthropic API key.

### 1. Install
```bash
npm install
cp .env.example .env   # fill in as you go through the steps below
```

### 2. Database
Set `DATABASE_URL`, then:
```bash
npm run db:push   # create tables
npm run db:seed   # default templates + settings
```

### 3. Gmail (Google OAuth client)
Same Google Cloud project you'll use for Sheets in the next step — one project, two credential types.
1. console.cloud.google.com → select (or create) your project.
2. APIs & Services → Library → search **Gmail API** → **Enable**.
3. APIs & Services → OAuth consent screen → **External** → fill in app name
   ("Intern Ring Outreach"), your email as support/developer contact → Save.
   Under **Test users**, add the Gmail address you'll actually sign in with.
   (Staying in "Testing" mode is fine for personal use — no Google review
   needed. You'll see an "unverified app" warning on first sign-in; that's
   expected for your own app — click **Advanced → Go to [app name]**.)
4. APIs & Services → Credentials → **Create Credentials** → **OAuth client ID**
   → Application type **Web application**.
5. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   (add your production URL here too once you have it — see step 6 below).
6. Copy the **Client ID** → `GOOGLE_OAUTH_CLIENT_ID`, **Client secret** →
   `GOOGLE_OAUTH_CLIENT_SECRET`.

### 4. Google Sheet (service account)
1. Same project → IAM & Admin → Service Accounts → **Create service account**.
2. Keys tab → **Add Key** → JSON → download it.
3. From the JSON: `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `private_key` → `GOOGLE_PRIVATE_KEY` (keep the `\n`s).
4. Create a blank Google Sheet, **share it with the service-account email as
   Editor**, and put its ID (the long string in the URL) in `GOOGLE_SHEET_ID`.

### 5. Remaining env
`ANTHROPIC_API_KEY`, `NEXTAUTH_SECRET` (`openssl rand -base64 32`),
`NEXTAUTH_URL`, `ALLOWED_EMAILS` (your email — this is the sign-in allow-list),
`CRON_SECRET` (`openssl rand -hex 24`).

### 6. Run
```bash
npm run dev      # web app at http://localhost:3000
npm run worker   # in a second terminal: the automation loop
```
Sign in at `/login` with your Gmail account, paste your real email copy
into **Templates**, then upload your first CSV.

## Deploying (Railway or Render)

One project, three services, all sharing the same env vars:

| Service | Command |
|---|---|
| Postgres | managed addon → `DATABASE_URL` |
| Web | `npm run build` / `npm run start` |
| Worker | `npm run worker` |

After first deploy: `npm run db:push && npm run db:seed` (one-off shell), add
the production redirect URI in Google Cloud Console (Credentials → your OAuth client), set `NEXTAUTH_URL` to the public URL.

No always-on worker? Hit the job endpoints from an external cron instead:
`POST /api/jobs/sync` and `/api/jobs/research` every 5 min,
`/api/jobs/followups` hourly — header `Authorization: Bearer $CRON_SECRET`.

## Day-to-day

- **Dashboard** — pipeline counts and the "Needs you" list (replies waiting on you).
- **Verify** — approve/fix researched contacts (when review mode is on).
- **Schools** — every school, hottest first; click in for contacts, drafts,
  thread analysis, time-zone override, pause/resume automation, retry research.
- **Templates** — your words; edit any time.
- **Settings** — review toggle, follow-up days, Sheet auto-sync, manual job triggers.

## Compliance note

Outreach is commercial email: keep a physical mailing address and a clear
opt-out line in your templates, and treat any opt-out as final (mark Not
Interested — automation stops). General info, not legal advice.

## More

Architecture, state machine, design decisions, and the production roadmap:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
