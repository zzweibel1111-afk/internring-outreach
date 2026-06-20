/**
 * Always-on worker. Run alongside the web app: `npm run worker`
 *  - every 5 min: detect manually-sent drafts + sync inbox replies
 *  - every 2 min: process the research queue (3 schools per pass)
 *  - hourly:      20-day follow-up sweep
 *  - hourly:      full Google Sheet re-render (also happens after changes)
 */
import cron from "node-cron";
import { runSyncCycle, runResearchCycle, runFollowUpCycle } from "../src/lib/jobs";
import { renderSheet } from "../src/lib/sheets";

let busy = { sync: false, research: false };

cron.schedule("*/5 * * * *", async () => {
  if (busy.sync) return;
  busy.sync = true;
  try {
    const r = await runSyncCycle();
    if (r.sent || r.replies) console.log("[sync]", r);
  } catch (e) {
    console.error("[sync]", e);
  } finally {
    busy.sync = false;
  }
});

cron.schedule("*/2 * * * *", async () => {
  if (busy.research) return;
  busy.research = true;
  try {
    const r = await runResearchCycle();
    if (r.researched) console.log("[research]", r);
  } catch (e) {
    console.error("[research]", e);
  } finally {
    busy.research = false;
  }
});

cron.schedule("0 * * * *", async () => {
  try {
    console.log("[follow-ups]", await runFollowUpCycle());
    await renderSheet();
  } catch (e) {
    console.error("[hourly]", e);
  }
});

console.log("Intern Ring worker running. Cycles: sync 5m / research 2m / follow-ups 1h.");
