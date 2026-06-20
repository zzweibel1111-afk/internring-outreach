import { NextResponse } from "next/server";
import { createInitialDraft, createFollowUpDraft } from "@/lib/drafts";
import { renderSheet } from "@/lib/sheets";
import { requireAuth } from "../../../_guard";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { type } = await req.json().catch(() => ({ type: "INITIAL" }));
  try {
    const draft =
      type === "FOLLOW_UP"
        ? await createFollowUpDraft(params.id)
        : await createInitialDraft(params.id);
    await renderSheet().catch(() => {});
    return NextResponse.json(draft);
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 400 });
  }
}
