"use client"

import * as React from "react"
import { CalendarClock, MapPin, MessageSquare, Paperclip, Users } from "lucide-react"

import type { ActivityItem, Card, Comment } from "@/lib/types"
import { daysUntil, formatDate, participationPct, totalVotes } from "@/lib/format"
import { authHeaders } from "@/lib/supabase/auth-headers"
import { useAppStore } from "@/components/app-store"
import { EvidenceReferences } from "@/components/evidence-references"
import { StatusMessage, type StatusValue } from "@/components/status-message"
import { StatusBadge, TypeBadge } from "@/components/status-badge"
import { VoteResults } from "@/components/cards/vote-results"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"

const readyStatus: StatusValue = { state: "idle", message: "Workflow ready." }

export function CardDetailDrawer() {
  const { cards, selectedCardId, closeCard } = useAppStore()
  const card = cards.find((item) => item.id === selectedCardId) ?? null

  return (
    <Sheet open={!!card} onOpenChange={(open) => !open && closeCard()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetTitle className="sr-only">{card ? card.title : "Card details"}</SheetTitle>
        {card && <DrawerBody card={card} onClose={closeCard} />}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({ card, onClose }: { card: Card; onClose: () => void }) {
  const selected = { ...card, audit: card.audit ?? [] }
  const days = selected.type === "vote" ? daysUntil(selected.deadline) : null

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-6 pb-5 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={selected.type} />
          <StatusBadge status={selected.status} />
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <MapPin data-icon="inline-start" />
            {selected.area}
          </Badge>
        </div>
        <h2 className="text-pretty text-lg font-semibold leading-snug">{selected.title}</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {selected.audience}
          </span>
          {selected.type === "update" ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {selected.status === "Scheduled" ? "Scheduled " : "Published "}
              {formatDate(selected.publishDate)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {days !== null && days > 0
                ? `Closes in ${days} day${days === 1 ? "" : "s"}`
                : selected.deadline
                  ? `Closed ${formatDate(selected.deadline)}`
                  : "No closing date"}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5">
        <EvidenceReferences
          references={selected.sourceRefs?.length ? selected.sourceRefs : [`card:${selected.id}`]}
          label="Card evidence records"
        />

        {selected.type === "update" ? (
          <>
            <p className="text-pretty leading-relaxed text-foreground">{selected.body}</p>
            {selected.attachments.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Attachments</span>
                {selected.attachments.map((attachment) => (
                  <div
                    key={attachment}
                    className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm"
                  >
                    <Paperclip className="size-4 text-muted-foreground" />
                    <span className="truncate">{attachment}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <VoteSummary card={selected} />
        )}

        <Separator />
        <MessageThread cardId={selected.id} comments={selected.comments ?? []} />
        <Separator />
        <WorkflowControls card={selected} />
        <Separator />
        <CardAuditHistory selected={selected} />
      </div>

      <Separator />
      <div className="flex items-center justify-end px-6 py-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}

function VoteSummary({ card }: { card: Extract<Card, { type: "vote" }> }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-pretty leading-relaxed text-foreground">{card.description}</p>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Participation</span>
          <span className="tabular-nums text-muted-foreground">
            {card.participation} / {card.eligibleCount} ({participationPct(card)}%)
          </span>
        </div>
        <Progress value={participationPct(card)} />
        <span className="text-xs text-muted-foreground">{card.eligibility}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Recorded results</span>
        <span className="text-xs text-muted-foreground">{totalVotes(card)} votes</span>
      </div>
      <VoteResults card={card} />
    </div>
  )
}

function MessageThread({ cardId, comments }: { cardId: string; comments: Comment[] }) {
  const { refreshData } = useAppStore()
  const [body, setBody] = React.useState("")
  const [status, setStatus] = React.useState<StatusValue>(readyStatus)
  const pending = status.state === "loading"

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus({ state: "loading", message: "Posting and auditing message..." })

    try {
      const response = await fetch("/api/workflow/add-message", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ cardId, body }),
      })
      const result = (await response.json()) as { message?: string; error?: string }

      if (!response.ok) throw new Error(result.error ?? "Message failed")

      setStatus({ state: "success", message: result.message ?? "Message posted" })
      setBody("")
      await refreshData()
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "Message failed" })
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="card-messages-heading">
      <h3 id="card-messages-heading" className="flex items-center gap-1.5 text-sm font-medium">
        <MessageSquare className="size-4" />
        Messages ({comments.length})
      </h3>
      {comments.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-accent text-xs text-accent-foreground">
              {comment.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{comment.author}</span>
              <span className="text-xs text-muted-foreground">{comment.date}</span>
            </div>
            <p className="text-sm text-muted-foreground">{comment.body}</p>
          </div>
        </div>
      ))}
      <form onSubmit={submit} className="grid gap-2">
        <Label htmlFor={`message-${cardId}`}>Message body</Label>
        <Textarea
          id={`message-${cardId}`}
          aria-label="Message body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={pending}
          required
        />
        <Button type="submit" aria-label="Post message" disabled={pending}>
          {pending ? "Posting..." : "Post message"}
        </Button>
        <StatusMessage status={status} />
      </form>
    </section>
  )
}

function WorkflowControls({ card }: { card: Card }) {
  const { refreshData } = useAppStore()
  const [proposalTitle, setProposalTitle] = React.useState("")
  const [rationale, setRationale] = React.useState("")
  const [vote, setVote] = React.useState("yes")
  const [note, setNote] = React.useState("")
  const [condition, setCondition] = React.useState("")
  const [status, setStatus] = React.useState<StatusValue>(readyStatus)
  const pending = status.state === "loading"

  async function runWorkflow(
    action: "create-proposal" | "cast-vote" | "add-approval-condition",
    payload: Record<string, string>,
  ) {
    setStatus({ state: "loading", message: "Saving and auditing workflow change..." })
    const response = await fetch(`/api/workflow/${action}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ cardId: card.id, ...payload }),
    })
    const result = (await response.json()) as { message?: string; error?: string }

    if (!response.ok) throw new Error(result.error ?? "Workflow action failed")

    setStatus({ state: "success", message: result.message ?? "Workflow action saved" })
    await refreshData()
  }

  async function createProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await runWorkflow("create-proposal", { title: proposalTitle, rationale })
      setProposalTitle("")
      setRationale("")
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "Proposal failed" })
    }
  }

  async function castVote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await runWorkflow("cast-vote", { vote, note })
      setNote("")
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "Vote failed" })
    }
  }

  async function addCondition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await runWorkflow("add-approval-condition", { condition })
      setCondition("")
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "Condition failed" })
    }
  }

  return (
    <section className="grid gap-5" aria-labelledby="card-workflow-heading">
      <div>
        <h3 id="card-workflow-heading" className="font-semibold">Decision workflow</h3>
        <p className="text-sm text-muted-foreground">
          Each action is persisted through the authenticated workflow route and added to the audit log.
        </p>
      </div>

      {card.proposalTitle && (
        <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
          <span className="text-muted-foreground">Current proposal: </span>
          <span className="font-medium">{card.proposalTitle}</span>
        </div>
      )}

      <form onSubmit={createProposal} className="grid gap-2 rounded-lg border p-3">
        <Label htmlFor={`proposal-title-${card.id}`}>Proposal title</Label>
        <Input
          id={`proposal-title-${card.id}`}
          aria-label="Proposal title"
          value={proposalTitle}
          onChange={(event) => setProposalTitle(event.target.value)}
          disabled={pending}
          required
        />
        <Label htmlFor={`proposal-rationale-${card.id}`}>Proposal rationale</Label>
        <Textarea
          id={`proposal-rationale-${card.id}`}
          aria-label="Proposal rationale"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          disabled={pending}
        />
        <Button type="submit" aria-label="Create proposal" disabled={pending}>
          Create proposal
        </Button>
      </form>

      <form onSubmit={castVote} className="grid gap-2 rounded-lg border p-3">
        <Label htmlFor={`vote-value-${card.id}`}>Vote value</Label>
        <select
          id={`vote-value-${card.id}`}
          aria-label="Vote value"
          value={vote}
          onChange={(event) => setVote(event.target.value)}
          disabled={pending}
          className="h-11 rounded-lg border border-input bg-background px-2 text-sm md:h-8"
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="abstain">Abstain</option>
        </select>
        <Label htmlFor={`vote-note-${card.id}`}>Vote note</Label>
        <Textarea
          id={`vote-note-${card.id}`}
          aria-label="Vote note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={pending}
        />
        <Button type="submit" aria-label="Cast vote" disabled={pending || !card.proposalTitle}>
          Cast vote
        </Button>
      </form>

      <form onSubmit={addCondition} className="grid gap-2 rounded-lg border p-3">
        <Label htmlFor={`approval-condition-${card.id}`}>Approval condition</Label>
        <Textarea
          id={`approval-condition-${card.id}`}
          aria-label="Approval condition"
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
          disabled={pending}
          required
        />
        <Button
          type="submit"
          aria-label="Add approval condition"
          disabled={pending || !card.proposalTitle}
        >
          Add approval condition
        </Button>
      </form>

      {(card.approvalConditions?.length ?? 0) > 0 && (
        <div className="grid gap-2">
          <h4 className="text-sm font-medium">Approval conditions</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {card.approvalConditions?.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
      <StatusMessage status={status} />
    </section>
  )
}

function CardAuditHistory({ selected }: { selected: Card & { audit: ActivityItem[] } }) {
  return (
    <section className="grid gap-3" aria-labelledby="card-audit-heading">
      <div>
        <h3 id="card-audit-heading" className="font-semibold">Card audit history</h3>
        <p className="text-sm text-muted-foreground">Persisted events visible for this card.</p>
      </div>
      {selected.audit.length === 0 ? (
        <p className="text-sm text-muted-foreground">No visible audit events.</p>
      ) : (
        <div className="grid gap-2">
          {selected.audit.map((event) => (
            <div key={event.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{event.action}</p>
              <p className="text-muted-foreground">{event.actor} · {event.target}</p>
              <p className="text-xs text-muted-foreground">{event.time}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
