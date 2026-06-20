import type { SchoolStatus } from "@prisma/client";

// Lead score per the spec.
export function scoreForStatus(status: SchoolStatus): number {
  switch (status) {
    case "DEMO_SCHEDULED": return 10;
    case "INTERESTED": return 8;
    case "ASKED_FOR_MORE_INFO": return 6;
    case "REPLIED":
    case "NEEDS_ZACH_REVIEW":
    case "WRONG_CONTACT": return 5;
    case "OUT_OF_OFFICE": return 3;
    case "NOT_INTERESTED": return 0;
    default: return 2; // no response yet
  }
}

export function statusForClassification(c: string): SchoolStatus {
  switch (c) {
    case "Interested": return "INTERESTED";
    case "Demo Scheduled": return "DEMO_SCHEDULED";
    case "Asked for More Info": return "ASKED_FOR_MORE_INFO";
    case "Wrong Contact": return "WRONG_CONTACT";
    case "Out of Office": return "OUT_OF_OFFICE";
    case "Not Interested": return "NOT_INTERESTED";
    default: return "REPLIED";
  }
}

export const POSITIVE_CLASSIFICATIONS = ["Interested", "Demo Scheduled", "Asked for More Info"];
