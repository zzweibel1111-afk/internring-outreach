"use client";
import { useEffect, useState } from "react";

const VARS = ["{{SCHOOL_NAME}}", "{{HEAD_OF_SCHOOL}}", "{{ADVANCEMENT_CONTACT}}", "{{ALUMNI_CONTACT}}"];

export default function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
  }, []);

  async function save(t: any) {
    await fetch("/api/templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: t.key, subject: t.subject, body: t.body }),
    });
    setSaved(t.key);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Your templates</h1>
        <p className="mt-2 text-sm text-inkSoft">
          These are your words — the system only fills in the variables, never rewrites.
          Available variables: <span className="font-mono text-xs">{VARS.join("  ")}</span>
        </p>
      </div>
      {templates.map((t, i) => (
        <div key={t.key} className="card spine p-5 space-y-3">
          <div className="label">{t.name}</div>
          <div>
            <label className="label block mb-1">Subject</label>
            <input
              className="w-full"
              value={t.subject}
              onChange={(e) => {
                const next = [...templates];
                next[i] = { ...t, subject: e.target.value };
                setTemplates(next);
              }}
            />
          </div>
          <div>
            <label className="label block mb-1">Body</label>
            <textarea
              className="w-full font-mono text-xs"
              rows={12}
              value={t.body}
              onChange={(e) => {
                const next = [...templates];
                next[i] = { ...t, body: e.target.value };
                setTemplates(next);
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="btn" onClick={() => save(t)}>Save changes</button>
            {saved === t.key && <span className="text-sm text-signal">Saved</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
