"use client"

import * as React from "react"
import { CheckCircle2, Clock, Vote as VoteIcon } from "lucide-react"

import type { VoteCard } from "@/lib/types"
import { participationPct } from "@/lib/format"
import { useAppStore } from "@/components/app-store"
import { CardTile } from "@/components/cards/card-tile"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type VoteTab = "active" | "closed" | "drafts"

export function VotesPage() {
  const { cards } = useAppStore()
  const [tab, setTab] = React.useState<VoteTab>("active")

  const votes = cards.filter((c): c is VoteCard => c.type === "vote")
  const active = votes.filter(
    (v) => v.status === "Open" || v.status === "Closing soon",
  )
  const closed = votes.filter((v) => v.status === "Closed")
  const drafts = votes.filter((v) => v.status === "Draft")

  const avgTurnout =
    active.length === 0
      ? 0
      : Math.round(
          active.reduce((s, v) => s + participationPct(v), 0) / active.length,
        )

  const shown = tab === "active" ? active : tab === "closed" ? closed : drafts

  const stats = [
    { label: "Open votes", value: active.length, icon: VoteIcon },
    { label: "Average turnout", value: `${avgTurnout}%`, icon: Clock },
    { label: "Closed this quarter", value: closed.length, icon: CheckCircle2 },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as VoteTab)}>
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shown.map((v) => (
          <CardTile key={v.id} card={v} />
        ))}
      </div>
    </div>
  )
}
