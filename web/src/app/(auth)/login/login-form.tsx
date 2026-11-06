"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";

const input =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

/** Only allow same-site relative paths as a post-login destination. */
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", json: { email: form.get("email"), password: form.get("password") } });
      window.location.assign(safeNext());
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-2">Email</span>
        <input name="email" type="email" required autoComplete="username" autoFocus className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-2">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-accent-ink hover:brightness-110 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin" />} Sign in
      </button>
    </form>
  );
}
