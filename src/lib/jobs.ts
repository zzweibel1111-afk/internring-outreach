import { processResearchQueue } from "./research";
import { pollSentDrafts, syncInbox } from "./sync";
import { runFollowUps } from "./followups";
import { renderSheet } from "./sheets";
import { getSetting } from "./settings";

export async function runSyncCycle() {
  const sent = await pollSentDrafts();
  const replies = await syncInbox();
  if ((sent > 0 || replies > 0) && (await getSetting("autoSheetSync", "true")) === "true") {
    await renderSheet();
  }
  return { sent, replies };
}

export async function runResearchCycle() {
  const n = await processResearchQueue(3);
  if (n > 0 && (await getSetting("autoSheetSync", "true")) === "true") await renderSheet();
  return { researched: n };
}

export async function runFollowUpCycle() {
  const n = await runFollowUps();
  if (n > 0) await renderSheet();
  return { followUps: n };
}
