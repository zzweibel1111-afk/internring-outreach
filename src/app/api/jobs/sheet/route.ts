import { NextResponse } from "next/server";
import { renderSheet } from "@/lib/sheets";
import { requireAuth } from "../../_guard";

export const maxDuration = 120;
export async function POST(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  await renderSheet();
  return NextResponse.json({ ok: true });
}
