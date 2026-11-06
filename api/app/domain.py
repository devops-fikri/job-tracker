"""Status vocabulary shared with web/src/lib/statuses.ts. Keep the two in sync."""

from typing import Literal

StatusId = Literal[
    "interested", "preparing", "applied", "received", "under_review", "recruiter_contacted",
    "assessment", "interview_scheduled", "interview_completed", "second_interview", "final_interview",
    "offer_received", "offer_accepted", "offer_rejected", "rejected", "withdrawn", "ghosted",
]

STATUSES: dict[str, tuple[str, str]] = {  # id -> (label, stage)
    "interested": ("Interested", "wishlist"),
    "preparing": ("Preparing Application", "wishlist"),
    "applied": ("Applied", "applied"),
    "received": ("Application Received", "applied"),
    "under_review": ("Under Review", "applied"),
    "recruiter_contacted": ("Recruiter Contacted", "applied"),
    "assessment": ("Assessment", "assessment"),
    "interview_scheduled": ("Interview Scheduled", "interviewing"),
    "interview_completed": ("Interview Completed", "interviewing"),
    "second_interview": ("Second Interview", "interviewing"),
    "final_interview": ("Final Interview", "interviewing"),
    "offer_received": ("Offer Received", "offer"),
    "offer_accepted": ("Offer Accepted", "offer"),
    "offer_rejected": ("Offer Rejected", "closed"),
    "rejected": ("Rejected", "closed"),
    "withdrawn": ("Withdrawn", "closed"),
    "ghosted": ("No Response / Ghosted", "closed"),
}

AWAITING = {"applied", "received", "under_review"}
ACTIVE_STAGES = {"applied", "assessment", "interviewing", "offer"}


def label(status: str) -> str:
    return STATUSES[status][0]


def stage(status: str) -> str:
    return STATUSES[status][1]


def is_active(status: str) -> bool:
    return stage(status) in ACTIVE_STAGES and status != "offer_accepted"


Platform = Literal["LinkedIn", "Indeed", "JobStreet", "Company Website", "Recruiter", "Other"]
WorkArrangement = Literal["Remote", "Hybrid", "On-site"]
EmploymentType = Literal["Full-time", "Contract", "Part-time", "Internship"]
EventSource = Literal["manual", "gmail", "hermes", "system"]
EventKind = Literal["created", "status", "email", "note", "interview", "followup"]
InterviewType = Literal["HR", "Technical", "Hiring Manager", "Final"]
InterviewPlatform = Literal["Google Meet", "Microsoft Teams", "Zoom", "Phone", "On-site"]
InterviewStatus = Literal["scheduled", "completed", "cancelled", "rescheduled"]
FollowUpRule = Literal["after_applied_7d", "no_response_14d", "after_interview_7d", "custom"]
FollowUpStatus = Literal["pending", "completed", "not_required"]
EmailClass = Literal[
    "application_confirmation", "interview_invitation", "interview_reschedule", "assessment_invitation",
    "recruiter_message", "rejection", "offer", "status_update",
]
EmailState = Literal["auto_applied", "needs_review", "confirmed", "ignored"]
