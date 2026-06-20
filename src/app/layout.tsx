import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", axes: ["opsz"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Intern Ring · Outreach Engine",
  description: "School outreach research, drafting, and reply tracking.",
};

const NAV = [
  ["Dashboard", "/"],
  ["Schools", "/schools"],
  ["Verify", "/queue"],
  ["Upload", "/upload"],
  ["Templates", "/templates"],
  ["Settings", "/settings"],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <header className="border-b-2 border-ink bg-paper">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-display text-xl font-semibold tracking-tight">Intern Ring</span>
              <span className="label text-brass">Outreach Engine</span>
            </Link>
            <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {NAV.map(([name, href]) => (
                <Link key={href} href={href} className="text-inkSoft hover:text-ink hover:underline underline-offset-4 decoration-brass">
                  {name}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 label">
          Drafts only — nothing sends without you.
        </footer>
      </body>
    </html>
  );
}
