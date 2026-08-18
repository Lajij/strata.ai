"use client"

import {
  ArrowRight,
  CalendarClock,
  FileText,
  MessageSquare,
  TrendingUp,
  Vote as VoteIcon,
} from "lucide-react"

import type { VoteCard } from "@/lib/types"
import { daysUntil, participationPct } from "@/lib/format"
import { useAppStore } from "@/components/app-store"
import { EvidenceReferences } from "@/components/evidence-references"
import { BudgetAiTool, ProjectAiTool } from "@/components/assistant/ai-tools"
import { StatusBadge } from "@/components/status-badge"
import { VoteResults } from "@/components/cards/vote-results"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

export function DashboardPage() {
  const { activity, cards, setPage, openCard, rawProjects, sourceDetail } = useAppStore()

  const votes = cards.filter((c): c is VoteCard => c.type === "vote")
  const activeVotes = votes.filter(
    (v) => v.status === "Open" || v.status === "Closing soon",
  )
  const drafts = cards.filter((c) => c.status === "Draft")
  const closingSoon = votes.filter((v) => v.status === "Closing soon")
  const published = cards.filter(
    (c) => c.type === "update" && c.status === "Published",
  )
  const avgTurnout =
    activeVotes.length === 0
      ? 0
      : Math.round(
          activeVotes.reduce((s, v) => s + participationPct(v), 0) /
            activeVotes.length,
        )

  const attention = [
    ...closingSoon.map((v) => ({
      id: v.id,
      title: v.title,
      note: `Vote closes in ${daysUntil(v.deadline)} days`,
      icon: CalendarClock,
    })),
    ...drafts.map((d) => ({
      id: d.id,
      title: d.title,
      note: `${d.type === "vote" ? "Vote" : "Update"} draft — not published`,
      icon: FileText,
    })),
  ].slice(0, 4)

  const stats = [
    {
      label: "Active votes",
      value: activeVotes.length,
      icon: VoteIcon,
      sourceIds: activeVotes.map((vote) => vote.id),
    },
    {
      label: "Avg. turnout",
      value: `${avgTurnout}%`,
      icon: TrendingUp,
      sourceIds: activeVotes.map((vote) => vote.id),
    },
    {
      label: "Published updates",
      value: published.length,
      icon: MessageSquare,
      sourceIds: published.map((update) => update.id),
    },
    {
      label: "Pending drafts",
      value: drafts.length,
      icon: FileText,
      sourceIds: drafts.map((draft) => draft.id),
    },
  ]

  const featuredVote = activeVotes[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evidence boundary
        </p>
        <p className="mt-1 text-sm">{sourceDetail}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dashboard claims below link to the RLS-visible source records used to calculate them.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums leading-none">
                    {s.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="flex min-h-11 cursor-pointer items-center md:min-h-0">
                      Sources ({s.sourceIds.length})
                    </summary>
                    {s.sourceIds.length === 0 ? (
                      <p className="mt-1">No matching card records.</p>
                    ) : (
                      <div className="mt-1 flex max-w-full flex-col gap-1">
                        {s.sourceIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => openCard(id)}
                            className="min-h-11 max-w-full truncate text-left font-mono text-[10px] underline-offset-2 hover:underline md:min-h-0"
                            title={`card:${id}`}
                          >
                            card:{id}
                          </button>
                        ))}
                      </div>
                    )}
                  </details>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Needs attention */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Needs your attention</CardTitle>
            <CardDescription>
              Time-sensitive items across the building.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {attention.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">
                You&apos;re all caught up. Nothing needs attention right now.
              </p>
            )}
            {attention.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openCard(item.id)}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-left transition-colors hover:bg-secondary/60"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.note}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      Source card:{item.id}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}
          </CardContent>
        </Card>

        {/* Featured vote */}
        <Card>
          <CardHeader>
            <CardTitle>Vote in focus</CardTitle>
            <CardDescription>Highest priority open vote.</CardDescription>
          </CardHeader>
          {featuredVote ? (
            <>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={featuredVote.status} />
                  <span className="text-xs text-muted-foreground">
                    {participationPct(featuredVote)}% turnout
                  </span>
                </div>
                <p className="text-pretty text-sm font-medium leading-snug">
                  {featuredVote.title}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  Source card:{featuredVote.id}
                </p>
                <Progress value={participationPct(featuredVote)} aria-label="Vote participation" />
                <Separator />
                <VoteResults card={featuredVote} compact />
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openCard(featuredVote.id)}
                >
                  Open vote
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardFooter>
            </>
          ) : (
            <CardContent>
              <p className="text-sm text-muted-foreground">No active votes.</p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            The latest actions across your building.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {activity.map((a, i) => (
            <div key={a.id}>
              <div className="flex items-center gap-3 py-2">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                    {a.initials}
                  </AvatarFallback>
                </Avatar>
                <p className="flex-1 text-sm">
                  <span className="font-medium">{a.actor}</span>{" "}
                  <span className="text-muted-foreground">{a.action}</span>{" "}
                  <span className="font-medium">{a.target}</span>
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.time}
                </span>
              </div>
              <p className="pb-2 pl-11 font-mono text-[10px] text-muted-foreground">
                Source {a.sourceRef}
              </p>
              {i < activity.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button variant="ghost" className="w-full" onClick={() => setPage("cards")}>
            View all cards
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">AI insights</p>
        <p className="text-xs text-muted-foreground">
          Non-binding, cited answers from approved building records.
        </p>
        <BudgetAiTool />
        {rawProjects.map((project) => (
          <div key={project.id} className="flex flex-col gap-1">
            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium md:min-h-0">
                Project record: {project.name}
              </summary>
              <div className="mt-3 flex flex-col gap-3 text-sm">
                <p>{project.plannedScope}</p>
                <p className="text-xs text-muted-foreground">
                  {project.status} · {project.progress}% complete
                </p>
                <EvidenceReferences
                  references={
                    project.sourceRefs?.length
                      ? project.sourceRefs
                      : [`project:${project.id}`, ...project.evidence]
                  }
                  label="Project evidence records"
                />
              </div>
            </details>
            <ProjectAiTool projectId={project.id} projectName={project.name} />
          </div>
        ))}
      </div>
    </div>
  )
}
