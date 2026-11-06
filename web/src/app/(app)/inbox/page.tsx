"use client";

import clsx from "clsx";
import { Check, EyeOff, Inbox, Link2, Mail } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardHeader, EmptyState, PageHeader, Pill, Segmented, Select, SourceTag } from "@/components/ui";
import { fmtDateTime, relative } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { EmailClass, EmailItem } from "@/lib/types";

const CLASS_LABEL: Record<EmailClass, string> = {
  application_confirmation: "Application confirmation",
  interview_invitation: "Interview invitation",
  interview_reschedule: "Interview reschedule",
  assessment_invitation: "Assessment invitation",
  recruiter_message: "Recruiter message",
  rejection: "Rejection",
  offer: "Offer",
  status_update: "Status update",
};

const STATE: Record<EmailItem["state"], { label: string; tone: "good" | "warning" | "neutral" | "accent" }> = {
  auto_applied: { label: "Applied automatically", tone: "accent" },
  needs_review: { label: "Needs review", tone: "warning" },
  confirmed: { label: "Confirmed by you", tone: "good" },
  ignored: { label: "Ignored", tone: "neutral" },
};

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2" title={`Parser confidence ${pct}%`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-accent-soft">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular text-xs text-ink-2">{pct}%</span>
    </div>
  );
}

function ReviewCard({ email }: { email: EmailItem }) {
  const { applications, dispatch } = useStore();
  const guess = applications.find((a) => email.extracted.company && a.company === email.extracted.company);
  const [target, setTarget] = useState(guess?.id ?? "");
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="warning">Needs review</Pill>
        <span className="text-xs text-ink-2">{CLASS_LABEL[email.classification]}</span>
        <Confidence value={email.confidence} />
        <span className="ml-auto text-xs text-muted">{relative(email.receivedAt)}</span>
      </div>
      <div className="mt-2 text-sm font-medium">{email.subject}</div>
      <div className="text-xs text-ink-2">{email.from}</div>
      <p className="mt-2 line-clamp-2 text-sm text-ink-2">{email.snippet}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="sm:max-w-xs" aria-label="Match to application">
          <option value="">Match to application…</option>
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.company} — {a.title}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button size="sm" variant="primary" disabled={!target} onClick={() => dispatch({ type: "resolveEmail", id: email.id, state: "confirmed", applicationId: target })}>
            <Link2 className="size-3.5" /> Link
          </Button>
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "resolveEmail", id: email.id, state: "ignored" })}>
            <EyeOff className="size-3.5" /> Not job-related
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function InboxPage() {
  const { emails, activity, appById } = useStore();
  const [tab, setTab] = useState<"emails" | "activity">("emails");
  const queue = emails.filter((e) => e.state === "needs_review");
  const processed = emails.filter((e) => e.state !== "needs_review").sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return (
    <>
      <PageHeader
        title="Email & activity"
        description="Job-related emails detected in Gmail, and everything that changed. Read-only access: nothing is ever sent or deleted."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "emails", label: "Emails" },
              { value: "activity", label: "Activity log" },
            ]}
          />
        }
      />

      {tab === "emails" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader title={`Review queue · ${queue.length}`} subtitle="Emails the parser couldn't confidently match. Nothing changes until you decide." />
            {queue.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {queue.map((e) => (
                  <ReviewCard key={e.id} email={e} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Check className="size-5" />} title="All caught up" body="No emails waiting for review." />
            )}
          </Card>

          <Card>
            <CardHeader title="Processed emails" subtitle="Each Gmail message is processed once (deduplicated by message ID)" />
            <ul className="divide-y divide-line border-t border-line">
              {processed.map((e) => {
                const app = e.matchedApplicationId ? appById(e.matchedApplicationId) : undefined;
                return (
                  <li key={e.id} className={clsx("flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start", e.state === "ignored" && "opacity-60")}>
                    <Mail className="mt-0.5 hidden size-4 shrink-0 text-muted sm:block" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.subject}</div>
                      <div className="truncate text-xs text-ink-2">
                        {e.from} · {fmtDateTime(e.receivedAt)}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Pill tone={STATE[e.state].tone}>{STATE[e.state].label}</Pill>
                        <span className="text-xs text-ink-2">{CLASS_LABEL[e.classification]}</span>
                        {app && (
                          <span className="text-xs text-muted">
                            → {app.company} · {app.title}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <Confidence value={e.confidence} />
                      <code className="text-[10px] text-muted">{e.gmailMessageId}</code>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : (
        <Card>
          {activity.length === 0 ? (
            <EmptyState icon={<Inbox className="size-5" />} title="No activity yet" />
          ) : (
            <ul className="divide-y divide-line">
              {activity.slice(0, 60).map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      <span className="font-medium">{a.company}</span> <span className="text-ink-2">· {a.event.title}</span>
                    </div>
                    <div className="truncate text-xs text-muted">
                      {a.role}
                      {a.event.detail ? ` · ${a.event.detail}` : ""}
                    </div>
                  </div>
                  <SourceTag source={a.event.source} />
                  <span className="w-28 shrink-0 text-right text-xs text-muted">{fmtDateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
