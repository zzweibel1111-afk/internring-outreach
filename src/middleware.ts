export { default } from "next-auth/middleware";

// Pages only. API routes guard themselves (session OR Bearer CRON_SECRET),
// so external cron calls to /api/jobs/* aren't blocked by the login redirect.
export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
