const STYLES: Record<string, string> = {
  QUEUED: "text-wait border-wait",
  RESEARCHING: "text-wait border-wait",
  NEEDS_VERIFICATION: "text-brass border-brass",
  RESEARCH_FAILED: "text-alert border-alert",
  DRAFT_CREATED: "text-inkSoft border-inkSoft",
  CONTACTED: "text-inkSoft border-inkSoft",
  FOLLOW_UP_NEEDED: "text-brass border-brass",
  REPLIED: "text-signal border-signal",
  INTERESTED: "text-signal border-signal",
  DEMO_SCHEDULED: "text-signal border-signal",
  ASKED_FOR_MORE_INFO: "text-signal border-signal",
  WRONG_CONTACT: "text-brass border-brass",
  OUT_OF_OFFICE: "text-wait border-wait",
  NOT_INTERESTED: "text-alert border-alert",
  NEEDS_ZACH_REVIEW: "text-paper bg-signal border-signal",
};

export const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  RESEARCHING: "Researching",
  NEEDS_VERIFICATION: "Needs verification",
  RESEARCH_FAILED: "Research failed",
  DRAFT_CREATED: "Draft created",
  CONTACTED: "Contacted",
  FOLLOW_UP_NEEDED: "Follow up needed",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  DEMO_SCHEDULED: "Demo scheduled",
  ASKED_FOR_MORE_INFO: "Asked for more info",
  WRONG_CONTACT: "Wrong contact",
  OUT_OF_OFFICE: "Out of office",
  NOT_INTERESTED: "Not interested",
  NEEDS_ZACH_REVIEW: "Needs Zach review",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block border rounded-sm px-1.5 py-0.5 text-[11px] uppercase tracking-wider font-medium ${STYLES[status] ?? "text-wait border-wait"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function ScoreChip({ score }: { score: number }) {
  return <span className="font-mono text-sm font-semibold text-brass">{score}/10</span>;
}
