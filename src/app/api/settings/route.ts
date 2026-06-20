import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSetting } from "@/lib/settings";
import { requireAuth } from "../_guard";

const EDITABLE = ["reviewMode", "followUpDays", "autoSheetSync"];

export async function GET(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const rows = await prisma.setting.findMany({ where: { key: { in: EDITABLE } } });
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

export async function PATCH(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const body = await req.json();
  for (const key of EDITABLE) {
    if (key in body) await setSetting(key, String(body[key]));
  }
  return NextResponse.json({ ok: true });
}
