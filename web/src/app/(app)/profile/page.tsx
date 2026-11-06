"use client";

import { Download, FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, CardHeader, Field, Input, PageHeader, Pill, Select, Textarea } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { fmtDateTime, fmtDay, klDay } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { WorkArrangement } from "@/lib/types";

interface Experience {
  company: string;
  role: string;
  start: string;
  end: string;
  highlights: string;
}

interface Education {
  institution: string;
  qualification: string;
  year: string;
}

interface Profile {
  fullName: string;
  headline: string;
  currentPosition: string;
  summary: string;
  skills: string[];
  certifications: string[];
  experience: Experience[];
  education: Education[];
  preferredLocations: string[];
  careerInterests: string;
  expectedSalary: number | null;
  noticePeriod: string;
  workArrangements: WorkArrangement[];
  updatedAt?: string | null;
}

const NOTICE = ["Immediate", "2 weeks", "1 month", "2 months", "3 months"];
const ARRANGEMENTS: WorkArrangement[] = ["Remote", "Hybrid", "On-site"];
const blankRole = (): Experience => ({ company: "", role: "", start: "", end: "", highlights: "" });
const blankEdu = (): Education => ({ institution: "", qualification: "", year: "" });

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-critical">
      <Trash2 className="size-4" />
    </button>
  );
}

function TagEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <Field label={label}>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface p-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-xs">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="text-muted hover:text-ink">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              if (!values.includes(draft.trim())) onChange([...values, draft.trim()]);
              setDraft("");
            }
          }}
          placeholder="Type and press Enter"
          className="min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted"
        />
      </div>
    </Field>
  );
}

export default function ProfilePage() {
  const { resumes, applications, refresh, reportError } = useStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      await api("/resumes", { method: "POST", body });
      await refresh();
    } catch (e) {
      reportError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? Applications using it will keep their data but lose the link.`)) return;
    try {
      await api(`/resumes/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      reportError(errorMessage(e));
    }
  }

  useEffect(() => {
    api<Profile>("/profile").then(
      (p) => {
        setProfile(p);
        setSaved(JSON.stringify({ ...p, updatedAt: undefined }));
      },
      (e) => setLoadError(errorMessage(e)),
    );
  }, []);

  const dirty = profile !== null && JSON.stringify({ ...profile, updatedAt: undefined }) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile((p) => (p ? { ...p, [k]: v } : p));
  const setRole = (i: number, patch: Partial<Experience>) => set("experience", profile!.experience.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setEdu = (i: number, patch: Partial<Education>) => set("education", profile!.education.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const p = await api<Profile>("/profile", { method: "PUT", json: profile });
      setProfile(p);
      setSaved(JSON.stringify({ ...p, updatedAt: undefined }));
    } catch (e) {
      reportError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Career profile"
        description="Hermes uses this when preparing you for interviews, analysing job descriptions and drafting replies."
        actions={
          <>
            {profile && (
              <span className="text-xs text-muted">
                {dirty ? "Unsaved changes" : profile.updatedAt ? `Saved ${fmtDateTime(profile.updatedAt)}` : "Not saved yet"}
              </span>
            )}
            <Button variant="primary" disabled={!dirty || saving} onClick={save}>
              {saving && <Loader2 className="size-4 animate-spin" />} Save profile
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {!profile ? (
          <Card className="p-5 text-sm text-ink-2">{loadError ? <span className="text-critical">{loadError}</span> : "Loading profile…"}</Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold">About you</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input value={profile.fullName} onChange={(e) => set("fullName", e.target.value)} />
                </Field>
                <Field label="Professional headline">
                  <Input value={profile.headline} placeholder="e.g. Cloud & Network Security Engineer" onChange={(e) => set("headline", e.target.value)} />
                </Field>
                <Field label="Current position" className="sm:col-span-2">
                  <Input value={profile.currentPosition} onChange={(e) => set("currentPosition", e.target.value)} />
                </Field>
                <Field label="Professional summary" className="sm:col-span-2">
                  <Textarea rows={4} value={profile.summary} onChange={(e) => set("summary", e.target.value)} />
                </Field>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold">Skills & credentials</h2>
              <div className="grid gap-4">
                <TagEditor label="Technical skills" values={profile.skills} onChange={(v) => set("skills", v)} />
                <TagEditor label="Certifications" values={profile.certifications} onChange={(v) => set("certifications", v)} />
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Work experience</h2>
                <Button size="sm" onClick={() => set("experience", [...profile.experience, blankRole()])}>
                  <Plus className="size-3.5" /> Add role
                </Button>
              </div>
              {profile.experience.length === 0 && <p className="text-sm text-ink-2">No roles yet. Use “Add role” to add one.</p>}
              <div className="space-y-3">
                {profile.experience.map((r, i) => (
                  <div key={i} className="grid gap-4 rounded-lg border border-line p-4 sm:grid-cols-2">
                    <Field label="Company">
                      <Input value={r.company} placeholder="Company name" onChange={(e) => setRole(i, { company: e.target.value })} />
                    </Field>
                    <Field label="Role">
                      <div className="flex gap-1">
                        <Input value={r.role} placeholder="Job title" onChange={(e) => setRole(i, { role: e.target.value })} />
                        <RemoveButton label="Remove role" onClick={() => set("experience", profile.experience.filter((_, j) => j !== i))} />
                      </div>
                    </Field>
                    <Field label="From">
                      <Input type="month" value={r.start} onChange={(e) => setRole(i, { start: e.target.value })} />
                    </Field>
                    <Field label="To" hint="Leave empty if this is your current role">
                      <Input type="month" value={r.end} onChange={(e) => setRole(i, { end: e.target.value })} />
                    </Field>
                    <Field label="Highlights" className="sm:col-span-2">
                      <Textarea rows={3} value={r.highlights} placeholder="Key achievements, one per line" onChange={(e) => setRole(i, { highlights: e.target.value })} />
                    </Field>
                  </div>
                ))}
              </div>

              <div className="mb-3 mt-6 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Education</h2>
                <Button size="sm" onClick={() => set("education", [...profile.education, blankEdu()])}>
                  <Plus className="size-3.5" /> Add education
                </Button>
              </div>
              {profile.education.length === 0 && <p className="text-sm text-ink-2">No education added yet.</p>}
              <div className="space-y-3">
                {profile.education.map((ed, i) => (
                  <div key={i} className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end">
                    <Field label="Institution">
                      <Input value={ed.institution} placeholder="University / college" onChange={(e) => setEdu(i, { institution: e.target.value })} />
                    </Field>
                    <Field label="Qualification">
                      <Input value={ed.qualification} placeholder="e.g. BSc Computer Science" onChange={(e) => setEdu(i, { qualification: e.target.value })} />
                    </Field>
                    <Field label="Year">
                      <Input value={ed.year} placeholder="2024" onChange={(e) => setEdu(i, { year: e.target.value })} />
                    </Field>
                    <RemoveButton label="Remove education" onClick={() => set("education", profile.education.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold">Preferences</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <TagEditor label="Preferred locations" values={profile.preferredLocations} onChange={(v) => set("preferredLocations", v)} />
                <Field label="Career interests">
                  <Input value={profile.careerInterests} placeholder="e.g. Cloud security, DevSecOps" onChange={(e) => set("careerInterests", e.target.value)} />
                </Field>
                <Field label="Expected salary (MYR / month)">
                  <Input
                    type="number"
                    min={0}
                    value={profile.expectedSalary ?? ""}
                    onChange={(e) => set("expectedSalary", e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
                  />
                </Field>
                <Field label="Notice period">
                  <Select value={profile.noticePeriod} onChange={(e) => set("noticePeriod", e.target.value)}>
                    <option value="">Not set</option>
                    {NOTICE.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Work arrangement" className="sm:col-span-2">
                  <div className="flex flex-wrap gap-4 pt-1 text-sm">
                    {ARRANGEMENTS.map((w) => (
                      <label key={w} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={profile.workArrangements.includes(w)}
                          onChange={(e) =>
                            set("workArrangements", e.target.checked ? [...profile.workArrangements, w] : profile.workArrangements.filter((x) => x !== w))
                          }
                          className="size-4 accent-[var(--accent)]"
                        />{" "}
                        {w}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            </Card>
          </div>
        )}

        <Card className="h-fit">
          <CardHeader title="Resume / CV versions" subtitle="Attach a version to each application" />
          <ul className="divide-y divide-line border-t border-line">
            {resumes.map((r) => {
              const used = applications.filter((a) => a.resumeVersionId === r.id).length;
              return (
                <li key={r.id} className="flex gap-3 px-5 py-3">
                  <FileText className="mt-0.5 size-5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="truncate text-xs text-ink-2">{r.fileName}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <span>Uploaded {fmtDay(klDay(r.uploadedAt))}</span>
                      <Pill>{used} applications</Pill>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {r.hasFile && (
                      <a href={`/api/resumes/${r.id}/file`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label={`Download ${r.fileName}`}>
                        <Download className="size-4" />
                      </a>
                    )}
                    <button onClick={() => remove(r.id, r.name)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-critical" aria-label={`Delete ${r.name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="p-4">
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center hover:bg-surface-2/60">
              {uploading ? <Loader2 className="size-5 animate-spin text-muted" /> : <Upload className="size-5 text-muted" />}
              <span className="text-sm font-medium">{uploading ? "Uploading…" : "Upload a new version"}</span>
              <span className="text-xs text-muted">PDF or DOCX, up to 10 MB · stored on your server</span>
              <input
                type="file"
                accept=".pdf,.docx"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) upload(f);
                }}
              />
            </label>
          </div>
        </Card>
      </div>
    </>
  );
}
