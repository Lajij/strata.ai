import { CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { VoteCard } from "@/lib/types"
import { leadingOption, totalVotes } from "@/lib/format"

export function VoteResults({
  card,
  compact = false,
}: {
  card: VoteCard
  compact?: boolean
}) {
  const total = totalVotes(card)
  const leader = leadingOption(card)

  if (card.resultsHidden) {
    return (
      <p className="text-sm text-muted-foreground">
        Results are hidden until the vote closes to keep it fair.
      </p>
    )
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      {card.options.map((option) => {
        const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100)
        const isLeader = option.id === leader?.id && total > 0
        return (
          <div key={option.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {isLeader && (
                  <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
                )}
                {option.label}
              </span>
              <span className="tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isLeader ? "bg-primary" : "bg-chart-4",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
