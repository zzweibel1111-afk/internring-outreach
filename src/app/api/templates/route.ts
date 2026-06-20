import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "../_guard";

export async function GET(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  return NextResponse.json(await prisma.emailTemplate.findMany({ orderBy: { key: "asc" } }));
}

export async function PATCH(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { key, subject, body } = await req.json();
  if (!key) return NextResponse.json({ error: "Missing template key." }, { status: 400 });
  const tpl = await prisma.emailTemplate.update({
    where: { key },
    data: { ...(subject !== undefined && { subject }), ...(body !== undefined && { body }) },
  });
  return NextResponse.json(tpl);
}
