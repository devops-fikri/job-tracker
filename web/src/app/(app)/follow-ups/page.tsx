"use client";

import { BellRing, Check, Clock, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Pill, Segmented, Select, Toggle } from "@/components/ui";
import { diffDays, fmtDay, TODAY, uid, klDay } from "@/lib/format";
import { isActive, STATUS_BY_ID } from "@/lib/statuses";
import { followUpDefaultDue, useStore } from "@/lib/store";
import type { FollowUp } from "@/lib/types";

const RULES = [
  { id: "after_applied_7d", label: "7 days after applying", detail: "If the status is still Applied or Application Received" },
  { id: "no_response_14d", label: "14 days without a response", detail: "No email or status change for two weeks" },
  { id: "after_interview_7d", label: "7 days after an interview", detail: "Interview completed and no update since" },
];

export default function FollowUpsPage() {
  const { followUps, applications, appById, dispatch, staleApplications } = useStore();
  const [tab, setTab] = useState<FollowUp["status"]>("pending");
  const [rules, setRules] = useState<Record<string, boolean>>({ after_applied_7d: true, no_response_14d: true, after_interview_7d: true });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ applicationId: "", due: followUpDefaultDue(), reason: "" });

  const list = followUps.filter((f) => f.status === tab).sort((a, b) => (tab === "pending" ? a.due.localeCompare(b.due) : b.due.localeCompare(a.due)));
  const count = (s: FollowUp["status"]) => followUps.filter((f) => f.status === s).length;

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Reminders to chase applications that have gone quiet."
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New follow-up
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "pending", label: `Pending · ${count("pending")}` },
                { value: "completed", label: `Completed · ${count("completed")}` },
                { value: "not_required", label: `Not required · ${count("not_required")}` },
              ]}
            />
          </div>
          {list.length === 0 ? (
            <EmptyState icon={<BellRing className="size-5" />} title="Nothing here" body="Follow-ups appear automatically based on your rules." />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((f) => {
                const app = appById(f.applicationId);
                if (!app) return null;
                const d = diffDays(f.due, TODAY);
                const quiet = diffDays(TODAY, klDay(app.updatedAt));
                return (
                  <li key={f.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{app.company}</span>
                        <span className="text-sm text-ink-2">· {app.title}</span>
                      </div>
                      <div className="mt-0.5 text-sm text-ink-2">{f.reason}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {tab === "pending" && (
                          <Pill tone={d < 0 ? "critical" : d === 0 ? "warning" : "neutral"}>
                            <Clock className="size-3" />
                            {d < 0 ? `${-d}d overdue` : d === 0 ? "Due today" : `Due ${fmtDay(f.due)}`}
                          </Pill>
                        )}
                        <span>{STATUS_BY_ID[app.status].label}</span>·<span>quiet for {quiet} days</span>
                      </div>
                    </div>
                    {tab === "pending" && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" disabled title="Needs the AI email parser (Phase 2). Drafts are never sent without your approval.">
                          <Sparkles className="size-3.5" /> Draft email
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "setFollowUp", id: f.id, status: "not_required" })}>
                          <X className="size-3.5" /> Not required
                        </Button>
                        <Button size="sm" onClick={() => dispatch({ type: "setFollowUp", id: f.id, status: "completed" })}>
                          <Check className="size-3.5" /> Done
                        </Button>
                      </div>
                    )}
                    {tab !== "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "setFollowUp", id: f.id, status: "pending" })}>
                        Reopen
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Follow-up rules" subtitle="Checked by the background worker daily" />
            <ul className="divide-y divide-line">
              {RULES.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-ink-2">{r.detail}</div>
                  </div>
                  <Toggle label={r.label} checked={rules[r.id]} onChange={(v) => setRules((p) => ({ ...p, [r.id]: v }))} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Quiet for 14+ days" subtitle="Awaiting response with no recent activity" />
            <ul className="divide-y divide-line">
              {staleApplications.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <span className="truncate">{a.company}</span>
                  <span className="shrink-0 text-xs text-muted">{diffDays(TODAY, klDay(a.updatedAt))} days</span>
                </li>
              ))}
              {!staleApplications.length && <li className="px-5 py-4 text-sm text-muted">None — nice.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="New follow-up"
        footer={
          <Button
            variant="primary"
            disabled={!draft.applicationId || !draft.due}
            onClick={() => {
              dispatch({ type: "addFollowUp", followUp: { id: uid(), applicationId: draft.applicationId, due: draft.due, reason: draft.reason || "Custom follow-up", rule: "custom", status: "pending" } });
              setAdding(false);
              setDraft({ applicationId: "", due: followUpDefaultDue(), reason: "" });
              setTab("pending");
            }}
          >
            Create
          </Button>
        }
      >
        <div className="grid gap-4">
          <Field label="Application">
            <Select value={draft.applicationId} onChange={(e) => setDraft({ ...draft, applicationId: e.target.value })}>
              <option value="">Select…</option>
              {applications.filter((a) => isActive(a.status)).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company} — {a.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
          </Field>
          <Field label="Reason">
            <Input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="e.g. Ask about next steps" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
