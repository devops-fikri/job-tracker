"use client";

import { AlertTriangle, CalendarClock, ExternalLink, Mail, Pencil, StickyNote, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtDateTime, fmtDay, salaryRange, relative } from "@/lib/format";
import { PLATFORMS, STATUSES, STATUS_BY_ID } from "@/lib/statuses";
import { dupKey, useStore } from "@/lib/store";
import type { Application, EmploymentType, Platform, StatusId, WorkArrangement } from "@/lib/types";
import { Button, Drawer, Field, Input, Modal, Pill, Select, SourceTag, StatusBadge, Textarea } from "./ui";

export function StatusSelect({ value, onChange, className }: { value: StatusId; onChange: (s: StatusId) => void; className?: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as StatusId)} className={className} aria-label="Status">
      {STATUSES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </Select>
  );
}

export function ApplicationForm({ open, initial, onClose }: { open: boolean; initial: Application; onClose: () => void }) {
  const { applications, resumes, dispatch } = useStore();
  const [a, setA] = useState(initial);
  const isNew = !applications.some((x) => x.id === initial.id);
  const set = <K extends keyof Application>(k: K, v: Application[K]) => setA((p) => ({ ...p, [k]: v }));

  const duplicate = useMemo(
    () => (a.company && a.title ? applications.find((x) => x.id !== a.id && dupKey(x) === dupKey(a)) : undefined),
    [a, applications],
  );
  const valid = a.company.trim() && a.title.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Add application" : "Edit application"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              dispatch({ type: "upsertApplication", app: { ...a, company: a.company.trim(), title: a.title.trim() } });
              onClose();
            }}
          >
            {isNew ? "Add application" : "Save changes"}
          </Button>
        </>
      }
    >
      {duplicate && (
        <div className="mb-4 flex gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <span className="font-medium">Possible duplicate.</span> You already have{" "}
            <span className="font-medium">
              {duplicate.title} at {duplicate.company}
            </span>{" "}
            ({STATUS_BY_ID[duplicate.status].label}, applied {fmtDay(duplicate.appliedAt)}).
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company *">
          <Input value={a.company} onChange={(e) => set("company", e.target.value)} placeholder="ABC Technologies" autoFocus />
        </Field>
        <Field label="Job title *">
          <Input value={a.title} onChange={(e) => set("title", e.target.value)} placeholder="Cloud Security Engineer" />
        </Field>
        <Field label="Status">
          <StatusSelect value={a.status} onChange={(s) => set("status", s)} />
        </Field>
        <Field label="Platform">
          <Select value={a.platform} onChange={(e) => set("platform", e.target.value as Platform)}>
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Application date">
          <Input type="date" value={a.appliedAt} onChange={(e) => set("appliedAt", e.target.value)} />
        </Field>
        <Field label="Location">
          <Input value={a.location} onChange={(e) => set("location", e.target.value)} placeholder="Kuala Lumpur" />
        </Field>
        <Field label="Work arrangement">
          <Select value={a.workArrangement} onChange={(e) => set("workArrangement", e.target.value as WorkArrangement)}>
            {["Remote", "Hybrid", "On-site"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Employment type">
          <Select value={a.employmentType} onChange={(e) => set("employmentType", e.target.value as EmploymentType)}>
            {["Full-time", "Contract", "Part-time", "Internship"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Salary min (MYR / month)">
          <Input type="number" min={0} value={a.salaryMin ?? ""} onChange={(e) => set("salaryMin", e.target.value ? Number(e.target.value) : undefined)} />
        </Field>
        <Field label="Salary max (MYR / month)">
          <Input type="number" min={0} value={a.salaryMax ?? ""} onChange={(e) => set("salaryMax", e.target.value ? Number(e.target.value) : undefined)} />
        </Field>
        <Field label="Job posting URL" className="sm:col-span-2">
          <Input type="url" value={a.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder="https://" />
        </Field>
        <Field label="Recruiter name">
          <Input value={a.recruiter?.name ?? ""} onChange={(e) => set("recruiter", { ...a.recruiter, name: e.target.value })} />
        </Field>
        <Field label="Recruiter email">
          <Input type="email" value={a.recruiter?.email ?? ""} onChange={(e) => set("recruiter", { name: a.recruiter?.name ?? "", ...a.recruiter, email: e.target.value })} />
        </Field>
        <Field label="Resume / CV version">
          <Select value={a.resumeVersionId ?? ""} onChange={(e) => set("resumeVersionId", e.target.value || undefined)}>
            <option value="">—</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next follow-up">
          <Input type="date" value={a.nextFollowUp ?? ""} onChange={(e) => set("nextFollowUp", e.target.value || undefined)} />
        </Field>
        <Field label="Job description" className="sm:col-span-2">
          <Textarea rows={4} value={a.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Cover letter" className="sm:col-span-2">
          <Textarea rows={3} value={a.coverLetter ?? ""} onChange={(e) => set("coverLetter", e.target.value)} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={a.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children || "—"}</dd>
    </div>
  );
}

const TIMELINE_ICON = { created: StickyNote, status: StickyNote, email: Mail, note: StickyNote, interview: CalendarClock, followup: CalendarClock };

export function ApplicationDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { appById, interviews, resumes, dispatch } = useStore();
  const app = id ? appById(id) : undefined;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!app) return null;
  const appInterviews = interviews.filter((i) => i.applicationId === app.id).sort((a, b) => a.start.localeCompare(b.start));
  const resume = resumes.find((r) => r.id === app.resumeVersionId);

  return (
    <>
      <Drawer
        open
        wide
        onClose={onClose}
        title={
          <div className="min-w-0">
            <div className="truncate">{app.title}</div>
            <div className="truncate text-sm font-normal text-ink-2">{app.company}</div>
          </div>
        }
        footer={
          confirmDelete ? (
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm text-ink-2">Delete this application and its interviews?</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    dispatch({ type: "deleteApplication", id: app.id });
                    onClose();
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
              <Button onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect value={app.status} onChange={(s) => dispatch({ type: "setStatus", id: app.id, status: s })} className="w-auto" />
          <Pill>{app.platform}</Pill>
          <Pill>{app.workArrangement}</Pill>
          {app.url && (
            <a href={app.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              Job posting <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Detail label="Applied">{fmtDay(app.appliedAt)}</Detail>
          <Detail label="Location">{app.location}</Detail>
          <Detail label="Employment">{app.employmentType}</Detail>
          <Detail label="Salary (monthly)">{salaryRange(app.salaryMin, app.salaryMax, app.currency)}</Detail>
          <Detail label="Last communication">{app.lastCommunication ? relative(app.lastCommunication) : ""}</Detail>
          <Detail label="Next follow-up">{app.nextFollowUp ? fmtDay(app.nextFollowUp) : ""}</Detail>
          <Detail label="CV submitted">{resume?.name}</Detail>
        </dl>

        {app.recruiter && (
          <div className="mt-5 flex items-center gap-3 rounded-lg border border-line p-3">
            <span className="grid size-9 place-items-center rounded-full bg-surface-2">
              <UserRound className="size-4 text-muted" />
            </span>
            <div className="min-w-0 text-sm">
              <div className="font-medium">{app.recruiter.name}</div>
              <div className="truncate text-xs text-ink-2">
                {app.recruiter.email} {app.recruiter.phone && `· ${app.recruiter.phone}`}
              </div>
            </div>
          </div>
        )}

        {appInterviews.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Interviews</h3>
            <ul className="space-y-2">
              {appInterviews.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {i.type} · {i.platform}
                    </div>
                    <div className="text-xs text-ink-2">{fmtDateTime(i.start)}</div>
                  </div>
                  <Pill tone={i.status === "scheduled" ? "accent" : "neutral"}>{i.status}</Pill>
                </li>
              ))}
            </ul>
          </section>
        )}

        {app.description && (
          <section className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Job description</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{app.description}</p>
          </section>
        )}

        <section className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Notes</h3>
          {app.notes && <p className="mb-3 whitespace-pre-line text-sm text-ink-2">{app.notes}</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              dispatch({ type: "addNote", id: app.id, text: note.trim() });
              setNote("");
            }}
          >
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
            <Button type="submit" disabled={!note.trim()}>
              Add
            </Button>
          </form>
        </section>

        <section className="mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Activity timeline</h3>
          <ol>
            {app.timeline.map((e) => {
              const Icon = TIMELINE_ICON[e.kind];
              return (
                <li key={e.id} className="relative flex gap-3 border-l border-line pb-4 pl-5 last:pb-0">
                  <span className="absolute -left-[9px] top-0 grid size-[18px] place-items-center rounded-full border border-line bg-surface">
                    <Icon className="size-2.5 text-muted" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{e.title}</div>
                    {e.detail && <div className="text-xs text-ink-2">{e.detail}</div>}
                    <div className="mt-0.5 text-xs text-muted">{fmtDateTime(e.at)}</div>
                  </div>
                  <SourceTag source={e.source} />
                </li>
              );
            })}
          </ol>
        </section>
      </Drawer>
      {editing && <ApplicationForm open initial={app} onClose={() => setEditing(false)} />}
    </>
  );
}

export { StatusBadge };
