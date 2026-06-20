import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { StatusBadge, ScoreChip } from "@/components/StatusBadge";
import { SchoolActions, ContactRow } from "./parts";

export const dynamic = "force-dynamic";

const CAT_LABEL: Record<string, string> = {
  HEAD_OF_SCHOOL: "Head of School",
  ADVANCEMENT: "Advancement / Development",
  ALUMNI: "Alumni Relations",
  OTHER: "Referred Contact",
};

function fmt(d?: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function SchoolPage({ params }: { params: { id: string } }) {
  const school = await prisma.school.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: { category: "asc" } },
      drafts: { orderBy: { createdAt: "desc" } },
      inbound: { orderBy: { receivedAt: "desc" }, take: 10 },
    },
  });
  if (!school) notFound();

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="card spine p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold">{school.name}</h1>
          <StatusBadge status={school.status} />
          <ScoreChip score={school.score} />
        </div>
        <div className="mt-1 text-sm text-wait">
          {[school.city, school.state].filter(Boolean).join(", ")}
          {school.website && (
            <>
              {" · "}
              <a className="underline decoration-brass underline-offset-2" href={school.website} target="_blank">
                {school.website.replace(/^https?:\/\//, "")}
              </a>
            </>
          )}
        </div>
        {school.researchError && (
          <p className="mt-3 text-sm text-alert">Research failed: {school.researchError}</p>
        )}
        <SchoolActions school={JSON.parse(JSON.stringify(school))} />
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold">Contacts</h2>
        <div className="mt-3 space-y-3">
          {school.contacts.length === 0 && (
            <p className="text-sm text-inkSoft">
              No contacts yet — research is {school.status === "QUEUED" ? "queued" : "pending"}.
            </p>
          )}
          {school.contacts.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="label">{CAT_LABEL[c.category]}</div>
              <ContactRow contact={JSON.parse(JSON.stringify(c))} />
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 grid gap-4 sm:grid-cols-2">
        <div><div className="label">Last contact date</div><div className="font-mono text-sm mt-1">{fmt(school.lastContactDate)}</div></div>
        <div><div className="label">Last reply date</div><div className="font-mono text-sm mt-1">{fmt(school.lastReplyDate)}</div></div>
        <div className="sm:col-span-2"><div className="label">AI summary</div><p className="text-sm mt-1 whitespace-pre-wrap">{school.aiSummary ?? "—"}</p></div>
        <div className="sm:col-span-2"><div className="label">Concerns</div><p className="text-sm mt-1 whitespace-pre-wrap">{school.concerns || "—"}</p></div>
        <div className="sm:col-span-2"><div className="label">Next steps</div><p className="text-sm mt-1 whitespace-pre-wrap">{school.nextSteps ?? "—"}</p></div>
        <div className="sm:col-span-2"><div className="label">Thread summary</div><p className="text-sm mt-1 whitespace-pre-wrap">{school.threadSummary ?? "—"}</p></div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Gmail drafts</h2>
        <div className="mt-3 space-y-2">
          {school.drafts.length === 0 && <p className="text-sm text-inkSoft">No drafts created yet.</p>}
          {school.drafts.map((d) => (
            <div key={d.id} className="card p-3 text-sm flex flex-wrap gap-x-4 gap-y-1 items-baseline">
              <span className="font-medium">{d.type.replace("_", " ")}</span>
              <span className="font-mono text-xs text-wait">{d.recipients}</span>
              <span className={`label ${d.status === "SENT" ? "text-signal" : ""}`}>
                {d.status === "SENT" ? `Sent ${fmt(d.sentAt)}` : "In your Drafts folder"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Recent replies</h2>
        <div className="mt-3 space-y-2">
          {school.inbound.length === 0 && <p className="text-sm text-inkSoft">No replies tracked yet.</p>}
          {school.inbound.map((m) => (
            <div key={m.id} className="card p-3 text-sm">
              <div className="flex flex-wrap gap-x-3 items-baseline">
                <span className="font-medium">{m.fromName ?? m.fromEmail}</span>
                <span className="font-mono text-xs text-wait">{fmt(m.receivedAt)}</span>
                {m.classification && <span className="label text-brass">{m.classification}</span>}
              </div>
              {m.bodyPreview && <p className="mt-1 text-inkSoft line-clamp-2">{m.bodyPreview}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
