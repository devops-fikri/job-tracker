"use client";

import clsx from "clsx";
import { CalendarCheck2, ChevronLeft, ChevronRight, Download, ExternalLink, Plus, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, CardHeader, Field, Input, Modal, PageHeader, Pill, Segmented, Select, Textarea } from "@/components/ui";
import { addDays, fmtDayLong, fmtDayShort, fmtMonth, fmtTime, klDay, klHours, TODAY, TZ, uid, weekday, diffDays } from "@/lib/format";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { isActive } from "@/lib/statuses";
import { useStore } from "@/lib/store";
import type { Interview, InterviewPlatform, InterviewType } from "@/lib/types";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 08:00–19:00
const mondayOf = (day: string) => addDays(day, -((weekday(day) + 6) % 7));
const timeOf = (iso: string) => {
  const h = klHours(iso);
  return `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
};
const toIso = (day: string, time: string) => `${day}T${time}:00+08:00`; // Malaysia has no DST

function InterviewForm({ initial, onClose }: { initial: Interview; onClose: () => void }) {
  const { applications, interviews, dispatch } = useStore();
  const isNew = !interviews.some((i) => i.id === initial.id);
  const [i, setI] = useState(initial);
  const [day, setDay] = useState(klDay(initial.start));
  const [start, setStart] = useState(timeOf(initial.start));
  const [end, setEnd] = useState(timeOf(initial.end));
  const set = <K extends keyof Interview>(k: K, v: Interview[K]) => setI((p) => ({ ...p, [k]: v }));
  const options = applications.filter((a) => isActive(a.status) || a.id === initial.applicationId);
  const valid = i.applicationId && day && start < end;

  const save = (status: Interview["status"] = i.status) => {
    const moved = !isNew && (toIso(day, start) !== initial.start || toIso(day, end) !== initial.end);
    dispatch({
      type: "upsertInterview",
      interview: { ...i, start: toIso(day, start), end: toIso(day, end), status: moved && status === "scheduled" ? "rescheduled" : status },
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Schedule interview" : "Interview details"}
      footer={
        <>
          {!isNew && i.status !== "cancelled" && (
            <Button variant="danger" className="mr-auto" onClick={() => save("cancelled")}>
              Cancel interview
            </Button>
          )}
          {!isNew && i.status !== "completed" && <Button onClick={() => save("completed")}>Mark completed</Button>}
          <Button variant="primary" disabled={!valid} onClick={() => save()}>
            {isNew ? "Schedule" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Application" className="sm:col-span-2">
          <Select value={i.applicationId} onChange={(e) => set("applicationId", e.target.value)}>
            <option value="">Select an application…</option>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company} — {a.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End">
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Interview type">
          <Select value={i.type} onChange={(e) => set("type", e.target.value as InterviewType)}>
            {["HR", "Technical", "Hiring Manager", "Final"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Platform">
          <Select value={i.platform} onChange={(e) => set("platform", e.target.value as InterviewPlatform)}>
            {["Google Meet", "Microsoft Teams", "Zoom", "Phone", "On-site"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        {i.platform === "On-site" ? (
          <Field label="Location" className="sm:col-span-2">
            <Input value={i.location ?? ""} onChange={(e) => set("location", e.target.value)} />
          </Field>
        ) : (
          <Field label="Meeting URL" className="sm:col-span-2">
            <Input type="url" value={i.meetingUrl ?? ""} onChange={(e) => set("meetingUrl", e.target.value)} placeholder="https://" />
          </Field>
        )}
        <Field label="Interviewers" className="sm:col-span-2">
          <Input value={i.interviewers} onChange={(e) => set("interviewers", e.target.value)} />
        </Field>
        <Field label="Preparation notes" className="sm:col-span-2">
          <Textarea rows={3} value={i.prepNotes} onChange={(e) => set("prepNotes", e.target.value)} />
        </Field>
        <p className="text-xs text-muted sm:col-span-2">Time zone: {TZ}. Reminders go out 24 h, 1 h and 15 min before (configurable in Settings).</p>
      </div>
    </Modal>
  );
}

export default function CalendarPage() {
  const { interviews, upcoming, appById } = useStore();
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(TODAY);
  const [editing, setEditing] = useState<Interview | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, Interview[]>();
    for (const i of interviews) {
      if (i.status === "cancelled") continue;
      const d = klDay(i.start);
      m.set(d, [...(m.get(d) ?? []), i].sort((a, b) => a.start.localeCompare(b.start)));
    }
    return m;
  }, [interviews]);

  const monthStart = `${anchor.slice(0, 7)}-01`;
  const gridStart = mondayOf(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, k) => addDays(gridStart, k));
  const weekStart = mondayOf(anchor);
  const weekDays = Array.from({ length: 7 }, (_, k) => addDays(weekStart, k));

  const shift = (dir: number) => {
    if (view === "week") return setAnchor(addDays(anchor, 7 * dir));
    const [y, m] = anchor.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + dir, 1));
    setAnchor(d.toISOString().slice(0, 10));
  };

  const newInterview = (day = TODAY): Interview => ({
    id: uid(),
    applicationId: "",
    start: toIso(day, "10:00"),
    end: toIso(day, "11:00"),
    timeZone: TZ,
    type: "HR",
    platform: "Google Meet",
    interviewers: "",
    prepNotes: "",
    status: "scheduled",
    calendarSynced: false,
  });

  const Chip = ({ i, compact }: { i: Interview; compact?: boolean }) => {
    const app = appById(i.applicationId);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(i);
        }}
        className={clsx(
          "w-full truncate rounded-md border-l-2 bg-accent-soft px-1.5 py-0.5 text-left text-[11px] text-ink hover:brightness-95",
          i.status === "completed" ? "border-line-strong opacity-70" : "border-accent",
        )}
        title={`${fmtTime(i.start)} ${app?.company} · ${i.type}`}
      >
        <span className="tabular font-medium">{fmtTime(i.start)}</span> {compact ? "" : app?.company}
      </button>
    );
  };

  return (
    <>
      <PageHeader
        title="Interview calendar"
        description={`${upcoming.length} upcoming · all times ${TZ}`}
        actions={
          <>
            <Button onClick={() => downloadIcs("interviews.ics", buildIcs(interviews.filter((i) => i.status !== "cancelled"), appById))}>
              <Download className="size-4" /> Export .ics
            </Button>
            <Button variant="primary" onClick={() => setEditing(newInterview())}>
              <Plus className="size-4" /> Schedule
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => shift(-1)} aria-label="Previous">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="Next">
                <ChevronRight className="size-4" />
              </Button>
              <h2 className="ml-1 text-sm font-semibold">
                {view === "month" ? fmtMonth(monthStart) : `${fmtDayShort(weekDays[0])} – ${fmtDayShort(weekDays[6])}`}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setAnchor(TODAY)} className="ml-1">
                Today
              </Button>
            </div>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
              ]}
            />
          </div>

          {view === "month" ? (
            <div>
              <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-medium text-muted">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((d) => {
                  const inMonth = d.slice(0, 7) === monthStart.slice(0, 7);
                  const items = byDay.get(d) ?? [];
                  return (
                    <div
                      key={d}
                      onClick={() => setEditing(newInterview(d))}
                      className={clsx("min-h-20 cursor-pointer border-b border-r border-line p-1 transition-colors hover:bg-surface-2/60 sm:min-h-24 sm:p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-surface-2/40")}
                    >
                      <div className={clsx("mb-1 grid size-6 place-items-center rounded-full text-xs tabular", d === TODAY ? "bg-accent font-semibold text-accent-ink" : inMonth ? "text-ink" : "text-muted")}>
                        {Number(d.slice(8))}
                      </div>
                      <div className="space-y-0.5">
                        {items.slice(0, 2).map((i) => (
                          <div key={i.id} className="hidden sm:block">
                            <Chip i={i} />
                          </div>
                        ))}
                        {items.length > 0 && (
                          <div className="flex gap-0.5 sm:hidden">
                            {items.map((i) => (
                              <span key={i.id} className="size-1.5 rounded-full bg-accent" />
                            ))}
                          </div>
                        )}
                        {items.length > 2 && <div className="hidden px-1 text-[11px] text-muted sm:block">+{items.length - 2} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[720px] grid-cols-[56px_repeat(7,1fr)]">
                <div />
                {weekDays.map((d) => (
                  <div key={d} className="border-b border-l border-line py-2 text-center">
                    <div className="text-[11px] text-muted">{fmtDayLong(d).split(",")[0].slice(0, 3)}</div>
                    <div className={clsx("mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm tabular", d === TODAY && "bg-accent font-semibold text-accent-ink")}>{Number(d.slice(8))}</div>
                  </div>
                ))}
                <div className="relative">
                  {HOURS.map((h) => (
                    <div key={h} className="h-12 pr-2 text-right text-[11px] text-muted tabular">
                      {h % 12 || 12} {h < 12 ? "AM" : "PM"}
                    </div>
                  ))}
                </div>
                {weekDays.map((d) => (
                  <div key={d} className="relative border-l border-line" onClick={() => setEditing(newInterview(d))}>
                    {HOURS.map((h) => (
                      <div key={h} className="h-12 border-b border-line" />
                    ))}
                    {(byDay.get(d) ?? []).map((i) => {
                      const top = (klHours(i.start) - HOURS[0]) * 48;
                      const height = Math.max(22, (klHours(i.end) - klHours(i.start)) * 48 - 2);
                      const app = appById(i.applicationId);
                      return (
                        <button
                          key={i.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(i);
                          }}
                          style={{ top, height }}
                          className={clsx("absolute inset-x-1 overflow-hidden rounded-md border-l-2 bg-accent-soft px-1.5 py-1 text-left text-[11px] leading-tight", i.status === "completed" ? "border-line-strong opacity-70" : "border-accent")}
                        >
                          <div className="font-medium text-ink">{app?.company}</div>
                          <div className="text-ink-2">
                            {fmtTime(i.start)} · {i.type}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming" subtitle="Scheduled interviews, soonest first" />
          <ul className="divide-y divide-line">
            {upcoming.map((i) => {
              const app = appById(i.applicationId);
              const days = diffDays(klDay(i.start), TODAY);
              return (
                <li key={i.id}>
                  <button onClick={() => setEditing(i)} className="w-full px-5 py-3 text-left hover:bg-surface-2/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-accent">{days === 0 ? "Today" : days === 1 ? "Tomorrow" : fmtDayLong(klDay(i.start)).split(",").slice(0, 2).join(",")}</span>
                      <span className="tabular text-xs text-ink-2">
                        {fmtTime(i.start)} – {fmtTime(i.end)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium">{app?.title}</div>
                    <div className="text-xs text-ink-2">{app?.company}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Pill>{i.type}</Pill>
                      <Pill>
                        <Video className="size-3" /> {i.platform}
                      </Pill>
                      {i.calendarSynced ? (
                        <Pill tone="good">
                          <CalendarCheck2 className="size-3" /> Synced
                        </Pill>
                      ) : (
                        <Pill>Not synced</Pill>
                      )}
                    </div>
                    {i.meetingUrl && (
                      <a href={i.meetingUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                        Join link <ExternalLink className="size-3" />
                      </a>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {editing && <InterviewForm key={editing.id} initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
