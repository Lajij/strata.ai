"use client"

import * as React from "react"
import { Plus, Search } from "lucide-react"

import { useAppStore } from "@/components/app-store"
import { MotionStatusBadge } from "@/components/motions/motion-status-badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function MotionsPage() {
  const { motions, setMotionCreateOpen, openMotion } = useAppStore()
  const [query, setQuery] = React.useState("")

  const filtered = motions.filter((motion) => {
    if (!query) return true
    const haystack = `${motion.title} ${motion.context} ${motion.creator} ${motion.status}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InputGroup className="h-9 w-full sm:w-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search motions..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>

        <Button onClick={() => setMotionCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          <span className="hidden sm:inline">New motion</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>No motions yet</EmptyTitle>
            <EmptyDescription>
              Raise a committee motion to move it from draft through open to decided or withdrawn.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setMotionCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            New motion
          </Button>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((motion) => (
            <button
              key={motion.id}
              type="button"
              onClick={() => openMotion(motion.id)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-pretty text-base font-semibold leading-snug">
                  {motion.title}
                </h3>
                <MotionStatusBadge status={motion.status} />
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {motion.context || "No context recorded."}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Raised by {motion.creator}</span>
                <span>Updated {motion.updated}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
