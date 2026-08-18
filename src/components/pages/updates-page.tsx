"use client"

import * as React from "react"

import type { UpdateCard } from "@/lib/types"
import { useAppStore } from "@/components/app-store"
import { CardTile } from "@/components/cards/card-tile"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type UpdateTab = "published" | "scheduled" | "drafts"

export function UpdatesPage() {
  const { cards } = useAppStore()
  const [tab, setTab] = React.useState<UpdateTab>("published")

  const updates = cards.filter((c): c is UpdateCard => c.type === "update")
  const published = updates.filter((u) => u.status === "Published")
  const scheduled = updates.filter((u) => u.status === "Scheduled")
  const drafts = updates.filter((u) => u.status === "Draft")

  const shown =
    tab === "published" ? published : tab === "scheduled" ? scheduled : drafts

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as UpdateTab)}>
        <TabsList>
          <TabsTrigger value="published">
            Published ({published.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            Scheduled ({scheduled.length})
          </TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shown.map((u) => (
          <CardTile key={u.id} card={u} />
        ))}
      </div>
    </div>
  )
}
