"use client";

import { ArrowRight, BellRing, Bot, CalendarClock, Inbox, Mail, Plug, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ChartCard, ColumnChart, HBarChart, SegmentedBar, Sparkline } from "@/components/charts";
import { Card, CardHeader, PageHeader, Pill, SourceTag } from "@/components/ui";
import { addDays, diffDays, fmtDayShort, fmtDateTime, relative, TODAY, weekday, fmtTime, klDay } from "@/lib/format";
import { PLATFORMS, STATUSES, STATUS_BY_ID } from "@/lib/statuses";
import { useStore } from "@/lib/store";

const WEEKS = 10;

function StatTile({ label, value, sub, trend, href }: { label: string; value: ReactNode; sub?: ReactNode; trend?: number[]; href?: string }) {
  const body = (
    <Card className="h-full p-4 transition-colors hover:border-line-strong">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{value}</div>
        {trend && <Sparkline values={trend} />}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-accent">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function DashboardPage() {
  const { applications, stats, funnel, upcoming, pendingFollowUps, activity, appById } = useStore();
  const submitted = applications.filter((a) => STATUS_BY_ID[a.status].stage !== "wishlist");

  const weekly = useMemo(() => {
    const thisMonday = addDays(TODAY, -((weekday(TODAY) + 6) % 7));
    return Array.from({ length: WEEKS }, (_, i) => {
      const start = addDays(thisMonday, -7 * (WEEKS - 1 - i));
      const end = addDays(start, 6);
      const value = submitted.filter((a) => a.appliedAt >= start && a.appliedAt <= end).length;
      return { label: fmtDayShort(start), value, tooltipLabel: `Week of ${fmtDayShort(start)}` };
    });
  }, [submitted]);

  const byStatus = STATUSES.map((s) => ({ label: s.label, value: applications.filter((a) => a.status === s.id).length })).filter((d) => d.value > 0);
  const byPlatform = PLATFORMS.map((p) => ({ label: p, value: submitted.filter((a) => a.platform === p).length }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const outcome = [
    { label: "Active", value: stats.inProgress - stats.offers },
    { label: "Offer", value: submitted.filter((a) => ["offer_received", "offer_accepted"].includes(a.status)).length },
    { label: "Rejected", value: stats.rejected },
    { label: "Withdrawn / declined", value: submitted.filter((a) => ["withdrawn", "offer_rejected"].includes(a.status)).length },
    { label: "No response", value: submitted.filter((a) => a.status === "ghosted").length },
  ];

  const interviewRate = funnel[0].value ? Math.round((funnel[2].value / funnel[0].value) * 100) : 0;
  const next = upcoming[0];

  return (
    <>
      <PageHeader
        title="Good morning, Fikri"
        description={`${fmtDayShort(TODAY)} · ${stats.inProgress} active applications · ${stats.interviewsScheduled} interviews coming up`}
        actions={
          <Link href="/applications?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-ink hover:brightness-110">
            + Add application
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Applications submitted" value={stats.total} trend={weekly.map((w) => w.value)} sub={`${weekly.at(-1)?.value ?? 0} this week`} href="/applications" />
        <StatTile label="In progress" value={stats.inProgress} sub="Applied → offer stages" href="/kanban" />
        <StatTile label="Interviews scheduled" value={stats.interviewsScheduled} sub={next ? `Next: ${fmtDateTime(next.start)}` : "None scheduled"} href="/calendar" />
        <StatTile label="Offers received" value={stats.offers} sub="Awaiting your decision" />
        <StatTile label="Awaiting response" value={stats.awaiting} sub="Applied, received or under review" href="/applications?status=awaiting" />
        <StatTile label="Rejected" value={stats.rejected} />
        <StatTile label="Need follow-up" value={stats.followUpsDue} sub={`${pendingFollowUps.length} pending in total`} href="/follow-ups" />
        <StatTile label="Interview rate" value={`${interviewRate}%`} sub={`${funnel[2].value} of ${funnel[0].value} reached interview`} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Upcoming interviews"
            subtitle="Times shown in Asia/Kuala_Lumpur"
            action={
              <Link href="/calendar" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                Calendar <ArrowRight className="size-3" />
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {upcoming.slice(0, 4).map((i) => {
              const app = appById(i.applicationId);
              const days = diffDays(klDay(i.start), TODAY);
              return (
                <li key={i.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-[11px] font-medium uppercase text-muted">{fmtDayShort(klDay(i.start)).split(" ")[1]}</div>
                    <div className="text-xl font-semibold leading-none">{fmtDayShort(klDay(i.start)).split(" ")[0]}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{app?.title}</div>
                    <div className="truncate text-xs text-ink-2">
                      {app?.company} · {i.type} · {i.platform}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular text-sm font-medium">{fmtTime(i.start)}</div>
                    <div className="text-xs text-muted">{days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`}</div>
                  </div>
                </li>
              );
            })}
            {!upcoming.length && <li className="px-5 py-8 text-center text-sm text-muted">No upcoming interviews</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Follow-ups needed"
            subtitle="Based on your follow-up rules"
            action={
              <Link href="/follow-ups" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                All <ArrowRight className="size-3" />
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {pendingFollowUps.slice(0, 4).map((f) => {
              const app = appById(f.applicationId);
              const overdue = f.due < TODAY;
              return (
                <li key={f.id} className="flex items-start gap-3 px-5 py-3">
                  <BellRing className="mt-0.5 size-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{app?.company}</div>
                    <div className="truncate text-xs text-ink-2">{f.reason}</div>
                  </div>
                  <Pill tone={overdue ? "critical" : f.due === TODAY ? "warning" : "neutral"}>{overdue ? "Overdue" : f.due === TODAY ? "Today" : fmtDayShort(f.due)}</Pill>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Applications submitted per week"
          subtitle={`Last ${WEEKS} weeks`}
          table={{ columns: ["Week of", "Applications"], rows: weekly.map((w) => [w.label, w.value]) }}
        >
          <ColumnChart data={weekly} />
        </ChartCard>
        <ChartCard
          title="Conversion funnel"
          subtitle={`${interviewRate}% of applications reached an interview`}
          table={{ columns: ["Stage", "Applications", "% of applied"], rows: funnel.map((f) => [f.stage, f.value, `${Math.round((f.value / (funnel[0].value || 1)) * 100)}%`]) }}
        >
          <HBarChart data={funnel.map((f) => ({ label: f.stage, value: f.value }))} ordinal />
        </ChartCard>
        <ChartCard title="Applications by status" subtitle="Current status of every application" table={{ columns: ["Status", "Applications"], rows: byStatus.map((d) => [d.label, d.value]) }}>
          <HBarChart data={byStatus} />
        </ChartCard>
        <div className="grid gap-4">
          <ChartCard title="Applications by platform" subtitle="Where you applied" table={{ columns: ["Platform", "Applications"], rows: byPlatform.map((d) => [d.label, d.value]) }}>
            <HBarChart data={byPlatform} />
          </ChartCard>
          <ChartCard title="Outcomes" subtitle={`All ${stats.total} submitted applications`} table={{ columns: ["Outcome", "Applications"], rows: outcome.map((d) => [d.label, d.value]) }}>
            <SegmentedBar parts={outcome} />
          </ChartCard>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent activity"
            subtitle="Everything detected or changed, newest first"
            action={
              <Link href="/inbox" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                Email & activity <ArrowRight className="size-3" />
              </Link>
            }
          />
          <ol className="px-5 pb-4">
            {activity.slice(0, 8).map((a) => (
              <li key={a.id} className="relative flex gap-3 border-l border-line pb-4 pl-5 last:pb-0">
                <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-line-strong" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <span className="font-medium">{a.company}</span> <span className="text-ink-2">· {a.event.title}</span>
                  </div>
                  <div className="truncate text-xs text-muted">
                    {a.role}
                    {a.event.detail ? ` · ${a.event.detail}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted">{relative(a.at)}</span>
                  <SourceTag source={a.event.source} />
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader title="Integration health" subtitle="Live connection status" action={<Plug className="size-4 text-muted" />} />
          <ul className="divide-y divide-line">
            {[
              { name: "Gmail", icon: Mail },
              { name: "Google Calendar", icon: CalendarClock },
              { name: "Telegram", icon: Inbox },
              { name: "Hermes AI", icon: Bot },
            ].map(({ name, icon: Icon }) => (
              <li key={name} className="flex items-center gap-3 px-5 py-3">
                <Icon className="size-4 text-muted" />
                <span className="flex-1 text-sm">{name}</span>
                <Pill>Not connected</Pill>
              </li>
            ))}
          </ul>
          <div className="px-5 pb-4 pt-1">
            <Link href="/integrations" className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              <Sparkles className="size-3" /> Set up integrations
            </Link>
          </div>
        </Card>
      </section>

    </>
  );
}
