"use client";

import { Bot, CalendarDays, FileSpreadsheet, Forward, Globe, Mail, Send, type LucideIcon } from "lucide-react";
import { Button, Card, PageHeader, Pill, Toggle } from "@/components/ui";

interface Integration {
  name: string;
  icon: LucideIcon;
  how: string;
  detail: string;
  phase: number;
  official: boolean;
}

const INTEGRATIONS: Integration[] = [
  { name: "Gmail", icon: Mail, how: "Gmail API · OAuth 2.0 (read-only)", detail: "Detects confirmations, interviews, assessments, rejections and offers. Incremental sync via history IDs.", phase: 2, official: true },
  { name: "Google Calendar", icon: CalendarDays, how: "Calendar API · OAuth 2.0", detail: "Two-way sync of interview events with stable IDs, so nothing is duplicated.", phase: 3, official: true },
  { name: "Telegram", icon: Send, how: "Telegram Bot API", detail: "Interview reminders, new-application alerts and sync failures.", phase: 3, official: true },
  { name: "Hermes AI", icon: Bot, how: "MCP over HTTP · bearer token", detail: "Lets Hermes read stats, search applications and create follow-ups.", phase: 4, official: true },
  { name: "LinkedIn", icon: Globe, how: "Via Gmail notification emails", detail: "LinkedIn has no applicant API. Application and status emails are parsed instead.", phase: 2, official: false },
  { name: "Indeed", icon: Globe, how: "Via Gmail notification emails", detail: "No public applicant API. Confirmation and update emails are parsed.", phase: 2, official: false },
  { name: "JobStreet", icon: Globe, how: "Via Gmail notification emails", detail: "No public applicant API. Confirmation and recruiter emails are parsed.", phase: 2, official: false },
  { name: "Company career portals", icon: Forward, how: "Workday · Greenhouse · Lever · SmartRecruiters emails", detail: "Parsed from ATS emails; you can also forward emails to your monitored label.", phase: 2, official: false },
  { name: "CSV import", icon: FileSpreadsheet, how: "Upload a spreadsheet", detail: "Bulk-import past applications (company, title, date, status, platform).", phase: 5, official: true },
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader title="Integrations" description="Connection status is live: nothing is connected until you complete each setup." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map(({ name, icon: Icon, how, detail, phase, official }) => (
          <Card key={name} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-surface-2">
                  <Icon className="size-5 text-ink-2" />
                </span>
                <div>
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-ink-2">{how}</div>
                </div>
              </div>
              <Pill>Not connected</Pill>
            </div>
            <p className="mt-3 flex-1 text-sm text-ink-2">{detail}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted">Last sync</dt>
                <dd className="text-ink-2">Never</dd>
              </div>
              <div>
                <dt className="text-muted">Last error</dt>
                <dd className="text-ink-2">—</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
              <label className="flex items-center gap-2 text-xs text-ink-2">
                <Toggle label={`Sync ${name}`} checked={false} onChange={() => {}} /> Sync
              </label>
              <Button size="sm" disabled title={`Available in Phase ${phase}`}>
                {official ? "Connect" : "Set up"} · Phase {phase}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
