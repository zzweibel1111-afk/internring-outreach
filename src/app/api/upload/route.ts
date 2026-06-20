import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseNicheCsv, normalizedKey } from "@/lib/csv";
import { timeZoneForState } from "@/lib/timezone";
import { requireAuth } from "../_guard";

export async function POST(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Attach a CSV file." }, { status: 400 });

  const rows = parseNicheCsv(await file.text());
  let added = 0, skipped = 0;
  for (const row of rows) {
    const key = normalizedKey(row.name, row.state);
    const exists = await prisma.school.findUnique({ where: { normalizedKey: key } });
    if (exists) { skipped++; continue; } // spec: existing schools are skipped
    await prisma.school.create({
      data: {
        normalizedKey: key,
        name: row.name,
        city: row.city,
        state: row.state,
        website: row.website,
        nicheUrl: row.nicheUrl,
        timeZone: timeZoneForState(row.state),
        status: "QUEUED",
      },
    });
    added++;
  }
  return NextResponse.json({ added, skipped, total: rows.length });
}
