"use client"

import * as React from "react"
import { Landmark, ListChecks, Send, Sparkles } from "lucide-react"

import { authHeaders } from "@/lib/supabase/auth-headers"
import { MessageResponse } from "@/components/ai-elements/message"
import { Button } from "@/components/ui/button"

export type AiTask =
  | "card-brief"
  | "thread-summary"
  | "document-qa"
  | "nsw-law-lookup"
  | "budget-insights"
  | "quote-risk"
  | "project-status"

export type AiResponse = {
  mode?: string
  task?: AiTask
  model?: string
  persisted?: boolean
  id?: string
  text?: string
  output?: Record<string, unknown>
  citations?: string[]
  disclaimer?: string
  error?: string
}

export type AiRunState = {
  status: "idle" | "loading" | "success" | "error"
  message: string
  response?: AiResponse
}

export const initialAiState: AiRunState = { status: "idle", message: "Not run yet" }

function aiTaskTitle(task: AiTask) {
  return task
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")
}

export function aiOutputToMarkdown(response: AiResponse | undefined) {
  if (!response) {
    return ""
  }

  if (response.text) {
    return response.text
  }

  if (!response.output) {
    return response.error ?? ""
  }

  return Object.entries(response.output)
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())

      if (Array.isArray(value)) {
        return `**${label}**\n${value.map((item) => `- ${String(item)}`).join("\n")}`
      }

      return `**${label}**\n${String(value)}`
    })
    .join("\n\n")
}

export async function runAiTask(
  task: AiTask,
  payload: Record<string, string>,
  setState: (state: AiRunState) => void,
) {
  setState({ status: "loading", message: `Running ${aiTaskTitle(task)}...` })

  try {
    const marker = (window as Window & { __STRATA_AI_VERIFICATION_MARKER__?: string })
      .__STRATA_AI_VERIFICATION_MARKER__
    const headers = await authHeaders()
    const response = await fetch(`/api/ai/${task}`, {
      method: "POST",
      headers,
      body: JSON.stringify(
        marker ? { ...payload, verificationMarker: marker, forceFallback: "true" } : payload,
      ),
    })
    const body = (await response.json()) as AiResponse

    if (!response.ok) {
      setState({ status: "error", message: body.error ?? "AI request failed", response: body })
      return
    }

    setState({
      status: "success",
      message: body.mode === "mock" ? "Fallback AI output ready" : "AI output ready",
      response: body,
    })
  } catch (error) {
    setState({
      status: "error",
      message: error instanceof Error ? error.message : "AI request failed",
    })
  }
}

export function AiResultCard({ state }: { state: AiRunState }) {
  if (state.status === "idle") {
    return null
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{state.message}</p>
        {state.response ? (
          <span className="rounded-full bg-secondary px-2 py-1 font-mono text-xs text-secondary-foreground">
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
                <span
                  key={citation}
                  className="rounded-full border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                >
                  {citation}
                </span>
              ))}
            </div>
          ) : null}
          {state.response.disclaimer ? (
            <p className="text-xs italic text-muted-foreground">{state.response.disclaimer}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {state.response.persisted ? "Saved to ai_outputs" : "Not saved to ai_outputs"}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function DocumentAiTool({
  documentId,
  documentName,
}: {
  documentId: string
  documentName: string
}) {
  const [question, setQuestion] = React.useState("")
  const [state, setState] = React.useState<AiRunState>(initialAiState)

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4" />
        <p className="text-sm font-semibold">Document Q&A</p>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          aria-label={`Ask about ${documentName}`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this document"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring md:h-8"
        />
        <Button
          size="sm"
          onClick={() => runAiTask("document-qa", { documentId, question }, setState)}
          disabled={state.status === "loading" || !question.trim()}
        >
          <Send data-icon="inline-start" />
          Ask
        </Button>
      </div>
      <div className="mt-3">
        <AiResultCard state={state} />
      </div>
    </div>
  )
}

export function ProjectAiTool({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [state, setState] = React.useState<AiRunState>(initialAiState)

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{projectName}</p>
        <Button
          size="sm"
          onClick={() => runAiTask("project-status", { projectId }, setState)}
          disabled={state.status === "loading"}
        >
          <ListChecks data-icon="inline-start" />
          Refresh project AI
        </Button>
      </div>
      <div className="mt-3">
        <AiResultCard state={state} />
      </div>
    </div>
  )
}

export function BudgetAiTool() {
  const [state, setState] = React.useState<AiRunState>(initialAiState)

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <p className="text-sm font-semibold">Budget insights</p>
        </div>
        <Button
          size="sm"
          onClick={() => runAiTask("budget-insights", {}, setState)}
          disabled={state.status === "loading"}
        >
          <Landmark data-icon="inline-start" />
          Run budget AI
        </Button>
      </div>
      <div className="mt-3">
        <AiResultCard state={state} />
      </div>
    </div>
  )
}
