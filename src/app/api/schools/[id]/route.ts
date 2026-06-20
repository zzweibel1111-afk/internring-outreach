import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "../../_guard";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const body = await req.json();
  const data: any = {};
  for (const f of ["timeZone", "website", "status", "stopAutomation"]) {
    if (f in body) data[f] = body[f];
  }
  const school = await prisma.school.update({ where: { id: params.id }, data });
  return NextResponse.json(school);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  await prisma.school.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
