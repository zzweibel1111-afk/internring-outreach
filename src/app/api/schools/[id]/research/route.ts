import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "../../../_guard";

/** Re-queue a school for research (used on RESEARCH_FAILED). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  await prisma.school.update({
    where: { id: params.id },
    data: { status: "QUEUED", researchError: null },
  });
  return NextResponse.json({ ok: true });
}
