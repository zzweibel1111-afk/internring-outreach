import Link from "next/link";
import { prisma } from "@/lib/db";
import { ContactRow } from "../schools/[id]/parts";

export const dynamic = "force-dynamic";

const CAT_LABEL: Record<string, string> = {
  HEAD_OF_SCHOOL: "Head of School",
  ADVANCEMENT: "Advancement / Development",
  ALUMNI: "Alumni Relations",
  OTHER: "Referred Contact",
};

export default async function Queue() {
  const schools = await prisma.school.findMany({
    where: { contacts: { some: { status: "PENDING_REVIEW" } } },
    include: { contacts: { where: { status: "PENDING_REVIEW" } } },
    orderBy: { updatedAt: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold">Verification queue</h1>
      <p className="mt-2 text-sm text-inkSoft">
        Researched contacts wait here for a once-over before any draft is created.
        Fix anything that's off, then approve. When a school's last contact is
        resolved, its Gmail draft is created automatically.
        (Turn review off in <Link href="/settings" className="underline decoration-brass">Settings</Link> to skip this step.)
      </p>
      <div className="mt-6 space-y-6">
        {schools.length === 0 && <p className="text-sm text-inkSoft">Queue's clear. Nothing waiting on you.</p>}
        {schools.map((s) => (
          <div key={s.id} className="card spine p-5">
            <Link href={`/schools/${s.id}`} className="font-display text-xl font-semibold hover:underline decoration-brass">
              {s.name}
            </Link>
            <div className="mt-3 space-y-4">
              {s.contacts.map((c) => (
                <div key={c.id}>
                  <div className="label">{CAT_LABEL[c.category]}</div>
                  <ContactRow contact={JSON.parse(JSON.stringify(c))} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
