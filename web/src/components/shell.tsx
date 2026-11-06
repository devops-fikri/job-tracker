"use client";

import clsx from "clsx";
import {
  Bot,
  Briefcase,
  CalendarDays,
  Columns3,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Moon,
  Plug,
  Search,
  Settings,
  Sun,
  UserRound,
  BellRing,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useMounted } from "@/lib/hooks";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: Briefcase },
  { href: "/kanban", label: "Kanban Board", icon: Columns3 },
  { href: "/calendar", label: "Interview Calendar", icon: CalendarDays },
  { href: "/follow-ups", label: "Follow-ups", icon: BellRing, badge: "followUpsDue" as const },
  { href: "/inbox", label: "Email & Activity", icon: Mail, badge: "reviewQueue" as const },
  { href: "/profile", label: "Career Profile", icon: UserRound },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_TABS = ["/", "/applications", "/calendar", "/follow-ups"];

const isCurrent = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { stats } = useStore();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon, badge }) => {
        const active = isCurrent(path, href);
        const n = badge ? stats[badge] : 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={clsx(
              "flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
              active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {n > 0 && <span className="tabular rounded-full bg-surface-2 px-1.5 text-xs font-medium text-ink-2">{n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-3">
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink">
        <Briefcase className="size-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">Job Tracker</span>
        <span className="block text-[11px] text-muted">Career CRM · homelab</span>
      </span>
    </Link>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const opts = [
    { v: "light", icon: Sun, label: "Light" },
    { v: "dark", icon: Moon, label: "Dark" },
    { v: "system", icon: Monitor, label: "System" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label="Theme">
      {opts.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          role="radio"
          aria-checked={mounted && theme === v}
          aria-label={label}
          title={label}
          onClick={() => setTheme(v)}
          className={clsx("grid size-7 place-items-center rounded-md", mounted && theme === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/applications?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search company or job title…"
        className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
    </form>
  );
}

function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-2 hover:bg-surface-2 disabled:opacity-60"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api("/auth/logout", { method: "POST" }).catch(() => {});
        // Hard navigation on purpose: drops all in-memory data from the signed-out session.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login");
      }}
      title="Sign out"
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const path = usePathname();

  return (
    <div className="flex min-h-dvh">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface py-4 lg:flex">
        <Brand />
        <div className="mt-6 flex-1 overflow-y-auto px-3">
          <NavLinks />
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 pt-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-xs font-semibold">MF</span>
            <span className="text-xs text-ink-2">Fikri</span>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-6">
          <button className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="hidden flex-1 sm:block">
            <GlobalSearch />
          </div>
          <div className="flex-1 sm:hidden">
            <span className="text-sm font-semibold">{NAV.find((n) => isCurrent(path, n.href))?.label}</span>
          </div>
          <SignOutButton />
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => MOBILE_TABS.includes(n.href)).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={clsx("flex flex-col items-center gap-0.5 py-2 text-[11px]", isCurrent(path, href) ? "text-accent" : "text-muted")}>
            <Icon className="size-5" />
            {label.split(" ")[0]}
          </Link>
        ))}
        <button onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted">
          <Menu className="size-5" />
          More
        </button>
      </nav>

      {/* mobile menu sheet */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface py-4 shadow-2xl">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button className="grid size-9 place-items-center rounded-lg hover:bg-surface-2" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 px-3">
              <GlobalSearch />
            </div>
            <div className="mt-4 flex-1 overflow-y-auto px-3">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="flex items-center justify-between border-t border-line px-4 pt-3">
              <span className="text-xs text-ink-2">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
