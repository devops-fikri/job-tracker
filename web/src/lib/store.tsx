"use client";

import { Loader2, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { api, errorMessage } from "./api";
import { addDays, diffDays, klDay, NOW, setClock, TODAY, uid } from "./format";
import { AWAITING, isActive, STATUS_BY_ID } from "./statuses";
import type { AiAuditEntry, Application, EmailItem, FollowUp, Interview, ResumeVersion, StatusId, TimelineEvent } from "./types";

interface State {
  applications: Application[];
  interviews: Interview[];
  followUps: FollowUp[];
  emails: EmailItem[];
  resumes: ResumeVersion[];
  audit: AiAuditEntry[];
}

type Action =
  | { type: "load"; state: State }
  | { type: "upsertApplication"; app: Application }
  | { type: "deleteApplication"; id: string }
  | { type: "setStatus"; id: string; status: StatusId }
  | { type: "addNote"; id: string; text: string }
  | { type: "upsertInterview"; interview: Interview }
  | { type: "setFollowUp"; id: string; status: FollowUp["status"] }
  | { type: "addFollowUp"; followUp: FollowUp }
  | { type: "resolveEmail"; id: string; state: EmailItem["state"]; applicationId?: string };

const nowIso = () => NOW.toISOString();
const event = (e: Omit<TimelineEvent, "id" | "at">): TimelineEvent => ({ id: uid(), at: nowIso(), ...e });

function touch(app: Application, e: TimelineEvent, patch: Partial<Application> = {}): Application {
  return { ...app, ...patch, updatedAt: e.at, timeline: [e, ...app.timeline] };
}

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "load":
      return a.state;
    case "upsertApplication": {
      const exists = state.applications.some((x) => x.id === a.app.id);
      return {
        ...state,
        applications: exists
          ? state.applications.map((x) => (x.id === a.app.id ? touch(a.app, event({ kind: "note", title: "Details edited", source: "manual" })) : x))
          : [a.app, ...state.applications],
      };
    }
    case "deleteApplication":
      return {
        ...state,
        applications: state.applications.filter((x) => x.id !== a.id),
        interviews: state.interviews.filter((x) => x.applicationId !== a.id),
        followUps: state.followUps.filter((x) => x.applicationId !== a.id),
      };
    case "setStatus":
      return {
        ...state,
        applications: state.applications.map((x) =>
          x.id === a.id && x.status !== a.status
            ? touch(x, event({ kind: "status", title: `Status → ${STATUS_BY_ID[a.status].label}`, source: "manual" }), { status: a.status })
            : x,
        ),
      };
    case "addNote":
      return {
        ...state,
        applications: state.applications.map((x) =>
          x.id === a.id ? touch(x, event({ kind: "note", title: "Note added", detail: a.text, source: "manual" }), { notes: x.notes ? `${x.notes}\n\n${a.text}` : a.text }) : x,
        ),
      };
    case "upsertInterview": {
      const exists = state.interviews.some((x) => x.id === a.interview.id);
      return {
        ...state,
        interviews: exists ? state.interviews.map((x) => (x.id === a.interview.id ? a.interview : x)) : [...state.interviews, a.interview],
        applications: state.applications.map((x) =>
          x.id === a.interview.applicationId
            ? touch(x, event({ kind: "interview", title: exists ? `Interview ${a.interview.status}` : `${a.interview.type} interview scheduled`, source: "manual" }))
            : x,
        ),
      };
    }
    case "setFollowUp":
      return { ...state, followUps: state.followUps.map((x) => (x.id === a.id ? { ...x, status: a.status } : x)) };
    case "addFollowUp":
      return { ...state, followUps: [...state.followUps, a.followUp] };
    case "resolveEmail":
      return {
        ...state,
        emails: state.emails.map((x) => (x.id === a.id ? { ...x, state: a.state, matchedApplicationId: a.applicationId ?? x.matchedApplicationId } : x)),
        applications: a.applicationId
          ? state.applications.map((x) => {
              const email = state.emails.find((m) => m.id === a.id)!;
              return x.id === a.applicationId
                ? touch(x, event({ kind: "email", title: "Email linked from review queue", detail: email.subject, source: "gmail" }), { lastCommunication: email.receivedAt })
                : x;
            })
          : state.applications,
      };
  }
}

export interface ActivityItem {
  id: string;
  at: string;
  applicationId: string;
  company: string;
  role: string;
  event: TimelineEvent;
}

function derive(s: State) {
  const apps = s.applications;
  const submitted = apps.filter((a) => STATUS_BY_ID[a.status].stage !== "wishlist");
  const upcoming = s.interviews
    .filter((i) => i.status === "scheduled" && Date.parse(i.start) >= NOW.getTime())
    .sort((a, b) => a.start.localeCompare(b.start));
  const pendingFollowUps = s.followUps.filter((f) => f.status === "pending").sort((a, b) => a.due.localeCompare(b.due));
  const count = (pred: (a: Application) => boolean) => apps.filter(pred).length;
  const everHad = (a: Application, status: StatusId) =>
    a.status === status || a.timeline.some((e) => e.kind === "status" && e.title.endsWith(STATUS_BY_ID[status].label));

  const interviewed = submitted.filter(
    (a) => ["interviewing", "offer"].includes(STATUS_BY_ID[a.status].stage) || s.interviews.some((i) => i.applicationId === a.id),
  ).length;
  const responded = submitted.filter((a) => !AWAITING.includes(a.status) && a.status !== "ghosted").length;
  const offers = submitted.filter((a) => everHad(a, "offer_received")).length;

  const activity: ActivityItem[] = apps
    .flatMap((a) => a.timeline.map((e) => ({ id: e.id, at: e.at, applicationId: a.id, company: a.company, role: a.title, event: e })))
    .sort((x, y) => y.at.localeCompare(x.at));

  return {
    stats: {
      total: submitted.length,
      inProgress: count((a) => isActive(a.status)),
      interviewsScheduled: upcoming.length,
      offers: count((a) => a.status === "offer_received" || a.status === "offer_accepted"),
      rejected: count((a) => a.status === "rejected"),
      awaiting: count((a) => AWAITING.includes(a.status)),
      followUpsDue: pendingFollowUps.filter((f) => f.due <= TODAY).length,
      reviewQueue: s.emails.filter((e) => e.state === "needs_review").length,
    },
    funnel: [
      { stage: "Applied", value: submitted.length },
      { stage: "Got a response", value: responded },
      { stage: "Interviewed", value: interviewed },
      { stage: "Offer", value: offers },
    ],
    upcoming,
    pendingFollowUps,
    activity,
    staleApplications: apps.filter((a) => AWAITING.includes(a.status) && diffDays(TODAY, klDay(a.updatedAt)) >= 14),
  };
}

/** Sends one action to the API. The reducer has already applied it optimistically. */
async function persist(a: Action): Promise<void> {
  switch (a.type) {
    case "load":
      return;
    case "upsertApplication":
      await api(`/applications/${a.app.id}`, { method: "PUT", json: a.app });
      return;
    case "deleteApplication":
      await api(`/applications/${a.id}`, { method: "DELETE" });
      return;
    case "setStatus":
      await api(`/applications/${a.id}/status`, { method: "POST", json: { status: a.status } });
      return;
    case "addNote":
      await api(`/applications/${a.id}/notes`, { method: "POST", json: { text: a.text } });
      return;
    case "upsertInterview":
      await api(`/interviews/${a.interview.id}`, { method: "PUT", json: a.interview });
      return;
    case "setFollowUp":
      await api(`/follow-ups/${a.id}`, { method: "PATCH", json: { status: a.status } });
      return;
    case "addFollowUp":
      await api("/follow-ups", { method: "POST", json: a.followUp });
      return;
    case "resolveEmail":
      await api(`/emails/${a.id}/resolve`, { method: "POST", json: { state: a.state, applicationId: a.applicationId } });
      return;
  }
}

interface ServerState extends State {
  now: string;
}

type Ctx = State &
  ReturnType<typeof derive> & {
    dispatch: (a: Action) => Promise<boolean>;
    refresh: () => Promise<void>;
    reportError: (message: string) => void;
    appById: (id: string) => Application | undefined;
  };
const StoreContext = createContext<Ctx | null>(null);

const EMPTY: State = { applications: [], interviews: [], followUps: [], emails: [], resumes: [], audit: [] };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, localDispatch] = useReducer(reducer, EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const apply = useCallback(({ now, ...next }: ServerState) => {
    setClock(now);
    localDispatch({ type: "load", state: next });
    setLoaded(true);
    setLoadError(null);
  }, []);

  const refresh = useCallback(async () => apply(await api<ServerState>("/state")), [apply]);

  useEffect(() => {
    api<ServerState>("/state").then(apply, (e) => setLoadError(errorMessage(e)));
    const onFocus = () => {
      if (document.visibilityState === "visible") api<ServerState>("/state").then(apply, () => {});
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [apply]);

  const dispatch = useCallback(
    async (a: Action) => {
      const before = stateRef.current;
      localDispatch(a);
      try {
        await persist(a);
        await refresh();
        return true;
      } catch (e) {
        setError(errorMessage(e));
        localDispatch({ type: "load", state: before });
        refresh().catch(() => {});
        return false;
      }
    },
    [refresh],
  );

  const value = useMemo<Ctx>(() => {
    const byId = new Map(state.applications.map((a) => [a.id, a]));
    return { ...state, ...derive(state), dispatch, refresh, reportError: setError, appById: (id) => byId.get(id) };
  }, [state, dispatch, refresh]);

  if (!loaded) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4 text-sm text-ink-2">
        {loadError ? (
          <div className="max-w-sm text-center">
            <TriangleAlert className="mx-auto mb-2 size-6 text-critical" />
            <p className="font-medium text-ink">Couldn&apos;t reach the API</p>
            <p className="mt-1">{loadError}</p>
            <button className="mt-4 h-9 rounded-lg border border-line px-3 font-medium hover:bg-surface-2" onClick={() => refresh().catch((e) => setLoadError(errorMessage(e)))}>
              Try again
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </span>
        )}
      </div>
    );
  }

  return (
    <StoreContext.Provider value={value}>
      {children}
      {error && (
        <div role="alert" className="fixed inset-x-4 bottom-20 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg lg:bottom-6">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-critical" />
          <div className="flex-1">
            <div className="font-medium">Change not saved</div>
            <div className="text-ink-2">{error}</div>
          </div>
          <button aria-label="Dismiss" className="text-muted hover:text-ink" onClick={() => setError(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export function blankApplication(): Application {
  return {
    id: uid(),
    company: "",
    title: "",
    description: "",
    location: "",
    employmentType: "Full-time",
    workArrangement: "Hybrid",
    currency: "MYR",
    platform: "LinkedIn",
    appliedAt: TODAY,
    status: "applied",
    notes: "",
    updatedAt: nowIso(),
    timeline: [{ id: uid(), at: nowIso(), kind: "created", title: "Added manually", source: "manual" }],
  };
}

/** Normalised company+title key used for duplicate detection. */
export const dupKey = (a: Pick<Application, "company" | "title">) =>
  `${a.company}|${a.title}`.toLowerCase().replace(/[^a-z0-9|]+/g, "");

export const followUpDefaultDue = () => addDays(TODAY, 1);
