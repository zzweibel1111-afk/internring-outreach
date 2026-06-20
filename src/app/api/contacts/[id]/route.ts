import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createInitialDraft, createWrongContactDraft } from "@/lib/drafts";
import { renderSheet } from "@/lib/sheets";
import { requireAuth } from "../../_guard";

/**
 * PATCH /api/contacts/:id
 * Edit fields, approve, or reject a researched contact. When a school's last
 * pending contact is resolved and at least one contact is approved with an
 * email, the Gmail draft is created automatically.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const body = await req.json();
  const data: any = {};
  for (const f of ["name", "title", "email", "phone", "extension", "category"]) {
    if (f in body) data[f] = body[f];
  }
  if (body.action === "approve") data.status = "APPROVED";
  if (body.action === "reject") data.status = "REJECTED";

  const contact = await prisma.contact.update({ where: { id: params.id }, data });
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: contact.schoolId },
    include: { contacts: true },
  });

  // Referred contact ("Wrong Contact" flow) approved → draft just to them.
  if (body.action === "approve" && contact.category === "OTHER" && contact.email) {
    await createWrongContactDraft(school.id, { name: contact.name, email: contact.email });
    await renderSheet().catch(() => {});
    return NextResponse.json({ contact, drafted: true });
  }

  const pending = school.contacts.filter((c) => c.status === "PENDING_REVIEW").length;
  const approvedWithEmail = school.contacts.some(
    (c) => c.status === "APPROVED" && c.email && c.category !== "OTHER"
  );
  let drafted = false;
  if (school.status === "NEEDS_VERIFICATION" && pending === 0 && approvedWithEmail) {
    await createInitialDraft(school.id);
    drafted = true;
    await renderSheet().catch(() => {});
  }
  return NextResponse.json({ contact, drafted });
}
