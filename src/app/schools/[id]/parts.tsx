"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TZ = ["Eastern", "Central", "Mountain", "Pacific", "Alaska", "Hawaii"];

export function SchoolActions({ school }: { school: any }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function call(path: string, init?: RequestInit) {
    setBusy(true);
    setErr(null);
    const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok) setErr((await res.json()).error ?? "Something went wrong.");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <label className="label">Time zone</label>
      <select
        value={school.timeZone ?? ""}
        disabled={busy}
        onChange={(e) =>
          call(`/api/schools/${school.id}`, { method: "PATCH", body: JSON.stringify({ timeZone: e.target.value }) })
        }
      >
        <option value="">—</option>
        {TZ.map((t) => <option key={t}>{t}</option>)}
      </select>

      {["RESEARCH_FAILED", "QUEUED"].includes(school.status) && (
        <button className="btn" disabled={busy} onClick={() => call(`/api/schools/${school.id}/research`, { method: "POST" })}>
          {school.status === "RESEARCH_FAILED" ? "Retry research" : "Research now"}
        </button>
      )}
      <button
        className="btn btn-quiet"
        disabled={busy}
        onClick={() => call(`/api/schools/${school.id}/draft`, { method: "POST", body: JSON.stringify({ type: "INITIAL" }) })}
      >
        Create initial draft
      </button>
      <button
        className="btn btn-quiet"
        disabled={busy}
        onClick={() => call(`/api/schools/${school.id}/draft`, { method: "POST", body: JSON.stringify({ type: "FOLLOW_UP" }) })}
      >
        Create follow-up draft
      </button>
      <button
        className={`btn ${school.stopAutomation ? "btn-brass" : "btn-quiet"}`}
        disabled={busy}
        onClick={() =>
          call(`/api/schools/${school.id}`, { method: "PATCH", body: JSON.stringify({ stopAutomation: !school.stopAutomation }) })
        }
      >
        {school.stopAutomation ? "Automation paused — resume" : "Pause automation"}
      </button>
      {err && <span className="text-sm text-alert basis-full">{err}</span>}
    </div>
  );
}

export function ContactRow({ contact }: { contact: any }) {
  const router = useRouter();
  const [c, setC] = useState(contact);
  const [busy, setBusy] = useState(false);

  async function save(action?: "approve" | "reject") {
    setBusy(true);
    await fetch(`/api/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, action }),
    });
    setBusy(false);
    router.refresh();
  }

  const field = (key: string, placeholder: string, cls = "") => (
    <input
      className={`w-full ${cls}`}
      value={c[key] ?? ""}
      placeholder={placeholder}
      onChange={(e) => setC({ ...c, [key]: e.target.value })}
      onBlur={() => save()}
    />
  );

  return (
    <div className="mt-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {field("name", "Name")}
        {field("title", "Title")}
        {field("email", "Email", "font-mono text-xs")}
        <div className="flex gap-2">
          {field("phone", "Phone", "font-mono text-xs")}
          <input
            className="w-20 font-mono text-xs"
            value={c.extension ?? ""}
            placeholder="Ext."
            onChange={(e) => setC({ ...c, extension: e.target.value })}
            onBlur={() => save()}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {c.sourceUrl && (
          <a href={c.sourceUrl} target="_blank" className="underline decoration-brass underline-offset-2 text-wait">
            source page
          </a>
        )}
        {c.confidence != null && <span className="font-mono text-wait">confidence {Math.round(c.confidence * 100)}%</span>}
        {c.status === "PENDING_REVIEW" ? (
          <span className="ml-auto flex gap-2">
            <button className="btn" disabled={busy} onClick={() => save("approve")}>Approve</button>
            <button className="btn btn-danger" disabled={busy} onClick={() => save("reject")}>Reject</button>
          </span>
        ) : (
          <span className={`label ml-auto ${c.status === "APPROVED" ? "text-signal" : "text-alert"}`}>{c.status.toLowerCase()}</span>
        )}
      </div>
    </div>
  );
}
