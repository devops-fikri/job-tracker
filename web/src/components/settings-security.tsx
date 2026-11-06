"use client";

import { Database, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, CardHeader, Field, Input, Modal } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

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

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const problem = next.length > 0 && next.length < 12 ? "At least 12 characters" : repeat && repeat !== next ? "Passwords don't match" : null;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api("/auth/password", { method: "POST", json: { current, new: next } });
      setMsg({ ok: true, text: "Password changed. Other devices have been signed out." });
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change password"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={busy || !current || next.length < 12 || next !== repeat} onClick={save}>
            Change password
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Current password">
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" hint="At least 12 characters">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Repeat new password">
          <Input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
        {(problem || msg) && <p className={`text-sm ${msg?.ok ? "text-good-ink" : "text-critical"}`}>{msg?.text ?? problem}</p>}
      </div>
    </Modal>
  );
}

export function SecurityCard() {
  const [changing, setChanging] = useState(false);
  const [othersMsg, setOthersMsg] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title="Security" />
      <div className="divide-y divide-line border-t border-line">
        <Row label="Password" hint="Argon2id-hashed">
          <Button size="sm" onClick={() => setChanging(true)}>
            <KeyRound className="size-3.5" /> Change password
          </Button>
        </Row>
        <Row label="Active sessions" hint={othersMsg ?? "Sign out every other browser and device"}>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              try {
                const r = await api<{ signedOut: number }>("/auth/logout-others", { method: "POST" });
                setOthersMsg(r.signedOut ? `Signed out ${r.signedOut} other session${r.signedOut > 1 ? "s" : ""}` : "No other sessions were signed in");
              } catch (e) {
                setOthersMsg(errorMessage(e));
              }
            }}
          >
            Sign out others
          </Button>
        </Row>
      </div>
      {changing && <PasswordModal onClose={() => setChanging(false)} />}
    </Card>
  );
}

interface Backup {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function BackupsCard() {
  const [backups, setBackups] = useState<Backup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Backup[]>("/backups").then(setBackups, (e) => setError(errorMessage(e)));
  }, []);

  return (
    <Card>
      <CardHeader title="Backups" subtitle="Nightly pg_dump at 03:00 to ~/job-tracker/backups, newest 14 kept" />
      <div className="border-t border-line">
        {error ? (
          <p className="px-5 py-4 text-sm text-critical">{error}</p>
        ) : backups === null ? (
          <p className="px-5 py-4 text-sm text-ink-2">Loading…</p>
        ) : backups.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-4 text-sm text-ink-2">
            <Database className="size-4 shrink-0 text-muted" /> No backups yet. The first one runs tonight at 03:00.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {backups.map((b) => (
              <li key={b.name} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <Database className="size-4 shrink-0 text-muted" />
                <span className="flex-1 truncate font-mono text-xs">{b.name}</span>
                <span className="text-xs text-ink-2">{fmtDateTime(b.createdAt)}</span>
                <span className="w-16 text-right text-xs text-muted">{size(b.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
