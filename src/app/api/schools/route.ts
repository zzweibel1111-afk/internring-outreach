import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "../_guard";
import { normalizedKey } from "@/lib/csv";
import { timeZoneForState } from "@/lib/timezone";

export async function GET(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const schools = await prisma.school.findMany({
    include: { contacts: true },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(schools);
}

/** Manual single-school add (no CSV). */
export async function POST(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { name, city, state, website } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required." }, { status: 400 });
  const key = normalizedKey(name, state);
  const exists = await prisma.school.findUnique({ where: { normalizedKey: key } });
  if (exists) return NextResponse.json({ error: "School already exists." }, { status: 409 });
  const school = await prisma.school.create({
    data: { normalizedKey: key, name, city, state, website, timeZone: timeZoneForState(state), status: "QUEUED" },
  });
  return NextResponse.json(school);
}
