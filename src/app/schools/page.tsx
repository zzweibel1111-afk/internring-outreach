import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge, ScoreChip } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function Schools({ searchParams }: { searchParams: { filter?: string } }) {
  const where = searchParams.filter ? { status: searchParams.filter as any } : {};
  const schools = await prisma.school.findMany({
    where,
    include: { contacts: { where: { status: "APPROVED" } } },
    orderBy: [{ score: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-semibold">
          Schools <span className="font-mono text-base text-wait">({schools.length})</span>
        </h1>
        {searchParams.filter && (
          <Link href="/schools" className="text-sm underline decoration-brass underline-offset-4">Clear filter</Link>
        )}
      </div>
      <div className="mt-5 space-y-2">
        {schools.length === 0 && (
          <p className="text-sm text-inkSoft">
            Nothing here yet. <Link className="underline decoration-brass" href="/upload">Upload a Niche CSV</Link> to get started.
          </p>
        )}
        {schools.map((s) => (
          <Link key={s.id} href={`/schools/${s.id}`} className="card spine p-4 flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-paper/60">
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-medium">{s.name}</div>
              <div className="text-xs text-wait">
                {[s.city, s.state].filter(Boolean).join(", ")}
                {s.timeZone ? ` · ${s.timeZone}` : ""}
                {` · ${s.contacts.length} contact${s.contacts.length === 1 ? "" : "s"}`}
              </div>
            </div>
            <StatusBadge status={s.status} />
            <ScoreChip score={s.score} />
          </Link>
        ))}
      </div>
    </div>
  );
}
