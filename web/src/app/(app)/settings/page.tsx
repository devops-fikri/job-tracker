"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { BackupsCard, SecurityCard } from "@/components/settings-security";
import { ThemeToggle } from "@/components/shell";
import { Button, Card, CardHeader, Input, PageHeader, Select, StatusBadge, Toggle } from "@/components/ui";
import { STATUSES } from "@/lib/statuses";

const NOTIFICATIONS = [
  "New application detected",
  "Interview invitation received",
  "Interview scheduled",
  "Interview reminder",
  "Interview rescheduled",
  "Recruiter response received",
  "Application rejected",
  "Job offer received",
  "Follow-up reminder",
  "Gmail synchronisation failure",
];

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-ink-2">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [notify, setNotify] = useState<Record<string, boolean>>(Object.fromEntries(NOTIFICATIONS.map((n) => [n, true])));
  const [reminders, setReminders] = useState([1440, 60, 15]);
  const [newReminder, setNewReminder] = useState("");
  const label = (m: number) => (m >= 1440 ? `${m / 1440} day${m > 1440 ? "s" : ""}` : m >= 60 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${m} min`);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="General" subtitle="Not saved yet: these preferences get stored in Phase 3" />
          <div className="divide-y divide-line border-t border-line">
            <Row label="Appearance" hint="Light, dark, or follow your device">
              <ThemeToggle />
            </Row>
            <Row label="Time zone" hint="Used for reminders and the calendar">
              <Select defaultValue="Asia/Kuala_Lumpur" className="w-56">
                <option>Asia/Kuala_Lumpur</option>
                <option>Asia/Singapore</option>
                <option>UTC</option>
              </Select>
            </Row>
            <Row label="Gmail labels to monitor" hint="Only these labels are scanned">
              <Input defaultValue="INBOX, Jobs" className="w-56" />
            </Row>
          </div>
        </Card>

        <Card>
          <CardHeader title="Interview reminders" subtitle="Sent on Telegram before each interview" />
          <div className="border-t border-line px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {reminders
                .slice()
                .sort((a, b) => b - a)
                .map((m) => (
                  <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-sm">
                    {label(m)} before
                    <button onClick={() => setReminders(reminders.filter((x) => x !== m))} aria-label={`Remove ${label(m)}`} className="text-muted hover:text-ink">
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(newReminder);
                if (n > 0 && !reminders.includes(n)) setReminders([...reminders, n]);
                setNewReminder("");
              }}
            >
              <Input type="number" min={1} value={newReminder} onChange={(e) => setNewReminder(e.target.value)} placeholder="Minutes before, e.g. 30" className="max-w-56" />
              <Button type="submit">
                <Plus className="size-4" /> Add
              </Button>
            </form>
          </div>
        </Card>

        <Card>
          <CardHeader title="Telegram notifications" subtitle="Not active yet: Telegram arrives in Phase 3" />
          <div className="divide-y divide-line border-t border-line">
            {NOTIFICATIONS.map((n) => (
              <div key={n} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm">{n}</span>
                <Toggle label={n} checked={notify[n]} onChange={(v) => setNotify((p) => ({ ...p, [n]: v }))} />
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Application statuses" subtitle="Built-in statuses used across the app" />
            <div className="flex flex-wrap gap-1.5 border-t border-line px-5 py-4">
              {STATUSES.map((s) => (
                <StatusBadge key={s.id} status={s.id} />
              ))}
            </div>
          </Card>

          <SecurityCard />

          <BackupsCard />
        </div>
      </div>
    </>
  );
}
