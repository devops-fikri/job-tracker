"use client";

import { Bot, KeyRound, Lock, MessageCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader, PageHeader, Pill, Toggle } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { useStore } from "@/lib/store";

const TOOLS = [
  { name: "get_statistics", desc: "Application counts and pipeline summary", kind: "read" },
  { name: "search_applications", desc: "Search by company, title, status or age", kind: "read" },
  { name: "list_interviews", desc: "Upcoming and past interviews", kind: "read" },
  { name: "get_application_history", desc: "Timeline and recruiter communications", kind: "read" },
  { name: "get_profile", desc: "Your career profile (for prep and JD analysis)", kind: "read" },
  { name: "add_note", desc: "Append a note to an application", kind: "write" },
  { name: "create_followup", desc: "Create a follow-up reminder", kind: "write" },
  { name: "update_status", desc: "Change an application's status (asks you first)", kind: "write" },
];

const EXAMPLES = [
  "How many jobs have I applied for?",
  "Do I have any interviews next week?",
  "Show me applications pending for more than 14 days",
  "Add a follow-up reminder for ABC Technologies tomorrow",
  "Help me prepare for my ABC Technologies interview",
];

export default function AssistantPage() {
  const { audit } = useStore();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(TOOLS.map((t) => [t.name, true])));

  return (
    <>
      <PageHeader title="AI assistant" description="Hermes talks to the tracker through an authenticated MCP server. You chat with it on Telegram as usual." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Connection" subtitle="Hermes Agent v0.22.7 on this host" action={<Pill>Not connected</Pill>} />
          <div className="space-y-4 px-5 pb-5">
            <div className="flex gap-3 rounded-lg border border-line bg-surface-2/50 p-4">
              <Bot className="mt-0.5 size-5 shrink-0 text-accent" />
              <div className="text-sm text-ink-2">
                Connecting adds one entry to <code className="rounded bg-surface px-1 text-xs">~/.hermes/config.yaml</code> under <code className="rounded bg-surface px-1 text-xs">mcp_servers</code> pointing at this app&apos;s
                <code className="mx-1 rounded bg-surface px-1 text-xs">/mcp</code> endpoint with a scoped bearer token. Nothing else in your Hermes setup changes, and you&apos;ll see the diff before it&apos;s applied.
              </div>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-line bg-bg p-4 text-xs leading-relaxed text-ink-2">
{`mcp_servers:
  job_tracker:
    url: "http://127.0.0.1:<api-port>/mcp"
    headers:
      Authorization: "Bearer \${JOB_TRACKER_MCP_TOKEN}"
    timeout: 30`}
            </pre>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: KeyRound, title: "Scoped token", body: "Separate from your login; revocable any time" },
                { icon: ShieldCheck, title: "Confirm first", body: "Status changes and deletes ask you on Telegram" },
                { icon: Lock, title: "No secrets", body: "OAuth tokens and keys never reach the model" },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border border-line p-3">
                  <Icon className="size-4 text-muted" />
                  <div className="mt-2 text-sm font-medium">{title}</div>
                  <div className="text-xs text-ink-2">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Try asking Hermes" subtitle="On Telegram, once connected" action={<MessageCircle className="size-4 text-muted" />} />
          <ul className="space-y-2 px-5 pb-5">
            {EXAMPLES.map((e) => (
              <li key={e} className="rounded-lg rounded-tl-sm border border-line bg-surface-2/50 px-3 py-2 text-sm text-ink-2">
                {e}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Tools exposed to Hermes" subtitle="Turn off anything you don't want the assistant to use" />
          <ul className="divide-y divide-line border-t border-line">
            {TOOLS.map((t) => (
              <li key={t.name} className="flex items-center gap-3 px-5 py-3">
                <code className="w-48 shrink-0 truncate text-xs text-ink">{t.name}</code>
                <span className="flex-1 text-sm text-ink-2">{t.desc}</span>
                <Pill tone={t.kind === "write" ? "warning" : "neutral"}>{t.kind}</Pill>
                <Toggle label={t.name} checked={enabled[t.name]} onChange={(v) => setEnabled((p) => ({ ...p, [t.name]: v }))} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="AI audit log" subtitle="Every tool call Hermes makes" />
          <ul className="divide-y divide-line border-t border-line">
            {audit.map((a) => (
              <li key={a.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs">{a.tool}</code>
                  {a.kind === "write" ? <Pill tone={a.approved ? "good" : "critical"}>{a.approved ? "Approved" : "Declined"}</Pill> : <Pill>read</Pill>}
                </div>
                <div className="mt-1 text-sm text-ink-2">{a.summary}</div>
                <div className="mt-0.5 text-xs text-muted">{fmtDateTime(a.at)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
