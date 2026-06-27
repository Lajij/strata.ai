"use client";

import {
  AlertCircle,
  BadgeCheck,
  Bell,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Filter,
  Landmark,
  Link2,
  ListChecks,
  LogIn,
  LogOut,
  LockKeyhole,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Vote,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  aiActions,
  buildingContext,
  emptyStates,
  formatCurrency,
  incidents,
  kpis,
  navItems,
  NavKey,
  type AuditEvent,
  type BudgetLine,
  type BudgetRecommendation,
  type DocumentRecord,
  type GovernanceCard,
  type Member,
  type Project,
  type VendorRecord,
  setupChecklist,
  statusTone,
  variancePercent,
} from "@/lib/strata-data";
import type { StrataAppData } from "@/lib/strata-app-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AiTask =
  | "card-brief"
  | "thread-summary"
  | "document-qa"
  | "nsw-law-lookup"
  | "budget-insights"
  | "quote-risk"
  | "project-status";

type AiRunState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  response?: AiResponse;
};

type AiResponse = {
  mode?: string;
  task?: AiTask;
  model?: string;
  persisted?: boolean;
  id?: string;
  text?: string;
  output?: Record<string, unknown>;
  citations?: string[];
  disclaimer?: string;
  error?: string;
};

const toneClasses = {
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-rose-200 bg-rose-50 text-rose-800",
  slate: "border-slate-200 bg-slate-100 text-slate-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
};

const initialAiState: AiRunState = {
  status: "idle",
  message: "Ready",
};

function Badge({ value }: { value: string }) {
  const tone = statusTone[value] ?? "slate";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {value}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
    >
      {children}
    </button>
  );
}

function aiTaskTitle(task: AiTask) {
  return task
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function aiOutputToMarkdown(response: AiResponse | undefined) {
  if (!response) {
    return "";
  }

  if (response.text) {
    return response.text;
  }

  if (!response.output) {
    return response.error ?? "";
  }

  return Object.entries(response.output)
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

      if (Array.isArray(value)) {
        return `**${label}**\n${value.map((item) => `- ${String(item)}`).join("\n")}`;
      }

      return `**${label}**\n${String(value)}`;
    })
    .join("\n\n");
}

async function runAiTask(
  task: AiTask,
  payload: Record<string, string>,
  setState: (state: AiRunState) => void,
) {
  setState({ status: "loading", message: `Running ${aiTaskTitle(task)}...` });

  try {
    const marker = (window as Window & { __STRATA_AI_VERIFICATION_MARKER__?: string })
      .__STRATA_AI_VERIFICATION_MARKER__;
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`/api/ai/${task}`, {
      method: "POST",
      headers,
      body: JSON.stringify(marker ? { ...payload, verificationMarker: marker, forceFallback: "true" } : payload),
    });
    const body = (await response.json()) as AiResponse;

    if (!response.ok) {
      setState({
        status: "error",
        message: body.error ?? "AI request failed",
        response: body,
      });
      return;
    }

    setState({
      status: "success",
      message: body.mode === "mock" ? "Fallback AI output ready" : "AI output ready",
      response: body,
    });
  } catch (error) {
    setState({
      status: "error",
      message: error instanceof Error ? error.message : "AI request failed",
    });
  }
}

async function authHeaders() {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
}

function AiResultCard({ state }: { state: AiRunState }) {
  return (
    <div className="rounded-lg border border-indigo-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusMessage
          tone={state.status === "success" ? "success" : state.status === "error" ? "error" : state.status === "loading" ? "loading" : "idle"}
          message={state.message}
        />
        {state.response ? (
          <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
            {state.response.mode ?? "unknown"} · {state.response.model ?? "no model"}
          </span>
        ) : null}
      </div>
      {state.response ? (
        <div className="mt-3 space-y-3">
          <MessageResponse>{aiOutputToMarkdown(state.response)}</MessageResponse>
          {state.response.citations?.length ? (
            <div className="flex flex-wrap gap-2">
              {state.response.citations.map((citation) => (
                <span key={citation} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-900">
                  {citation}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No citations returned.</p>
          )}
          <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
            <span>{state.response.persisted ? `Saved to ai_outputs${state.response.id ? ` (${state.response.id})` : ""}` : "Not persisted"}</span>
            <span>{state.response.disclaimer ?? "General information only."}</span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Run an AI action to generate a citation-aware response from visible records.</p>
      )}
    </div>
  );
}

function AuthControl({
  sourceDetail,
  onSessionChange,
}: {
  sourceDetail: string;
  onSessionChange: () => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [status, setStatus] = useState(sourceDetail);
  const [isBusy, setIsBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
      setStatus(data.session ? "Signed in" : "Supabase ready");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      setStatus(session ? "Signed in" : "Supabase ready");
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function signIn() {
    if (!supabase) {
      return;
    }

    const emailValue = email.trim() || emailRef.current?.value.trim() || "";
    const passwordValue = password || passwordRef.current?.value || "";

    if (!emailValue || !passwordValue) {
      setStatus("Enter email and password");
      return;
    }

    setIsBusy(true);
    setStatus("Signing in...");
    const { data, error } = await supabase.auth.signInWithPassword({ email: emailValue, password: passwordValue });

    if (error) {
      setStatus(error.message);
      setIsBusy(false);
      return;
    }

    setSessionEmail(data.user?.email ?? emailValue);
    setPassword("");
    setStatus("Signed in; activating invite...");
    const acceptHeaders = await authHeaders();
    const acceptResponse = await fetch("/api/members/accept", {
      method: "POST",
      headers: acceptHeaders,
      body: JSON.stringify({}),
    });
    const acceptBody = (await acceptResponse.json().catch(() => ({}))) as { message?: string; error?: string; mode?: string };

    if (!acceptResponse.ok && acceptResponse.status !== 403) {
      setStatus(acceptBody.error ?? "Invite activation failed");
      setIsBusy(false);
      return;
    }

    setStatus(acceptResponse.ok ? acceptBody.message ?? "Invite activated; refreshing workspace..." : "Signed in; checking active membership...");
    await onSessionChange();
    setIsBusy(false);
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    setIsBusy(true);
    await supabase.auth.signOut();
    setSessionEmail(null);
    setStatus("Signed out; refreshing fallback workspace...");
    await onSessionChange();
    setIsBusy(false);
  }

  if (!supabase) {
    return <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Fallback data</span>;
  }

  if (sessionEmail) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-sm text-emerald-900">
        <span className="hidden max-w-40 truncate sm:inline">{sessionEmail}</span>
        <button
          onClick={signOut}
          disabled={isBusy}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-2 text-xs font-medium text-emerald-900 disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-1.5">
      <input
        aria-label="Email"
        ref={emailRef}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="email"
        className="h-8 w-36 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-slate-400"
      />
      <input
        aria-label="Password"
        ref={passwordRef}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="password"
        type="password"
        className="h-8 w-32 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-slate-400"
      />
      <button
        onClick={signIn}
        disabled={isBusy}
        className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-950 px-2 text-xs font-medium text-white disabled:opacity-60"
        title={status}
      >
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </button>
      <span className="min-w-32 text-xs text-slate-500" aria-live="polite">
        {status}
      </span>
    </div>
  );
}

function SignedOutWorkspace({ sourceDetail }: { sourceDetail: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center">
      <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase text-slate-500">Invite-only access</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Sign in with an active committee account</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {sourceDetail}. The dashboard stays locked until Supabase Auth confirms a matching active member row.
        </p>
        <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">Pending invites activate after sign-in.</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">Inactive members stay blocked.</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">RLS filters all records after login.</div>
        </div>
      </section>
    </div>
  );
}

function MetricGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</p>
              </div>
              <span className="rounded-md bg-slate-100 p-2 text-slate-700">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

function Dashboard({
  go,
  cards,
  projects,
  sourceDetail,
}: {
  go: (key: NavKey) => void;
  cards: GovernanceCard[];
  projects: Project[];
  sourceDetail: string;
}) {
  const currentCard = cards[0];
  const currentProject = projects[0];
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase text-slate-500">{buildingContext.jurisdiction}</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">{buildingContext.name}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{buildingContext.plan}</p>
            <p className="mt-2 text-xs text-slate-500">{sourceDetail}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => go("cards")} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              New card
            </button>
            <button onClick={() => go("documents")} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800">
              <Upload className="h-4 w-4" />
              Upload doc
            </button>
          </div>
        </div>
      </section>

      <MetricGrid />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            eyebrow="Governance flow"
            title="Decision requiring attention"
            action={<Badge value={currentCard.status} />}
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_260px]">
            <div>
              <button onClick={() => go("cards")} className="text-left text-xl font-semibold text-slate-950 hover:underline">
                {currentCard.title}
              </button>
              <p className="mt-2 text-sm leading-6 text-slate-600">{currentCard.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge value={currentCard.type} />
                <Badge value={currentCard.visibility} />
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                  <Paperclip className="h-3 w-3" />
                  {currentCard.documents.length} docs
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Vote tally</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-white p-2">
                  <p className="text-xl font-semibold text-emerald-700">{currentCard.proposal.votes.yes}</p>
                  <p className="text-xs text-slate-500">Yes</p>
                </div>
                <div className="rounded-md bg-white p-2">
                  <p className="text-xl font-semibold text-rose-700">{currentCard.proposal.votes.no}</p>
                  <p className="text-xs text-slate-500">No</p>
                </div>
                <div className="rounded-md bg-white p-2">
                  <p className="text-xl font-semibold text-slate-700">{currentCard.proposal.votes.abstain}</p>
                  <p className="text-xs text-slate-500">Abstain</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Closes {currentCard.proposal.closes}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-900">
            <Sparkles className="h-4 w-4" />
            <p className="text-sm font-semibold">Visible building brief</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-indigo-950">{currentCard.aiBrief}</p>
          <div className="mt-4 rounded-md border border-indigo-200 bg-white/70 p-3 text-xs text-indigo-900">
            {buildingContext.disclaimer}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <SectionHeader eyebrow="Project control" title="Plan vs current state" />
          <div className="mt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <button onClick={() => go("projects")} className="text-left text-lg font-semibold text-slate-950 hover:underline">
                  {currentProject.name}
                </button>
                <p className="mt-2 text-sm leading-6 text-slate-600">{currentProject.aiSummary}</p>
              </div>
              <Badge value={currentProject.status} />
            </div>
            <ProgressBar value={currentProject.progress} label={`${currentProject.progress}% progress`} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Allowance" value={formatCurrency(currentProject.allowance)} />
              <MiniStat label="Committed" value={formatCurrency(currentProject.committed)} />
              <MiniStat label="Remaining" value={formatCurrency(currentProject.remaining)} />
            </div>
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader eyebrow="Setup" title="Production path" />
          <div className="mt-4 space-y-3">
            {setupChecklist.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  <span className={`rounded-md p-1.5 ${item.done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-slate-700">{item.label}</span>
                  {item.done ? <Check className="h-4 w-4 text-emerald-700" /> : <MoreHorizontal className="h-4 w-4 text-slate-400" />}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function CardsView({
  cards,
  onDataRefresh,
}: {
  cards: GovernanceCard[];
  onDataRefresh: () => Promise<StrataAppData | null>;
}) {
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? "");
  const [workflowResult, setWorkflowResult] = useState("Ready");
  const [workflowTone, setWorkflowTone] = useState<"idle" | "success" | "error" | "loading">("idle");
  const [isWorking, setIsWorking] = useState(false);
  const selected = cards.find((card) => card.id === selectedId) ?? cards[0];

  if (!selected) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader eyebrow="Cards" title="No cards visible" />
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No visible cards are available for this session.
        </div>
      </section>
    );
  }

  async function runWorkflow(action: string, payload: Record<string, string>) {
    setIsWorking(true);
    setWorkflowResult(`Running ${action}...`);
    setWorkflowTone("loading");

    try {
      const response = await fetch(`/api/workflow/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string; id?: string; error?: string; mode?: string };

      if (!response.ok) {
        setWorkflowResult(result.error ?? "Workflow action failed");
        setWorkflowTone("error");
        return false;
      }

      setWorkflowResult(`${result.message ?? "Workflow action complete"}${result.id ? ` (${result.id})` : ""}`);
      setWorkflowTone("success");
      const refreshed = await onDataRefresh();

      if (action === "create-card" && result.id && refreshed?.cards.some((card) => card.id === result.id)) {
        setSelectedId(result.id);
      }

      return true;
    } catch (error) {
      setWorkflowResult(error instanceof Error ? error.message : "Workflow action failed");
      setWorkflowTone("error");
      return false;
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <section className="space-y-3">
        <SectionHeader
          eyebrow="Cards"
          title="Governance work queue"
          action={
            <div className="flex gap-2">
              <IconButton label="Filter cards"><Filter className="h-4 w-4" /></IconButton>
              <IconButton label="Create card"><Plus className="h-4 w-4" /></IconButton>
            </div>
          }
        />
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => setSelectedId(card.id)}
            className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm transition ${
              selected.id === card.id ? "border-slate-950" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono text-slate-500">{card.id}</p>
                <h3 className="mt-1 text-base font-semibold text-slate-950">{card.title}</h3>
              </div>
              <Badge value={card.status} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{card.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge value={card.type} />
              <span className="text-xs text-slate-500">{card.updated}</span>
            </div>
          </button>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs text-slate-500">{selected.id}</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">{selected.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selected.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge value={selected.status} />
              <Badge value={selected.visibility} />
            </div>
          </div>
        </div>
        <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5 p-5">
            <WorkflowPanel
              selected={selected}
              disabled={isWorking}
              result={workflowResult}
              resultTone={workflowTone}
              onRun={runWorkflow}
            />

            <Panel title="Discussion thread" icon={<MessageSquareText className="h-4 w-4" />}>
              {selected.messages.length ? (
                <div className="space-y-3">
                {selected.messages.map((message) => (
                  <div key={`${message.author}-${message.time}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-950">{message.author}</p>
                      <span className="text-xs text-slate-500">{message.time}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{message.body}</p>
                  </div>
                ))}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No messages yet.
                </div>
              )}
            </Panel>

            <Panel title="Proposal, vote and conditions" icon={<Vote className="h-4 w-4" />}>
              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-950">{selected.proposal.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{selected.proposal.majority}</p>
                  <p className="mt-1 text-xs text-slate-500">Closes {selected.proposal.closes}</p>
                </div>
                <div className="space-y-3">
                  <Checklist title="Approval conditions" items={selected.proposal.conditions} />
                  <Checklist title="Unresolved issues" items={selected.proposal.unresolved} alert />
                </div>
              </div>
            </Panel>

            <Panel title="Card audit history" icon={<ClipboardList className="h-4 w-4" />}>
              {selected.audit.length ? (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {selected.audit.map((event, index) => (
                    <div key={`${event.action}-${event.time}-${index}`} className="grid gap-2 p-3 sm:grid-cols-[1fr_160px]">
                      <div>
                        <p className="text-sm font-medium text-slate-950">{event.action}</p>
                        <p className="text-xs text-slate-500">{event.target}</p>
                      </div>
                      <p className="font-mono text-xs text-slate-500 sm:text-right">{event.time}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No visible audit events for this card yet.
                </div>
              )}
            </Panel>

            <Panel title="Quote and variation risk review" icon={<AlertCircle className="h-4 w-4" />}>
              {selected.risks.length ? (
                <div className="grid gap-3 lg:grid-cols-3">
                {selected.risks.map((risk) => (
                  <div key={risk.label} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-950">{risk.label}</p>
                      <Badge value={risk.severity} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{risk.detail}</p>
                  </div>
                ))}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No quote or variation risks have been recorded for this card.
                </div>
              )}
            </Panel>
          </div>

          <AiPanel card={selected} />
        </div>
      </section>
    </div>
  );
}

function WorkflowPanel({
  selected,
  disabled,
  result,
  resultTone,
  onRun,
}: {
  selected: GovernanceCard;
  disabled: boolean;
  result: string;
  resultTone: "idle" | "success" | "error" | "loading";
  onRun: (action: string, payload: Record<string, string>) => Promise<boolean>;
}) {
  const [cardTitle, setCardTitle] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [cardType, setCardType] = useState("general");
  const [visibility, setVisibility] = useState("all");
  const [message, setMessage] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalRationale, setProposalRationale] = useState("");
  const [voteValue, setVoteValue] = useState("yes");
  const [voteNote, setVoteNote] = useState("");
  const [condition, setCondition] = useState("");
  const hasProposal = Boolean(selected.proposal.id);

  async function submit(event: FormEvent<HTMLFormElement>, action: string, payload: Record<string, string>) {
    event.preventDefault();
    const ok = await onRun(action, payload);

    if (!ok) {
      return;
    }

    if (action === "create-card") {
      setCardTitle("");
      setCardDescription("");
      setCardType("general");
      setVisibility("all");
    }

    if (action === "add-message") {
      setMessage("");
    }

    if (action === "create-proposal") {
      setProposalTitle("");
      setProposalRationale("");
    }

    if (action === "cast-vote") {
      setVoteNote("");
    }

    if (action === "add-approval-condition") {
      setCondition("");
    }
  }

  const inputClass = "h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400";
  const textareaClass = "min-h-20 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400";
  const buttonClass =
    "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryButtonClass =
    "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <Panel title="Writable workflow" icon={<Plus className="h-4 w-4" />}>
      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <form
          className="grid gap-3 rounded-md border border-slate-200 bg-white p-3"
          onSubmit={(event) =>
            submit(event, "create-card", {
              title: cardTitle,
              description: cardDescription,
              type: cardType,
              visibility,
            })
          }
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Plus className="h-4 w-4" />
            New card
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <input aria-label="Card title" className={inputClass} value={cardTitle} onChange={(event) => setCardTitle(event.target.value)} placeholder="Title" />
            <select aria-label="Card type" className={inputClass} value={cardType} onChange={(event) => setCardType(event.target.value)}>
              <option value="general">General</option>
              <option value="maintenance">Maintenance</option>
              <option value="quote">Quote</option>
              <option value="invoice">Invoice</option>
              <option value="compliance">Compliance</option>
              <option value="budget">Budget</option>
              <option value="project">Project</option>
              <option value="variation">Variation</option>
              <option value="incident">Incident</option>
              <option value="dispute">Dispute</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>
          <textarea aria-label="Card description" className={textareaClass} value={cardDescription} onChange={(event) => setCardDescription(event.target.value)} placeholder="Description" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select aria-label="Card visibility" className={inputClass} value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              <option value="all">All members</option>
              <option value="admins">Admins only</option>
              <option value="custom">Selected members</option>
            </select>
            <button aria-label="Create card" disabled={disabled || !cardTitle.trim() || !cardDescription.trim()} className={buttonClass}>
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>
        </form>

        <div className="grid gap-3 xl:grid-cols-2">
          <form
            className="grid gap-3 rounded-md border border-slate-200 bg-white p-3"
            onSubmit={(event) => submit(event, "add-message", { cardId: selected.id, body: message })}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <MessageSquareText className="h-4 w-4" />
              Message
            </div>
            <textarea aria-label="Message body" className={textareaClass} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message" />
            <button aria-label="Post message" disabled={disabled || !message.trim()} className={secondaryButtonClass}>
              <Send className="h-4 w-4" />
              Post
            </button>
          </form>

          <form
            className="grid gap-3 rounded-md border border-slate-200 bg-white p-3"
            onSubmit={(event) =>
              submit(event, "create-proposal", {
                cardId: selected.id,
                title: proposalTitle,
                rationale: proposalRationale,
              })
            }
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Vote className="h-4 w-4" />
              Proposal
            </div>
            <input aria-label="Proposal title" className={inputClass} value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} placeholder="Title" />
            <textarea aria-label="Proposal rationale" className={textareaClass} value={proposalRationale} onChange={(event) => setProposalRationale(event.target.value)} placeholder="Rationale" />
            <button aria-label="Create proposal" disabled={disabled || !proposalTitle.trim()} className={secondaryButtonClass}>
              <Vote className="h-4 w-4" />
              Create
            </button>
          </form>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <form
            className="grid gap-3 rounded-md border border-slate-200 bg-white p-3"
            onSubmit={(event) =>
              submit(event, "cast-vote", {
                cardId: selected.id,
                proposalId: selected.proposal.id ?? "",
                vote: voteValue,
                note: voteNote,
              })
            }
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Check className="h-4 w-4" />
              Vote
            </div>
            <select aria-label="Vote value" className={inputClass} value={voteValue} onChange={(event) => setVoteValue(event.target.value)}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="abstain">Abstain</option>
            </select>
            <textarea aria-label="Vote note" className={textareaClass} value={voteNote} onChange={(event) => setVoteNote(event.target.value)} placeholder="Note" />
            <button aria-label="Cast vote" disabled={disabled || !hasProposal} className={secondaryButtonClass}>
              <Check className="h-4 w-4" />
              Cast
            </button>
          </form>

          <form
            className="grid gap-3 rounded-md border border-slate-200 bg-white p-3"
            onSubmit={(event) =>
              submit(event, "add-approval-condition", {
                cardId: selected.id,
                proposalId: selected.proposal.id ?? "",
                condition,
              })
            }
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ClipboardList className="h-4 w-4" />
              Condition
            </div>
            <textarea aria-label="Approval condition" className={textareaClass} value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="Condition" />
            <button aria-label="Add approval condition" disabled={disabled || !hasProposal || !condition.trim()} className={secondaryButtonClass}>
              <ClipboardList className="h-4 w-4" />
              Add
            </button>
          </form>
        </div>

        <StatusMessage tone={resultTone} message={result} />
      </div>
    </Panel>
  );
}

function StatusMessage({
  tone,
  message,
}: {
  tone: "idle" | "success" | "error" | "loading";
  message: string;
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : tone === "loading"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-white text-slate-700";

  return <div className={`rounded-md border px-3 py-2 text-sm ${className}`}>{message}</div>;
}

function Checklist({ title, items, alert }: { title: string; items: string[]; alert?: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-950">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
            {alert ? <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-amber-600" /> : <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-slate-950">
        {icon}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function AiPanel({ card }: { card: GovernanceCard }) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<AiRunState>(initialAiState);
  const cardAiActions = aiActions.filter((action) =>
    ["Card brief", "NSW law lookup", "Quote risk"].includes(action.label),
  );
  const taskForLabel: Record<string, AiTask> = {
    "Card brief": "card-brief",
    "NSW law lookup": "nsw-law-lookup",
    "Quote risk": "quote-risk",
  };

  function run(label: string) {
    const task = taskForLabel[label] ?? "card-brief";
    void runAiTask(task, { cardId: card.id, question }, setState);
  }

  return (
    <aside className="border-t border-indigo-200 bg-indigo-50 p-5 xl:border-l xl:border-t-0">
      <div className="flex items-center gap-2 text-indigo-950">
        <Sparkles className="h-4 w-4" />
        <h3 className="font-semibold">AI panel</h3>
      </div>
      <p className="mt-1 text-xs text-indigo-800">RLS-filtered card, discussion, document, quote and law context.</p>
      <div className="mt-4 rounded-lg border border-indigo-200 bg-white p-4">
        <MessageResponse>{card.aiBrief}</MessageResponse>
      </div>
      <div className="mt-4 space-y-2">
        {cardAiActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => run(action.label)}
              disabled={state.status === "loading"}
              className="flex w-full items-start gap-3 rounded-md border border-indigo-200 bg-white p-3 text-left transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
              <span>
                <span className="block text-sm font-medium text-slate-950">{action.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">{action.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 rounded-md border border-indigo-200 bg-white/70 p-3 text-xs leading-5 text-indigo-950">
        Context builder filters by committee membership and record visibility before AI calls.
      </div>
      <div className="mt-3 flex gap-2">
        <input
          aria-label="Ask AI"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this card..."
          className="min-w-0 flex-1 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
        <button
          aria-label="Send AI question"
          title="Send AI question"
          onClick={() => runAiTask("thread-summary", { cardId: card.id, question }, setState)}
          disabled={state.status === "loading"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-indigo-200 bg-white text-indigo-700 shadow-sm transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4">
        <AiResultCard state={state} />
      </div>
    </aside>
  );
}

function DocumentsView({
  documents,
  cards,
  projects,
  onDataRefresh,
}: {
  documents: DocumentRecord[];
  cards: GovernanceCard[];
  projects: Project[];
  onDataRefresh: () => Promise<StrataAppData | null>;
}) {
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("By-laws");
  const [sourceDate, setSourceDate] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkedCardId, setLinkedCardId] = useState("");
  const [linkedProjectId, setLinkedProjectId] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [extractedText, setExtractedText] = useState("");
  const [result, setResult] = useState("Ready");
  const [resultTone, setResultTone] = useState<"idle" | "success" | "error" | "loading">("idle");
  const [isWorking, setIsWorking] = useState(false);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);
    setResult("Creating document...");
    setResultTone("loading");

    try {
      const payload = new FormData();
      payload.append("title", title);
      payload.append("documentType", documentType);
      payload.append("sourceDate", sourceDate);
      payload.append("visibility", visibility);
      payload.append("cardId", linkedCardId);
      payload.append("projectId", linkedProjectId);
      payload.append("extractedText", extractedText);

      if (selectedFile) {
        payload.append("file", selectedFile);
      }

      const response = await fetch("/api/documents/create", {
        method: "POST",
        body: payload,
      });
      const body = (await response.json()) as { id?: string; message?: string; error?: string };

      if (!response.ok) {
        setResult(body.error ?? "Document workflow failed");
        setResultTone("error");
        return;
      }

      setResult(`${body.message ?? "Document captured"}${body.id ? ` (${body.id})` : ""}`);
      setResultTone("success");
      setTitle("");
      setSourceDate("");
      setSelectedFile(null);
      setLinkedCardId("");
      setLinkedProjectId("");
      setFileInputKey((value) => value + 1);
      setExtractedText("");
      await onDataRefresh();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Document workflow failed");
      setResultTone("error");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Document intelligence"
        title="Vault, extraction and Markdown indexing"
        action={
          <div className="flex gap-2">
            <IconButton label="Search documents"><Search className="h-4 w-4" /></IconButton>
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
              <Upload className="h-4 w-4" />
              Upload
            </button>
          </div>
        }
      />
      <form onSubmit={createDocument} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px_180px]">
          <input
            aria-label="Document title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          />
          <select
            aria-label="Document type"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option>By-laws</option>
            <option>AGM minutes</option>
            <option>Committee memo</option>
            <option>Engineer report</option>
            <option>Quote</option>
            <option>Invoice</option>
            <option>Correspondence</option>
          </select>
          <input
            aria-label="Document date"
            type="date"
            value={sourceDate}
            onChange={(event) => setSourceDate(event.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          />
          <select
            aria-label="Document visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="all">All members</option>
            <option value="admins">Admins only</option>
            <option value="custom">Selected members</option>
          </select>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
          <input
            key={fileInputKey}
            aria-label="Document file"
            type="file"
            accept=".txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700 focus:border-slate-400"
          />
          <select
            aria-label="Linked card"
            value={linkedCardId}
            onChange={(event) => setLinkedCardId(event.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="">No linked card</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>{card.title}</option>
            ))}
          </select>
          <select
            aria-label="Linked project"
            value={linkedProjectId}
            onChange={(event) => setLinkedProjectId(event.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="">No linked project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
        <textarea
          aria-label="Extracted document text"
          value={extractedText}
          onChange={(event) => setExtractedText(event.target.value)}
          placeholder="Optional extracted text. Text and Markdown files are converted automatically; PDFs and DOCX files are stored with extraction pending."
          className="min-h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        {selectedFile ? (
          <p className="text-xs text-slate-500">
            Selected {selectedFile.name} ({selectedFile.type || "unknown type"}).
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <StatusMessage tone={resultTone} message={result} />
          </div>
          <button
            disabled={isWorking || !title.trim() || !documentType.trim() || (!selectedFile && !extractedText.trim())}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            Add document
          </button>
        </div>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {documents.map((doc) => (
          <article key={doc.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-slate-500">{doc.id}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{doc.name}</h3>
              </div>
              <Badge value={doc.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{doc.summary}</p>
            <div className="mt-4 grid gap-2 text-xs text-slate-600">
              <DocMeta icon={<FileText className="h-3.5 w-3.5" />} label="Type" value={doc.type} />
              <DocMeta icon={<LockKeyhole className="h-3.5 w-3.5" />} label="Access" value={doc.visibility} />
              <DocMeta icon={<Paperclip className="h-3.5 w-3.5" />} label="Storage" value={doc.storagePath} />
              <DocMeta icon={<FileSearch className="h-3.5 w-3.5" />} label="Text" value={doc.extractedTextPath} />
              <DocMeta icon={<Link2 className="h-3.5 w-3.5" />} label="Markdown" value={doc.markdownPath} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {doc.linkedTo.map((link) => (
                <span key={link} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{link}</span>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase text-slate-500">Citation-shaped Q&A</p>
              <p className="mt-2 text-sm text-slate-700">Answers cite {doc.citations.join(" and ")} when available.</p>
            </div>
            <DocumentAiTool document={doc} />
          </article>
        ))}
      </div>
    </div>
  );
}

function DocMeta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
      {icon}
      <span className="w-20 text-slate-500">{label}</span>
      <span className="min-w-0 truncate font-mono text-slate-700">{value}</span>
    </div>
  );
}

function DocumentAiTool({ document }: { document: DocumentRecord }) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<AiRunState>(initialAiState);

  return (
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <div className="flex items-center gap-2 text-indigo-950">
        <Sparkles className="h-4 w-4" />
        <p className="text-sm font-semibold">Document Q&A</p>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          aria-label={`Ask about ${document.name}`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this document"
          className="min-w-0 flex-1 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
        <button
          onClick={() => runAiTask("document-qa", { documentId: document.id, question }, setState)}
          disabled={state.status === "loading"}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-indigo-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          Ask
        </button>
      </div>
      <div className="mt-3">
        <AiResultCard state={state} />
      </div>
    </div>
  );
}

function ProjectsView({ projects }: { projects: Project[] }) {
  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Project control" title="Plan, progress, variations and budget evidence" />
      <div className="grid gap-5 xl:grid-cols-2">
        {projects.map((project) => (
          <article key={project.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-slate-500">{project.id}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">{project.name}</h3>
              </div>
              <Badge value={project.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{project.plannedScope}</p>
            <ProgressBar value={project.progress} label="Current progress" />
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <MiniStat label="Allowance" value={formatCurrency(project.allowance)} />
              <MiniStat label="Committed" value={formatCurrency(project.committed)} />
              <MiniStat label="Invoiced" value={formatCurrency(project.invoiced)} />
              <MiniStat label="Remaining" value={formatCurrency(project.remaining)} />
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-950">Milestones</p>
                <div className="mt-2 space-y-2">
                  {project.milestones.map((milestone) => (
                    <div key={milestone.label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{milestone.label}</p>
                        <span className="text-xs text-slate-500">{milestone.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Planned {milestone.planned} · Actual {milestone.actual}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Variations</p>
                <div className="mt-2 space-y-2">
                  {project.variations.map((variation) => (
                    <div key={variation.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{variation.title}</p>
                        <span className="font-mono text-xs text-slate-500">{variation.id}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatCurrency(variation.amount)} · {variation.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-950">Evidence</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {project.evidence.length ? (
                  project.evidence.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      <Paperclip className="h-3 w-3" />
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No linked evidence yet.</span>
                )}
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-950">Invoices</p>
                <div className="mt-2 space-y-2">
                  {project.invoices.length ? (
                    project.invoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">{invoice.invoiceNumber}</p>
                          <span className="font-mono text-xs text-slate-500">{formatCurrency(invoice.amount)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{invoice.vendor} · {invoice.status} · {invoice.document}</p>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">No linked invoices yet.</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Quote reviews</p>
                <div className="mt-2 space-y-2">
                  {project.quoteReviews.length ? (
                    project.quoteReviews.map((review) => (
                      <div key={review.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">{review.document}</p>
                          <Badge value={review.risk} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {review.missingInclusions.length} missing · {review.riskyExclusions.length} exclusions · {review.approvalConditions.length} conditions
                        </p>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">No linked quote reviews yet.</span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <div className="flex items-center gap-2 text-indigo-950">
                <Sparkles className="h-4 w-4" />
                <p className="text-sm font-semibold">AI plan-vs-current summary</p>
              </div>
              <div className="mt-2">
                <MessageResponse>{project.aiSummary}</MessageResponse>
              </div>
              <ProjectAiTool project={project} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProjectAiTool({ project }: { project: Project }) {
  const [state, setState] = useState<AiRunState>(initialAiState);

  return (
    <div className="mt-3">
      <button
        onClick={() => runAiTask("project-status", { projectId: project.id }, setState)}
        disabled={state.status === "loading"}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-indigo-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ListChecks className="h-4 w-4" />
        Refresh project AI
      </button>
      <div className="mt-3">
        <AiResultCard state={state} />
      </div>
    </div>
  );
}

function BudgetView({
  budgetLines,
  recommendation,
  projects,
  cards,
  documents,
  vendors,
  onDataRefresh,
}: {
  budgetLines: BudgetLine[];
  recommendation: BudgetRecommendation;
  projects: Project[];
  cards: GovernanceCard[];
  documents: DocumentRecord[];
  vendors: VendorRecord[];
  onDataRefresh: () => Promise<StrataAppData | null>;
}) {
  const totalApproved = budgetLines.reduce((sum, line) => sum + line.approved, 0);
  const totalCommitted = budgetLines.reduce((sum, line) => sum + line.committed, 0);
  const [state, setState] = useState<AiRunState>(initialAiState);
  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Budget center" title="Accounts, allowances, spend progress and recommendations" />
      <div className="grid gap-3 md:grid-cols-3">
        <MiniStat label="Approved budget" value={formatCurrency(totalApproved)} />
        <MiniStat label="Committed spend" value={formatCurrency(totalCommitted)} />
        <MiniStat label="Commitment ratio" value={`${variancePercent(totalCommitted, totalApproved)}%`} />
      </div>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <span>Category</span>
          <span>Approved</span>
          <span>Committed</span>
          <span>Actual</span>
          <span>Risk</span>
        </div>
        {budgetLines.map((line) => (
          <div key={line.category} className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr] gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-0">
            <div>
              <p className="font-medium text-slate-950">{line.category}</p>
              <p className="text-xs text-slate-500">{line.account}</p>
            </div>
            <span className="font-mono text-slate-700">{formatCurrency(line.approved)}</span>
            <span className="font-mono text-slate-700">{formatCurrency(line.committed)}</span>
            <span className="font-mono text-slate-700">{formatCurrency(line.actual)}</span>
            <span className="text-slate-600">{line.risk}</span>
          </div>
        ))}
      </section>
      <section className="rounded-lg border border-indigo-200 bg-indigo-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-indigo-950">
            <Sparkles className="h-4 w-4" />
            <h3 className="font-semibold">Budget recommendation</h3>
          </div>
          <button
            onClick={() => runAiTask("budget-insights", {}, setState)}
            disabled={state.status === "loading"}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-indigo-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Landmark className="h-4 w-4" />
            Run budget AI
          </button>
        </div>
        <div className="mt-3">
          <MessageResponse>{recommendation.summary}</MessageResponse>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {recommendation.citations.map((citation) => (
            <span key={citation} className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-xs text-indigo-900">
              {citation}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs italic text-indigo-900">{recommendation.disclaimer}</p>
        <div className="mt-4">
          <AiResultCard state={state} />
        </div>
      </section>
      <FinanceWorkflowTools
        projects={projects}
        cards={cards}
        documents={documents}
        vendors={vendors}
        onDataRefresh={onDataRefresh}
      />
    </div>
  );
}

function FinanceWorkflowTools({
  projects,
  cards,
  documents,
  vendors,
  onDataRefresh,
}: {
  projects: Project[];
  cards: GovernanceCard[];
  documents: DocumentRecord[];
  vendors: VendorRecord[];
  onDataRefresh: () => Promise<StrataAppData | null>;
}) {
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceProjectId, setInvoiceProjectId] = useState(projects[0]?.id ?? "");
  const [invoiceCardId, setInvoiceCardId] = useState(cards[0]?.id ?? "");
  const [invoiceDocumentId, setInvoiceDocumentId] = useState(documents[0]?.id ?? "");
  const [invoiceVendorId, setInvoiceVendorId] = useState(vendors[0]?.id ?? "");
  const [reviewCardId, setReviewCardId] = useState(cards[0]?.id ?? "");
  const [reviewDocumentId, setReviewDocumentId] = useState(documents[0]?.id ?? "");
  const [reviewRisk, setReviewRisk] = useState("medium");
  const [missingInclusions, setMissingInclusions] = useState("");
  const [riskyExclusions, setRiskyExclusions] = useState("");
  const [clarificationQuestions, setClarificationQuestions] = useState("");
  const [approvalConditions, setApprovalConditions] = useState("");
  const [status, setStatus] = useState("Finance tools ready");
  const [tone, setTone] = useState<"idle" | "success" | "error" | "loading">("idle");

  async function postFinance(action: string, payload: Record<string, unknown>) {
    setStatus(`Running ${action}...`);
    setTone("loading");

    const response = await fetch(`/api/finance/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { id?: string; message?: string; error?: string };

    if (!response.ok) {
      setStatus(body.error ?? "Finance workflow failed");
      setTone("error");
      return;
    }

    setStatus(`${body.message ?? "Finance workflow saved"}${body.id ? ` (${body.id})` : ""}`);
    setTone("success");
    await onDataRefresh();
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader eyebrow="Quote and invoice workflow" title="Vendors, invoices and quote risk foundations" />
      <StatusMessage tone={tone} message={status} />
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <form
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void postFinance("create-vendor", { name: vendorName, contactEmail: vendorEmail });
          }}
        >
          <p className="text-sm font-semibold text-slate-950">Vendor</p>
          <input aria-label="Vendor name" value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Vendor name" className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
          <input aria-label="Vendor email" value={vendorEmail} onChange={(event) => setVendorEmail(event.target.value)} placeholder="Email" className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
          <button disabled={!vendorName.trim()} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white disabled:opacity-60">
            <Plus className="h-4 w-4" />
            Create vendor
          </button>
        </form>
        <form
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void postFinance("create-invoice", {
              invoiceNumber,
              amount: invoiceAmount,
              projectId: invoiceProjectId,
              cardId: invoiceCardId,
              documentId: invoiceDocumentId,
              vendorId: invoiceVendorId,
            });
          }}
        >
          <p className="text-sm font-semibold text-slate-950">Invoice</p>
          <input aria-label="Invoice number" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Invoice number" className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
          <input aria-label="Invoice amount" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} placeholder="Amount" inputMode="decimal" className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm" />
          <select aria-label="Invoice project" value={invoiceProjectId} onChange={(event) => setInvoiceProjectId(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
            <option value="">No project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select aria-label="Invoice vendor" value={invoiceVendorId} onChange={(event) => setInvoiceVendorId(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
            <option value="">No vendor</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </select>
          <select aria-label="Invoice card" value={invoiceCardId} onChange={(event) => setInvoiceCardId(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
            <option value="">No card</option>
            {cards.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
          </select>
          <select aria-label="Invoice document" value={invoiceDocumentId} onChange={(event) => setInvoiceDocumentId(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
            <option value="">No document</option>
            {documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
          </select>
          <button disabled={!invoiceNumber.trim() || !invoiceAmount.trim()} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white disabled:opacity-60">
            <FileText className="h-4 w-4" />
            Create invoice
          </button>
        </form>
        <form
          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void postFinance("create-quote-review", {
              cardId: reviewCardId,
              documentId: reviewDocumentId,
              overallRisk: reviewRisk,
              missingInclusions,
              riskyExclusions,
              clarificationQuestions,
              approvalConditions,
            });
          }}
        >
          <p className="text-sm font-semibold text-slate-950">Quote review</p>
          <select aria-label="Quote review card" value={reviewCardId} onChange={(event) => setReviewCardId(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
            <option value="">No card</option>
            {cards.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
          </select>
          <select aria-label="Quote review document" value={reviewDocumentId} onChange={(event) => setReviewDocumentId(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
            <option value="">No document</option>
            {documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
          </select>
          <select aria-label="Quote review risk" value={reviewRisk} onChange={(event) => setReviewRisk(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <textarea aria-label="Missing inclusions" value={missingInclusions} onChange={(event) => setMissingInclusions(event.target.value)} placeholder="Missing inclusions, comma or line separated" className="min-h-16 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <textarea aria-label="Risky exclusions" value={riskyExclusions} onChange={(event) => setRiskyExclusions(event.target.value)} placeholder="Risky exclusions" className="min-h-16 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <textarea aria-label="Clarification questions" value={clarificationQuestions} onChange={(event) => setClarificationQuestions(event.target.value)} placeholder="Clarification questions" className="min-h-16 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <textarea aria-label="Approval conditions" value={approvalConditions} onChange={(event) => setApprovalConditions(event.target.value)} placeholder="Approval conditions" className="min-h-16 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <button className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
            <AlertCircle className="h-4 w-4" />
            Create quote review
          </button>
        </form>
      </div>
    </section>
  );
}

function IncidentsView() {
  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Incidents" title="Security, compliance, defect and evidence tracking" />
      {incidents.map((incident) => (
        <article key={incident.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-xs text-slate-500">{incident.id}</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{incident.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{incident.date} · {incident.location}</p>
            </div>
            <div className="flex gap-2">
              <Badge value={incident.severity} />
              <Badge value={incident.status} />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{incident.summary}</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <IncidentBlock title="Evidence" items={incident.evidence} icon={<Paperclip className="h-4 w-4" />} />
            <IncidentBlock title="Follow-ups" items={incident.followUps} icon={<ClipboardList className="h-4 w-4" />} />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-slate-950">
                <Bell className="h-4 w-4" />
                <p className="text-sm font-semibold">Resident notice draft</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{incident.residentNotice}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function IncidentBlock({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-950">
        {icon}
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MembersView({
  members,
  currentMember,
  onDataRefresh,
}: {
  members: Member[];
  currentMember: StrataAppData["auth"]["member"];
  onDataRefresh: () => Promise<StrataAppData | null>;
}) {
  const [inviteStatus, setInviteStatus] = useState("Invite form ready");
  const [inviteTone, setInviteTone] = useState<"idle" | "success" | "error" | "loading">("idle");
  const [isInviting, setIsInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("member");
  const [accessLevel, setAccessLevel] = useState("member");
  const canInvite = Boolean(currentMember && ["admin", "chair", "secretary"].includes(currentMember.role));

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canInvite) {
      setInviteStatus("Only admin, chair, or secretary members can invite users");
      setInviteTone("error");
      return;
    }

    setIsInviting(true);
    setInviteTone("loading");
    setInviteStatus("Sending invite...");

    try {
      const response = await fetch("/api/members/invite", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ email, fullName, role, accessLevel }),
      });
      const result = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Invite failed");
      }

      setInviteStatus(result.message ?? "Member invited");
      setInviteTone("success");
      setEmail("");
      setFullName("");
      setRole("member");
      setAccessLevel("member");
      await onDataRefresh();
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : "Invite failed");
      setInviteTone("error");
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Members"
        title="Invite-only committee access"
        action={currentMember ? <Badge value={`${currentMember.full_name} · ${currentMember.role}`} /> : null}
      />
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-950">
          <ShieldCheck className="h-4 w-4" />
          <h3 className="font-semibold">Invite member</h3>
        </div>
        <form onSubmit={submitInvite} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_160px_160px_auto]">
          <input
            aria-label="Invite email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@building.example"
            type="email"
            disabled={!canInvite || isInviting}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
          <input
            aria-label="Invite full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
            disabled={!canInvite || isInviting}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
          <select
            aria-label="Invite role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={!canInvite || isInviting}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
          >
            <option value="member">Member</option>
            <option value="treasurer">Treasurer</option>
            <option value="secretary">Secretary</option>
            <option value="chair">Chair</option>
            <option value="admin">Admin</option>
            <option value="strata_manager">Strata manager</option>
          </select>
          <select
            aria-label="Invite access level"
            value={accessLevel}
            onChange={(event) => setAccessLevel(event.target.value)}
            disabled={!canInvite || isInviting}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
          >
            <option value="member">Member</option>
            <option value="read_only">Read only</option>
            <option value="limited_admin">Limited admin</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={!canInvite || isInviting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Invite
          </button>
        </form>
        <div className="mt-3">
          <StatusMessage
            tone={canInvite ? inviteTone : "idle"}
            message={canInvite ? inviteStatus : "Sign in as an admin, chair, or secretary to invite members"}
          />
        </div>
      </section>
      <div className="grid gap-3">
        {members.length ? members.map((member) => (
          <MemberManagementRow
            key={`${member.id}-${member.name}-${member.roleValue}-${member.statusValue}-${member.accessValue}`}
            member={member}
            canManage={canInvite}
            isCurrentMember={currentMember?.id === member.id}
            onDataRefresh={onDataRefresh}
          />
        )) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            No members are visible for this session.
          </div>
        )}
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-950">
          <ShieldCheck className="h-4 w-4" />
          <h3 className="font-semibold">Visibility model</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {emptyStates.map((state) => {
            const Icon = state.icon;
            return (
              <div key={state.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Icon className="h-4 w-4 text-slate-700" />
                <p className="mt-3 text-sm font-semibold text-slate-950">{state.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{state.detail}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function MemberManagementRow({
  member,
  canManage,
  isCurrentMember,
  onDataRefresh,
}: {
  member: Member;
  canManage: boolean;
  isCurrentMember: boolean;
  onDataRefresh: () => Promise<StrataAppData | null>;
}) {
  const [fullName, setFullName] = useState(member.name);
  const [role, setRole] = useState(member.roleValue);
  const [status, setStatus] = useState(member.statusValue);
  const [accessLevel, setAccessLevel] = useState(member.accessValue);
  const [result, setResult] = useState("Ready");
  const [tone, setTone] = useState<"idle" | "success" | "error" | "loading">("idle");
  const [isSaving, setIsSaving] = useState(false);
  const dirty =
    fullName !== member.name ||
    role !== member.roleValue ||
    status !== member.statusValue ||
    accessLevel !== member.accessValue;
  const disableSensitiveSelfEdit = isCurrentMember;

  async function saveMember() {
    if (!canManage) {
      setResult("Only admin, chair, or secretary members can manage users");
      setTone("error");
      return;
    }

    setIsSaving(true);
    setTone("loading");
    setResult("Saving member access...");

    try {
      const response = await fetch("/api/members/update", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          memberId: member.id,
          fullName,
          role,
          status,
          accessLevel,
        }),
      });
      const body = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Member update failed");
      }

      setResult(body.message ?? "Member updated");
      setTone("success");
      await onDataRefresh();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Member update failed");
      setTone("error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1fr_150px_150px_150px_auto] xl:items-start">
      <div>
        <input
          aria-label={`Name for ${member.email}`}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          disabled={!canManage || isSaving}
          className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm font-semibold text-slate-950 outline-none focus:border-slate-400 disabled:border-transparent disabled:bg-white"
        />
        <p className="mt-1 truncate text-sm text-slate-500">{member.email}</p>
        <p className="mt-1 text-xs text-slate-500">{member.lastActive}</p>
      </div>
      <select
        aria-label={`Role for ${member.email}`}
        value={role}
        onChange={(event) => setRole(event.target.value)}
        disabled={!canManage || disableSensitiveSelfEdit || isSaving}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
      >
        <option value="member">Member</option>
        <option value="treasurer">Treasurer</option>
        <option value="secretary">Secretary</option>
        <option value="chair">Chair</option>
        <option value="admin">Admin</option>
        <option value="strata_manager">Strata manager</option>
      </select>
      <select
        aria-label={`Access level for ${member.email}`}
        value={accessLevel}
        onChange={(event) => setAccessLevel(event.target.value)}
        disabled={!canManage || disableSensitiveSelfEdit || isSaving}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
      >
        <option value="member">Member</option>
        <option value="read_only">Read only</option>
        <option value="limited_admin">Limited admin</option>
        <option value="admin">Admin</option>
      </select>
      <select
        aria-label={`Status for ${member.email}`}
        value={status}
        onChange={(event) => setStatus(event.target.value as Member["statusValue"])}
        disabled={!canManage || disableSensitiveSelfEdit || isSaving}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
      >
        <option value="active">Active</option>
        <option value="invited">Invited</option>
        <option value="suspended">Inactive</option>
      </select>
      <div className="space-y-2">
        <button
          aria-label={`Save member ${member.email}`}
          type="button"
          onClick={saveMember}
          disabled={!canManage || !dirty || isSaving}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Save
        </button>
        <Badge value={status === "active" ? "Active" : status === "invited" ? "Invited" : "Inactive"} />
        <StatusMessage tone={tone} message={result} />
      </div>
    </div>
  );
}

function ActivityView({ activity }: { activity: AuditEvent[] }) {
  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Audit trail" title="Append-only governance history" />
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {activity.map((event, index) => (
          <div key={`${event.actor}-${event.time}-${index}`} className="grid gap-2 border-b border-slate-100 p-4 last:border-0 sm:grid-cols-[160px_1fr_220px] sm:items-center">
            <span className="text-sm font-medium text-slate-950">{event.actor}</span>
            <span className="text-sm text-slate-600">
              {event.action} · {event.target}
              {event.detail ? <span className="mt-1 block text-xs text-slate-500">{event.detail}</span> : null}
            </span>
            <span className="font-mono text-xs text-slate-500">{event.time}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function MainContent({
  active,
  go,
  data,
  onDataRefresh,
}: {
  active: NavKey;
  go: (key: NavKey) => void;
  data: StrataAppData;
  onDataRefresh: () => Promise<StrataAppData | null>;
}) {
  switch (active) {
    case "dashboard":
      return <Dashboard go={go} cards={data.cards} projects={data.projects} sourceDetail={data.sourceDetail} />;
    case "cards":
      return <CardsView cards={data.cards} onDataRefresh={onDataRefresh} />;
    case "documents":
      return (
        <DocumentsView
          documents={data.documents}
          cards={data.cards}
          projects={data.projects}
          onDataRefresh={onDataRefresh}
        />
      );
    case "projects":
      return <ProjectsView projects={data.projects} />;
    case "budget":
      return (
        <BudgetView
          budgetLines={data.budgetLines}
          recommendation={data.budgetRecommendation}
          projects={data.projects}
          cards={data.cards}
          documents={data.documents}
          vendors={data.vendors}
          onDataRefresh={onDataRefresh}
        />
      );
    case "incidents":
      return <IncidentsView />;
    case "members":
      return <MembersView members={data.members} currentMember={data.auth.member} onDataRefresh={onDataRefresh} />;
    case "activity":
      return <ActivityView activity={data.activity} />;
  }
}

export function StrataApp({ initialData }: { initialData: StrataAppData }) {
  const [active, setActive] = useState<NavKey>("dashboard");
  const [data, setData] = useState(initialData);
  const [refreshStatus, setRefreshStatus] = useState("Workspace ready");
  const activeLabel = useMemo(() => navItems.find((item) => item.key === active)?.label ?? "Dashboard", [active]);

  useEffect(() => {
    document.documentElement.dataset.strataHydrated = "true";
  }, []);

  async function refreshData() {
    setRefreshStatus("Refreshing workspace...");

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const headers: Record<string, string> = {};

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/app-data", {
        cache: "no-store",
        credentials: "same-origin",
        headers,
      });

      if (!response.ok) {
        throw new Error("Workspace refresh failed");
      }

      const nextData = (await response.json()) as StrataAppData;
      setData(nextData);
      setRefreshStatus("Workspace updated");
      return nextData;
    } catch (error) {
      setRefreshStatus(error instanceof Error ? error.message : "Workspace refresh failed");
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-950">Strata</p>
              <p className="text-xs text-slate-500">Governance command</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = item.key === active;
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                  selected ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-950">
            {data.auth.member?.full_name ?? (data.auth.mode === "fallback" ? "Fallback session" : "Signed out")}
          </p>
          <p className="text-xs text-slate-500">{data.auth.member?.role ?? data.sourceDetail}</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-slate-500">Current view</p>
              <h1 className="text-lg font-semibold text-slate-950">{activeLabel}</h1>
            </div>
            <div className="flex items-center gap-2">
              <AuthControl sourceDetail={data.sourceDetail} onSessionChange={refreshData} />
              <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 sm:flex">
                <Search className="h-4 w-4" />
                Search cards, docs, projects
              </div>
              <IconButton label="Export audit pack"><Download className="h-4 w-4" /></IconButton>
              <IconButton label="Open source evidence"><ExternalLink className="h-4 w-4" /></IconButton>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 pb-24 sm:px-6 lg:pb-8">
          <div className="mb-4 text-xs text-slate-500">{refreshStatus}</div>
          {data.auth.mode === "signed-out" ? (
            <SignedOutWorkspace sourceDetail={data.sourceDetail} />
          ) : (
            <MainContent active={active} go={setActive} data={data} onDataRefresh={refreshData} />
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white p-2 lg:hidden">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-medium ${
                selected ? "bg-slate-950 text-white" : "text-slate-600"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
