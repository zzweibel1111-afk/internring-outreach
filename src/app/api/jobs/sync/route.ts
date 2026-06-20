import { NextResponse } from "next/server";
import { runSyncCycle } from "@/lib/jobs";
import { requireAuth } from "../../_guard";

export const maxDuration = 300;
export async function POST(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  return NextResponse.json(await runSyncCycle());
}
