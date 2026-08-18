"use client"

import { CalendarClock, MapPin, MessageSquare, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Card as CardModel, ViewMode } from "@/lib/types"
import { daysUntil, formatDate, participationPct } from "@/lib/format"
import { useAppStore } from "@/components/app-store"
import { StatusBadge, TypeBadge } from "@/components/status-badge"
import { VoteResults } from "@/components/cards/vote-results"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function CardTile({
  card,
  view = "grid",
}: {
  card: CardModel
  view?: ViewMode
}) {
  const { openCard } = useAppStore()
  const days = card.type === "vote" ? daysUntil(card.deadline) : null

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => openCard(card.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          openCard(card.id)
        }
      }}
      className={cn(
        "cursor-pointer gap-0 py-0 transition-shadow outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        view === "list" && "sm:flex-row sm:items-stretch",
      )}
    >
      <CardHeader
        className={cn(
          "gap-3 px-5 pt-5",
          view === "list" && "flex-1 sm:pb-5",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={card.type} />
          <StatusBadge status={card.status} />
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <MapPin data-icon="inline-start" />
            {card.area}
          </Badge>
        </div>
        <CardTitle className="text-pretty text-base leading-snug">
          {card.title}
        </CardTitle>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {card.type === "update" ? card.summary : card.description}
        </p>
      </CardHeader>

      <CardContent
        className={cn(
          "px-5",
          view === "list" ? "sm:flex sm:w-72 sm:shrink-0 sm:items-center sm:border-l sm:border-border" : "",
        )}
      >
        {card.type === "vote" ? (
          <div className="w-full">
            <VoteResults card={card} compact />
          </div>
        ) : null}
      </CardContent>

      <CardFooter
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-5 pt-3 text-xs text-muted-foreground",
          view === "list" && "sm:hidden",
        )}
      >
        {card.type === "update" ? (
          <>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {card.status === "Scheduled" ? "Scheduled " : "Published "}
              {formatDate(card.publishDate)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" />
              {card.commentCount} comments
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {days !== null && days > 0
                ? `Closes in ${days} day${days === 1 ? "" : "s"}`
                : `Closed ${formatDate(card.deadline)}`}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {participationPct(card)}% turnout
            </span>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
