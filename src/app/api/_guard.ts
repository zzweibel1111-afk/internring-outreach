import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

/** API routes require a signed-in session OR the CRON_SECRET bearer token. */
export async function requireAuth(req: Request): Promise<NextResponse | null> {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (bearer && process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) return null;
  const session = await getServerSession(authOptions);
  if (session) return null;
  return NextResponse.json({ error: "Sign in required." }, { status: 401 });
}
