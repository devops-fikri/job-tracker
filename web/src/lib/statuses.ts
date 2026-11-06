import type { Platform, StageId, StatusId } from "./types";

export interface StatusDef {
  id: StatusId;
  label: string;
  stage: StageId;
  /** dot colour; text always stays in ink tokens */
  color: string;
}

const GRAY = "#898781";
const BLUE = "var(--series-1)";
const VIOLET = "var(--series-7)";
const AQUA = "var(--series-3)";
const GOOD = "#0ca30c";
const CRITICAL = "#d03b3b";

export const STATUSES: StatusDef[] = [
  { id: "interested", label: "Interested", stage: "wishlist", color: GRAY },
  { id: "preparing", label: "Preparing Application", stage: "wishlist", color: GRAY },
  { id: "applied", label: "Applied", stage: "applied", color: BLUE },
  { id: "received", label: "Application Received", stage: "applied", color: BLUE },
  { id: "under_review", label: "Under Review", stage: "applied", color: BLUE },
  { id: "recruiter_contacted", label: "Recruiter Contacted", stage: "applied", color: BLUE },
  { id: "assessment", label: "Assessment", stage: "assessment", color: VIOLET },
  { id: "interview_scheduled", label: "Interview Scheduled", stage: "interviewing", color: AQUA },
  { id: "interview_completed", label: "Interview Completed", stage: "interviewing", color: AQUA },
  { id: "second_interview", label: "Second Interview", stage: "interviewing", color: AQUA },
  { id: "final_interview", label: "Final Interview", stage: "interviewing", color: AQUA },
  { id: "offer_received", label: "Offer Received", stage: "offer", color: GOOD },
  { id: "offer_accepted", label: "Offer Accepted", stage: "offer", color: GOOD },
  { id: "offer_rejected", label: "Offer Rejected", stage: "closed", color: GRAY },
  { id: "rejected", label: "Rejected", stage: "closed", color: CRITICAL },
  { id: "withdrawn", label: "Withdrawn", stage: "closed", color: GRAY },
  { id: "ghosted", label: "No Response / Ghosted", stage: "closed", color: GRAY },
];

export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s])) as Record<StatusId, StatusDef>;

export const STAGES: { id: StageId; label: string; dropStatus: StatusId }[] = [
  { id: "wishlist", label: "Wishlist", dropStatus: "interested" },
  { id: "applied", label: "Applied", dropStatus: "applied" },
  { id: "assessment", label: "Assessment", dropStatus: "assessment" },
  { id: "interviewing", label: "Interviewing", dropStatus: "interview_scheduled" },
  { id: "offer", label: "Offer", dropStatus: "offer_received" },
  { id: "closed", label: "Closed", dropStatus: "rejected" },
];

export const PLATFORMS: Platform[] = ["LinkedIn", "Indeed", "JobStreet", "Company Website", "Recruiter", "Other"];

/** Statuses where we are still waiting on the employer. */
export const AWAITING: StatusId[] = ["applied", "received", "under_review"];
export const ACTIVE_STAGES: StageId[] = ["applied", "assessment", "interviewing", "offer"];

export const isActive = (s: StatusId) => ACTIVE_STAGES.includes(STATUS_BY_ID[s].stage) && s !== "offer_accepted";
