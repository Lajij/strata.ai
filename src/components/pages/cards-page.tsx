"use client"

import * as React from "react"
import { LayoutGrid, List, Plus, Search, SlidersHorizontal } from "lucide-react"

import type { CardTab, ViewMode } from "@/lib/types"
import { BUILDING_AREAS } from "@/lib/mock-data"
import { useAppStore } from "@/components/app-store"
import { CardTile } from "@/components/cards/card-tile"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { CardAiPanel } from "@/components/assistant/card-ai-panel"

const TABS: { value: CardTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "updates", label: "Updates" },
  { value: "votes", label: "Votes" },
  { value: "drafts", label: "Drafts" },
]

export function CardsPage() {
  const { cards, setCreateOpen } = useAppStore()
  const [tab, setTab] = React.useState<CardTab>("all")
  const [view, setView] = React.useState<ViewMode>("grid")
  const [query, setQuery] = React.useState("")
  const [area, setArea] = React.useState<string>("all")

  const filtered = cards.filter((c) => {
    if (tab === "updates" && c.type !== "update") return false
    if (tab === "votes" && c.type !== "vote") return false
    if (tab === "drafts" && c.status !== "Draft") return false
    if (area !== "all" && c.area !== area) return false
    if (query) {
      const hay = `${c.title} ${c.area} ${c.type === "update" ? c.summary : c.description}`.toLowerCase()
      if (!hay.includes(query.toLowerCase())) return false
    }
    return true
  })

  return (
    <div className="flex flex-col gap-5">
      <CardAiPanel card={cards[0]} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as CardTab)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="h-9 w-full sm:w-56">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search cards..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>

            <Select
              items={[{ label: "All areas", value: "all" }, ...BUILDING_AREAS.map((a) => ({ label: a, value: a }))]}
              value={area}
              onValueChange={(v) => setArea(v as string)}
            >
              <SelectTrigger size="sm" className="h-11 md:h-9" aria-label="Filter by area">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All areas</SelectItem>
                {BUILDING_AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ToggleGroup
              value={[view]}
              onValueChange={(v) => v[0] && setView(v[0] as ViewMode)}
              spacing={0}
              variant="outline"
            >
              <ToggleGroupItem value="grid" aria-label="Grid view">
                <LayoutGrid />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view">
                <List />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </Tabs>

      {filtered.length === 0 ? (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>No cards found</EmptyTitle>
            <EmptyDescription>
              Try a different filter, or create a new card to get started.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            Create card
          </Button>
        </Empty>
      ) : (
        <div
          className={
            view === "grid"
              ? "grid grid-cols-1 gap-4 md:grid-cols-2"
              : "flex flex-col gap-4"
          }
        >
          {filtered.map((card) => (
            <CardTile key={card.id} card={card} view={view} />
          ))}
        </div>
      )}
    </div>
  )
}
