"use client";
import { signIn } from "next-auth/react";

export default function Login() {
  return (
    <div className="ledger-rules min-h-[60vh] flex items-center justify-center">
      <div className="card spine p-8 max-w-md w-full">
        <h1 className="font-display text-3xl font-semibold">Outreach Engine</h1>
        <p className="mt-2 text-sm text-inkSoft">
          Sign in with the Gmail account whose Drafts folder will hold the
          outreach emails. The connection is used to create drafts and read
          replies — the system never sends on its own.
        </p>
        <button className="btn mt-6 w-full justify-center" onClick={() => signIn("google", { callbackUrl: "/" })}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
