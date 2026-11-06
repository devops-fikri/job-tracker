"use client";

import clsx from "clsx";
import { Columns3, List, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApplicationDrawer, ApplicationForm } from "@/components/applications";
import { Button, PageHeader, Segmented, StatusBadge } from "@/components/ui";
import { fmtDayShort, relative } from "@/lib/format";
import { STAGES, STATUS_BY_ID } from "@/lib/statuses";
import { blankApplication, useStore } from "@/lib/store";
import type { Application, StageId } from "@/lib/types";

export default function KanbanPage() {
  const router = useRouter();
  const { applications, dispatch } = useStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<StageId | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Application | null>(null);

  const columns = STAGES.map((stage) => ({
    ...stage,
    items: applications.filter((a) => STATUS_BY_ID[a.status].stage === stage.id).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)),
  }));

  const drop = (stage: (typeof STAGES)[number]) => {
    const app = applications.find((a) => a.id === dragId);
    if (app && STATUS_BY_ID[app.status].stage !== stage.id) dispatch({ type: "setStatus", id: app.id, status: stage.dropStatus });
    setDragId(null);
    setOver(null);
  };

  return (
    <>
      <PageHeader
        title="Kanban board"
        description="Drag a card to move it between stages. Open a card to set the exact status."
        actions={
          <>
            <Segmented
              value="kanban"
              onChange={(v) => v === "list" && router.push("/applications")}
              options={[
                { value: "list", label: <><List className="size-3.5" /> List</> },
                { value: "kanban", label: <><Columns3 className="size-3.5" /> Kanban</> },
              ]}
            />
            <Button variant="primary" onClick={() => setCreating(blankApplication())}>
              <Plus className="size-4" /> Add
            </Button>
          </>
        }
      />

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        {columns.map((col) => (
          <section
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
            onDrop={() => drop(col)}
            className={clsx(
              "flex w-[280px] shrink-0 snap-start flex-col rounded-xl border bg-surface-2/50 transition-colors",
              over === col.id ? "border-accent bg-accent-soft/40" : "border-line",
            )}
          >
            <header className="flex items-center justify-between px-3 py-2.5">
              <h2 className="text-sm font-semibold">{col.label}</h2>
              <span className="tabular rounded-full bg-surface px-2 text-xs font-medium text-ink-2">{col.items.length}</span>
            </header>
            <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
              {col.items.map((a) => (
                <article
                  key={a.id}
                  draggable
                  onDragStart={() => setDragId(a.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  onClick={() => setOpenId(a.id)}
                  className={clsx(
                    "cursor-pointer rounded-lg border border-line bg-surface p-3 shadow-sm transition hover:border-line-strong",
                    dragId === a.id && "opacity-40",
                  )}
                >
                  <div className="text-sm font-medium leading-snug">{a.title}</div>
                  <div className="mt-0.5 text-xs text-ink-2">{a.company}</div>
                  <div className="mt-2.5">
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
                    <span>
                      {a.platform} · {fmtDayShort(a.appliedAt)}
                    </span>
                    <span>{relative(a.updatedAt)}</span>
                  </div>
                </article>
              ))}
              {col.items.length === 0 && <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line py-6 text-xs text-muted">Drop here</div>}
            </div>
          </section>
        ))}
      </div>

      <ApplicationDrawer key={openId} id={openId} onClose={() => setOpenId(null)} />
      {creating && <ApplicationForm open initial={creating} onClose={() => setCreating(null)} />}
    </>
  );
}
