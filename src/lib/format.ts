import type { Card, VoteCard } from "@/lib/types"

export function formatDate(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function totalVotes(card: VoteCard): number {
  return card.options.reduce((sum, o) => sum + o.votes, 0)
}

export function leadingOption(card: VoteCard) {
  return [...card.options].sort((a, b) => b.votes - a.votes)[0]
}

export function participationPct(card: VoteCard): number {
  if (card.eligibleCount === 0) return 0
  return Math.round((card.participation / card.eligibleCount) * 100)
}

export function daysUntil(iso: string): number | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function cardStatus(card: Card): string {
  return card.status
}
