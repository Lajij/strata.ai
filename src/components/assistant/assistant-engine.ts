import type { Card, VoteCard } from "@/lib/types"
import { daysUntil, participationPct } from "@/lib/format"

export interface AssistantReply {
  text: string
  chips?: string[]
}

export const SUGGESTED_PROMPTS = [
  "What needs my attention?",
  "How is voter turnout looking?",
  "Draft an update about water shut-off",
  "Which votes are closing soon?",
]

export function generateReply(
  input: string,
  cards: Card[],
  buildingName = "the building",
): AssistantReply {
  const q = input.toLowerCase()
  const votes = cards.filter((c): c is VoteCard => c.type === "vote")

  if (q.includes("attention") || q.includes("todo") || q.includes("to do")) {
    const drafts = cards.filter((c) => c.status === "Draft")
    const closing = votes.filter((v) => v.status === "Closing soon")
    const lines: string[] = []
    if (closing.length)
      lines.push(
        `${closing.length} vote${closing.length === 1 ? "" : "s"} closing soon, including "${closing[0].title}".`,
      )
    if (drafts.length)
      lines.push(
        `${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting to be reviewed and published.`,
      )
    const lowTurnout = votes.filter(
      (v) => v.status !== "Closed" && v.status !== "Draft" && participationPct(v) < 40,
    )
    if (lowTurnout.length)
      lines.push(
        `Turnout is below 40% on "${lowTurnout[0].title}" — a reminder could help.`,
      )
    return {
      text: `Here's what needs attention today:\n\n${lines.map((l) => `• ${l}`).join("\n")}`,
      chips: ["Which votes are closing soon?", "Send a reminder"],
    }
  }

  if (q.includes("turnout") || q.includes("participation") || q.includes("voter")) {
    const active = votes.filter((v) => v.status === "Open" || v.status === "Closing soon")
    const lines = active.map(
      (v) => `• "${v.title}" — ${participationPct(v)}% (${v.participation}/${v.eligibleCount})`,
    )
    return {
      text: `Current turnout across active votes:\n\n${lines.join("\n")}`,
      chips: ["What needs my attention?", "Draft a reminder update"],
    }
  }

  if (q.includes("closing") || q.includes("deadline") || q.includes("soon")) {
    const upcoming = votes
      .filter((v) => v.status !== "Closed" && v.status !== "Draft")
      .map((v) => ({ v, d: daysUntil(v.deadline) }))
      .filter((x) => x.d !== null)
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
    const lines = upcoming.map(
      ({ v, d }) => `• "${v.title}" — closes in ${d} day${d === 1 ? "" : "s"}`,
    )
    return {
      text: lines.length
        ? `Votes ordered by closing date:\n\n${lines.join("\n")}`
        : "There are no open votes with upcoming deadlines right now.",
      chips: ["How is voter turnout looking?"],
    }
  }

  if (q.includes("draft") || q.includes("write") || q.includes("announce") || q.includes("update about")) {
    const topic = input.replace(/.*about/i, "").trim() || "the building"
    return {
      text: `Here's a draft update about ${topic}:\n\n"Dear residents, please be advised regarding ${topic}. We will share timing and any actions required shortly. Thank you for your cooperation as we keep ${buildingName} running smoothly."\n\nUse "Create card" in the header to publish or refine this.`,
      chips: ["What needs my attention?", "How is voter turnout looking?"],
    }
  }

  if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
    return {
      text: "Hi Grace. I'm your building assistant. I can summarise what needs attention, check voter turnout, or help draft an update. What would you like to do?",
      chips: SUGGESTED_PROMPTS.slice(0, 3),
    }
  }

  return {
    text: `I can help with updates, votes, turnout and drafting announcements for ${buildingName}. Try one of these:`,
    chips: SUGGESTED_PROMPTS,
  }
}
