export const TZ = "Asia/Kuala_Lumpur";

const parts = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, x) => ((acc[x.type] = x.value), acc), {});
  return `${p.year}-${p.month}-${p.day}`;
};

/** ISO timestamp -> YYYY-MM-DD in Kuala Lumpur time. */
export const klDay = (iso: string) => parts(new Date(iso));

/**
 * "Now" for all date maths. Live ES bindings: the store calls setClock() with the server's
 * time on every refresh, so a tab left open past midnight still rolls over to the new day.
 * Pages only render after the first load, so server and browser never disagree.
 */
export let NOW = new Date();
export let TODAY = parts(NOW);
let skewMs = 0;

export function setClock(serverNowIso?: string) {
  if (serverNowIso) skewMs = Date.parse(serverNowIso) - Date.now();
  NOW = new Date(Date.now() + skewMs);
  TODAY = parts(NOW);
}

/** Calendar arithmetic on YYYY-MM-DD strings (timezone-free). */
export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diffDays = (a: string, b: string) =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
export const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sun

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-MY", { timeZone: TZ, ...opts });
const dayFmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-MY", { timeZone: "UTC", ...opts });

export const fmtDay = (day: string) => dayFmt({ day: "numeric", month: "short", year: "numeric" }).format(new Date(`${day}T00:00:00Z`));
export const fmtDayShort = (day: string) => dayFmt({ day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00Z`));
export const fmtDayLong = (day: string) =>
  dayFmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${day}T00:00:00Z`));
export const fmtMonth = (day: string) => dayFmt({ month: "long", year: "numeric" }).format(new Date(`${day}T00:00:00Z`));
export const fmtTime = (iso: string) => fmt({ hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
export const fmtDateTime = (iso: string) =>
  fmt({ day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

export const relative = (iso: string) => {
  const mins = Math.round((NOW.getTime() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDayShort(klDay(iso));
};

/** Hours (0-24, fractional) of an ISO instant in KL time. */
export const klHours = (iso: string) => {
  const p = fmt({ hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(iso));
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24;
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h + m / 60;
};

export const money = (n: number, currency = "MYR") =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export const salaryRange = (min?: number, max?: number, currency = "MYR") => {
  if (!min && !max) return "—";
  if (min && max) return `${money(min, currency)} – ${money(max, currency).replace(/^[^\d]+/, "")}`;
  return money((min ?? max)!, currency);
};

/**
 * 32-char hex id. Uses getRandomValues, not randomUUID: randomUUID only exists in secure
 * contexts (HTTPS/localhost) and the app is served over plain HTTP on the tailnet.
 */
export const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
