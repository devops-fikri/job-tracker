"use client";

import { ArrowDownUp, Briefcase, Columns3, Download, List, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ApplicationDrawer, ApplicationForm } from "@/components/applications";
import { Button, Card, EmptyState, Input, PageHeader, Segmented, Select, StatusBadge } from "@/components/ui";
import { fmtDay, relative } from "@/lib/format";
import { AWAITING, PLATFORMS, STAGES, STATUSES, STATUS_BY_ID } from "@/lib/statuses";
import { blankApplication, useStore } from "@/lib/store";
import type { Application } from "@/lib/types";

type Sort = "applied_desc" | "applied_asc" | "activity_desc";

function ApplicationsView({ initialQ, initialStatus, openNew }: { initialQ: string; initialStatus: string; openNew: boolean }) {
  const router = useRouter();
  const { applications } = useStore();

  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [platform, setPlatform] = useState("all");
  const [location, setLocation] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("activity_desc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Application | null>(() => (openNew ? blankApplication() : null));

  const locations = useMemo(() => [...new Set(applications.map((a) => a.location).filter(Boolean))].sort(), [applications]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return applications
      .filter((a) => !needle || a.company.toLowerCase().includes(needle) || a.title.toLowerCase().includes(needle))
      .filter((a) =>
        status === "all" ? true : status === "awaiting" ? AWAITING.includes(a.status) : status.startsWith("stage:") ? STATUS_BY_ID[a.status].stage === status.slice(6) : a.status === status,
      )
      .filter((a) => platform === "all" || a.platform === platform)
      .filter((a) => location === "all" || a.location === location)
      .filter((a) => (!from || a.appliedAt >= from) && (!to || a.appliedAt <= to))
      .sort((x, y) =>
        sort === "applied_asc" ? x.appliedAt.localeCompare(y.appliedAt) : sort === "applied_desc" ? y.appliedAt.localeCompare(x.appliedAt) : y.updatedAt.localeCompare(x.updatedAt),
      );
  }, [applications, q, status, platform, location, from, to, sort]);

  const filtered = q || status !== "all" || platform !== "all" || location !== "all" || from || to;
  const clear = () => {
    setQ("");
    setStatus("all");
    setPlatform("all");
    setLocation("all");
    setFrom("");
    setTo("");
  };

  return (
    <>
      <PageHeader
        title="Applications"
        description={`${applications.length} tracked · ${rows.length} shown`}
        actions={
          <>
            <Segmented
              value="list"
              onChange={(v) => v === "kanban" && router.push("/kanban")}
              options={[
                { value: "list", label: <><List className="size-3.5" /> List</> },
                { value: "kanban", label: <><Columns3 className="size-3.5" /> Kanban</> },
              ]}
            />
            <a
              href="/api/export/applications.csv"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
            >
              <Download className="size-4" /> Export CSV
            </a>
            <Button variant="primary" onClick={() => setCreating(blankApplication())}>
              <Plus className="size-4" /> Add application
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.6fr)_repeat(3,minmax(0,1fr))_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company or job title" className="pl-9" aria-label="Search" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
            <option value="all">All statuses</option>
            <option value="awaiting">Awaiting response</option>
            <optgroup label="Stage">
              {STAGES.map((s) => (
                <option key={s.id} value={`stage:${s.id}`}>
                  {s.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Status">
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          </Select>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform filter">
            <option value="all">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location filter">
            <option value="all">All locations</option>
            {locations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Applied from" title="Applied from" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Applied to" title="Applied to" />
          <div className="relative">
            <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="pl-8" aria-label="Sort">
              <option value="activity_desc">Latest activity</option>
              <option value="applied_desc">Newest applied</option>
              <option value="applied_asc">Oldest applied</option>
            </Select>
          </div>
        </div>
        {filtered && (
          <button onClick={clear} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink">
            <X className="size-3" /> Clear filters
          </button>
        )}
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Briefcase className="size-5" />}
            title="No applications match"
            body="Try a different search or clear the filters."
            action={<Button onClick={clear}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <>
          {/* desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Company & role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Platform</th>
                  <th className="hidden px-4 py-2.5 font-medium xl:table-cell">Location</th>
                  <th className="px-4 py-2.5 font-medium">Applied</th>
                  <th className="px-4 py-2.5 text-right font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => (
                  <tr key={a.id} onClick={() => setOpenId(a.id)} className="cursor-pointer hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{a.company}</div>
                      <div className="text-xs text-ink-2">{a.title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-2">{a.platform}</td>
                    <td className="hidden px-4 py-3 text-ink-2 xl:table-cell">
                      {a.location} <span className="text-muted">· {a.workArrangement}</span>
                    </td>
                    <td className="tabular px-4 py-3 text-ink-2">{fmtDay(a.appliedAt)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted">{relative(a.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* mobile cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((a) => (
              <li key={a.id}>
                <button onClick={() => setOpenId(a.id)} className="w-full rounded-xl border border-line bg-surface p-4 text-left active:bg-surface-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.company}</div>
                      <div className="truncate text-sm text-ink-2">{a.title}</div>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{relative(a.updatedAt)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <StatusBadge status={a.status} />
                    <span>{a.platform}</span>·<span>{fmtDay(a.appliedAt)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs text-muted">
        Prefer a board? <Link href="/kanban" className="font-medium text-accent hover:underline">Open the Kanban view</Link>.
      </p>

      <ApplicationDrawer key={openId} id={openId} onClose={() => setOpenId(null)} />
      {creating && (
        <ApplicationForm
          open
          initial={creating}
          onClose={() => {
            setCreating(null);
            if (openNew) router.replace("/applications");
          }}
        />
      )}
    </>
  );
}

/** Keyed on the query string so a new header search re-initialises the filters. */
function ApplicationsRoute() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const openNew = params.has("new");
  return <ApplicationsView key={params.toString()} initialQ={q} initialStatus={status} openNew={openNew} />;
}

export default function ApplicationsPage() {
  return (
    <Suspense>
      <ApplicationsRoute />
    </Suspense>
  );
}
