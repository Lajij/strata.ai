import { Megaphone, Vote as VoteIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { CardType, UpdateStatus, VoteStatus } from "@/lib/types"

const dotColor: Record<string, string> = {
  Published: "bg-success",
  Open: "bg-success",
  Scheduled: "bg-primary",
  "Closing soon": "bg-warning",
  Draft: "bg-muted-foreground",
  Closed: "bg-muted-foreground",
  Archived: "bg-muted-foreground",
}

export function StatusBadge({
  status,
  className,
}: {
  status: UpdateStatus | VoteStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", dotColor[status] ?? "bg-muted-foreground")}
      />
      {status}
    </Badge>
  )
}

export function TypeBadge({
  type,
  className,
}: {
  type: CardType
  className?: string
}) {
  if (type === "vote") {
    return (
      <Badge
        variant="secondary"
        className={cn("gap-1 text-accent-foreground", className)}
      >
        <VoteIcon data-icon="inline-start" />
        Vote
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className={cn("gap-1", className)}>
      <Megaphone data-icon="inline-start" />
      Update
    </Badge>
  )
}
