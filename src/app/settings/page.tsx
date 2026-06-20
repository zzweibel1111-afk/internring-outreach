"use client";
import { useEffect, useState } from "react";

export default function Settings() {
  const [s, setS] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setS);
  }, []);

  async function save(next: any) {
    setS(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function trigger(job: string, label: string) {
    setSyncMsg(`Running ${label}…`);
    const res = await fetch(`/api/jobs/${job}`, { method: "POST" });
    const json = await res.json();
    setSyncMsg(res.ok ? `${label} done: ${JSON.stringify(json)}` : `Failed: ${json.error}`);
  }

  if (!s) return <p className="text-sm text-inkSoft">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-display text-3xl font-semibold">Settings</h1>

      <div className="card spine p-5 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium">Review researched contacts before drafting</div>
            <p className="text-sm text-inkSoft mt-1">
              On: every researched school waits in the verification queue for your
              approval. Off: contacts are auto-approved and drafts are created
              immediately. You can flip this any time.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={s.reviewMode === "true"}
            className={`btn shrink-0 ${s.reviewMode === "true" ? "btn-brass" : "btn-quiet"}`}
            onClick={() => save({ ...s, reviewMode: s.reviewMode === "true" ? "false" : "true" })}
          >
            {s.reviewMode === "true" ? "Review on" : "Review off"}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Days before follow-up</div>
            <p className="text-sm text-inkSoft mt-1">No reply after this many days → a follow-up draft appears in Gmail.</p>
          </div>
          <input
            type="number"
            min={1}
            className="w-20 font-mono"
            value={s.followUpDays}
            onChange={(e) => save({ ...s, followUpDays: e.target.value })}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium">Auto-sync Google Sheet</div>
            <p className="text-sm text-inkSoft mt-1">Re-render the Sheet after every change (plus hourly).</p>
          </div>
          <button
            role="switch"
            aria-checked={s.autoSheetSync === "true"}
            className={`btn shrink-0 ${s.autoSheetSync === "true" ? "btn-brass" : "btn-quiet"}`}
            onClick={() => save({ ...s, autoSheetSync: s.autoSheetSync === "true" ? "false" : "true" })}
          >
            {s.autoSheetSync === "true" ? "Syncing" : "Paused"}
          </button>
        </div>
        {saved && <p className="text-sm text-signal">Saved</p>}
      </div>

      <div className="card p-5">
        <div className="font-medium">Run a cycle now</div>
        <p className="text-sm text-inkSoft mt-1">The worker runs these on a schedule; trigger one manually if you don't want to wait.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-quiet" onClick={() => trigger("research", "Research")}>Research queue</button>
          <button className="btn btn-quiet" onClick={() => trigger("sync", "Inbox sync")}>Inbox sync</button>
          <button className="btn btn-quiet" onClick={() => trigger("followups", "Follow-ups")}>Follow-up sweep</button>
          <button className="btn btn-quiet" onClick={() => trigger("sheet", "Sheet render")}>Re-render Sheet</button>
        </div>
        {syncMsg && <p className="mt-3 text-sm font-mono">{syncMsg}</p>}
      </div>
    </div>
  );
}
