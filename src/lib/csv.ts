import Papa from "papaparse";

export interface CsvSchool {
  name: string;
  city?: string;
  state?: string;
  website?: string;
  nicheUrl?: string;
}

// Niche exports vary; match columns loosely by header keywords.
function pick(row: Record<string, string>, ...needles: string[]): string | undefined {
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase();
    if (needles.some((n) => k.includes(n))) {
      const v = (row[key] ?? "").trim();
      if (v) return v;
    }
  }
  return undefined;
}

export function parseNicheCsv(csvText: string): CsvSchool[] {
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const out: CsvSchool[] = [];
  for (const row of data) {
    const name = pick(row, "school name", "name", "school");
    if (!name) continue;
    out.push({
      name,
      city: pick(row, "city", "town"),
      state: pick(row, "state"),
      website: pick(row, "website", "url", "web"),
      nicheUrl: pick(row, "niche"),
    });
  }
  return out;
}

export function normalizedKey(name: string, state?: string | null): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}|${(state ?? "").toLowerCase().trim()}`;
}
