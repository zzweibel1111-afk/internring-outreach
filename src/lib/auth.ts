import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

// Gmail scopes: gmail.compose covers draft create/read/update/delete (Google
// bundles "send" into this scope too — there is no narrower official scope
// for draft management alone). Our code only ever calls drafts.create / .get
// — never .send or messages.send — so the system never sends, by design,
// even though the granted permission technically allows it.
export const GMAIL_SCOPES =
  "openid email profile https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GMAIL_SCOPES,
          access_type: "offline", // required to get a refresh_token
          prompt: "consent",      // forces refresh_token on every sign-in, not just the first
        },
      },
    }),
  ],
  // JWT sessions so next-auth middleware can protect pages; the adapter still
  // persists the Account row with the Gmail refresh token on sign-in.
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      const allowed = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      if (allowed.length > 0 && (!user.email || !allowed.includes(user.email.toLowerCase()))) {
        return false;
      }
      // The adapter only writes tokens on the FIRST sign-in; keep them fresh
      // on every later sign-in so the worker never loses Gmail access.
      if (account?.provider === "google") {
        await prisma.account.updateMany({
          where: { provider: "google", providerAccountId: account.providerAccountId },
          data: {
            access_token: account.access_token,
            refresh_token: account.refresh_token ?? undefined,
            expires_at: account.expires_at,
          },
        });
      }
      return true;
    },
  },
  pages: { signIn: "/login" },
};
