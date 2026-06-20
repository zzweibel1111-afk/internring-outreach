"use client";
import { useState } from "react";

export default function Upload() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(file: File) {
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    setResult(
      res.ok
        ? `${json.added} new school${json.added === 1 ? "" : "s"} queued for research · ${json.skipped} already in the system (skipped)`
        : json.error ?? "Upload failed."
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-semibold">Upload a Niche export</h1>
      <p className="mt-2 text-sm text-inkSoft">
        Drop in the CSV from Niche.com. Schools already in the system are skipped;
        new ones go straight into the research queue.
      </p>
      <label className="card mt-6 block cursor-pointer border-dashed p-10 text-center hover:border-brass">
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && onSubmit(e.target.files[0])}
        />
        <span className="font-display text-lg">{busy ? "Importing…" : "Choose a CSV file"}</span>
        <span className="label mt-2 block">.csv from Niche.com</span>
      </label>
      {result && <p className="mt-4 text-sm font-medium">{result}</p>}
    </div>
  );
}
