export type StatusId =
  | "interested"
  | "preparing"
  | "applied"
  | "received"
  | "under_review"
  | "recruiter_contacted"
  | "assessment"
  | "interview_scheduled"
  | "interview_completed"
  | "second_interview"
  | "final_interview"
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "rejected"
  | "withdrawn"
  | "ghosted";

export type StageId = "wishlist" | "applied" | "assessment" | "interviewing" | "offer" | "closed";

export type Platform = "LinkedIn" | "Indeed" | "JobStreet" | "Company Website" | "Recruiter" | "Other";
export type WorkArrangement = "Remote" | "Hybrid" | "On-site";
export type EmploymentType = "Full-time" | "Contract" | "Part-time" | "Internship";
export type EventSource = "manual" | "gmail" | "hermes" | "system";

export interface Recruiter {
  name: string;
  email?: string;
  phone?: string;
}

export interface TimelineEvent {
  id: string;
  at: string; // ISO timestamp
  kind: "created" | "status" | "email" | "note" | "interview" | "followup";
  title: string;
  detail?: string;
  source: EventSource;
}

export interface Application {
  id: string;
  company: string;
  title: string;
  description: string;
  location: string;
  employmentType: EmploymentType;
  workArrangement: WorkArrangement;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  platform: Platform;
  url?: string;
  appliedAt: string; // YYYY-MM-DD
  status: StatusId;
  recruiter?: Recruiter;
  resumeVersionId?: string;
  coverLetter?: string;
  notes: string;
  nextFollowUp?: string; // YYYY-MM-DD
  lastCommunication?: string; // ISO
  updatedAt: string; // ISO
  timeline: TimelineEvent[];
}

export type InterviewType = "HR" | "Technical" | "Hiring Manager" | "Final";
export type InterviewPlatform = "Google Meet" | "Microsoft Teams" | "Zoom" | "Phone" | "On-site";

export interface Interview {
  id: string;
  applicationId: string;
  start: string; // ISO
  end: string; // ISO
  timeZone: string;
  type: InterviewType;
  platform: InterviewPlatform;
  meetingUrl?: string;
  location?: string;
  interviewers: string;
  prepNotes: string;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  calendarSynced: boolean;
}

export interface FollowUp {
  id: string;
  applicationId: string;
  due: string; // YYYY-MM-DD
  reason: string;
  rule: "after_applied_7d" | "no_response_14d" | "after_interview_7d" | "custom";
  status: "pending" | "completed" | "not_required";
}

export type EmailClass =
  | "application_confirmation"
  | "interview_invitation"
  | "interview_reschedule"
  | "assessment_invitation"
  | "recruiter_message"
  | "rejection"
  | "offer"
  | "status_update";

export interface EmailItem {
  id: string;
  gmailMessageId: string;
  threadId: string;
  receivedAt: string;
  from: string;
  subject: string;
  snippet: string;
  classification: EmailClass;
  confidence: number; // 0..1
  extracted: { company?: string; title?: string; interviewAt?: string; meetingUrl?: string };
  matchedApplicationId?: string;
  state: "auto_applied" | "needs_review" | "confirmed" | "ignored";
}

export interface ResumeVersion {
  id: string;
  name: string;
  fileName: string;
  uploadedAt: string;
  notes: string;
  hasFile?: boolean;
  sizeBytes?: number;
}

export interface AiAuditEntry {
  id: string;
  at: string;
  tool: string;
  summary: string;
  kind: "read" | "write";
  approved: boolean;
}
