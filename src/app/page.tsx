import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge, ScoreChip } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [schools, needsReview, needsVerify, failed] = await Promise.all([
    prisma.school.findMany({ select: { status: true } }),
    prisma.school.findMany({
      where: { status: "NEEDS_ZACH_REVIEW" },
      orderBy: { lastReplyDate: "desc" },
      take: 10,
    }),
    prisma.school.count({ where: { status: "NEEDS_VERIFICATION" } }),
    prisma.school.count({ where: { status: "RESEARCH_FAILED" } }),
  ]);

  const count = (s: string) => schools.filter((x) => x.status === s).length;
  const inFlight = count("QUEUED") + count("RESEARCHING");
  const replied = schools.filter((x) =>
    ["REPLIED", "INTERESTED", "DEMO_SCHEDULED", "ASKED_FOR_MORE_INFO", "NEEDS_ZACH_REVIEW"].includes(x.status)
  ).length;

  const strip: [string, number][] = [
    ["Schools", schools.length],
    ["Researching", inFlight],
    ["Drafts waiting", count("DRAFT_CREATED") + count("FOLLOW_UP_NEEDED")],
    ["Contacted", count("CONTACTED")],
    ["Replied", replied],
    ["Demos", count("DEMO_SCHEDULED")],
  ];

  return (
    <div className="space-y-8">
      <div className="ledger-rules pb-2">
        <h1 className="font-display text-4xl font-semibold">The Ledger</h1>
        <p className="text-sm text-inkSoft mt-1">Where every school stands, at a glance.</p>
      </div>

      {/* Pipeline strip — one ruled line, not a card grid */}
      <div className="card divide-y sm:divide-y-0 sm:divide-x divide-rule grid grid-cols-2 sm:grid-cols-6">
        {strip.map(([label, n]) => (
          <div key={label} className="p-4">
            <div className="font-mono text-2xl font-semibold">{n}</div>
            <div className="label mt-1">{label}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold">Needs you</h2>
          <Link href="/schools" className="text-sm underline decoration-brass underline-offset-4">All schools →</Link>
        </div>
        <div className="mt-3 space-y-2">
          {needsReview.length === 0 && (
            <p className="text-sm text-inkSoft">No live conversations waiting. Replies that need your judgment land here.</p>
          )}
          {needsReview.map((s) => (
            <Link key={s.id} href={`/schools/${s.id}`} className="card spine p-4 flex flex-wrap items-center gap-3 hover:bg-paper/60">
              <span className="font-display text-lg font-medium">{s.name}</span>
              <StatusBadge status={s.status} />
              <ScoreChip score={s.score} />
              {s.nextSteps && <span className="text-sm text-inkSoft basis-full sm:basis-auto">{s.nextSteps}</span>}
            </Link>
          ))}
        </div>
      </section>

      {(needsVerify > 0 || failed > 0) && (
        <section className="flex flex-wrap gap-3">
          {needsVerify > 0 && (
            <Link href="/queue" className="btn btn-brass">
              Verify {needsVerify} researched school{needsVerify === 1 ? "" : "s"}
            </Link>
          )}
          {failed > 0 && (
            <Link href="/schools?filter=RESEARCH_FAILED" className="btn btn-danger">
              {failed} research failure{failed === 1 ? "" : "s"} to fix
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
