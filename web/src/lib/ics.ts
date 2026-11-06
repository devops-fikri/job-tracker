import type { Application, Interview } from "./types";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** RFC 5545 calendar. UIDs are stable per interview so re-imports update instead of duplicating. */
export function buildIcs(interviews: Interview[], appById: (id: string) => Application | undefined) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Job Tracker//Interviews//EN", "CALSCALE:GREGORIAN"];
  for (const i of interviews) {
    const app = appById(i.applicationId);
    const where = i.meetingUrl ?? i.location ?? i.platform;
    lines.push(
      "BEGIN:VEVENT",
      `UID:interview-${i.id}@job-tracker`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(i.start)}`,
      `DTEND:${stamp(i.end)}`,
      `SUMMARY:${esc(`${i.type} interview – ${app?.title ?? ""} @ ${app?.company ?? ""}`)}`,
      `LOCATION:${esc(where)}`,
      `DESCRIPTION:${esc([`Interviewers: ${i.interviewers}`, i.prepNotes].filter(Boolean).join("\n"))}`,
      `STATUS:${i.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
