"use client"

import * as React from "react"
import { FileSearch, Scale, Send, Sparkles } from "lucide-react"

import type { Card as BuildingCard } from "@/lib/types"
import {
  AiResultCard,
  initialAiState,
  runAiTask,
  type AiRunState,
  type AiTask,
} from "@/components/assistant/ai-tools"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const CARD_AI_ACTIONS: {
  label: "Card brief" | "Quote risk" | "NSW law lookup"
  task: AiTask
  icon: typeof Sparkles
}[] = [
  { label: "Card brief", task: "card-brief", icon: Sparkles },
  { label: "Quote risk", task: "quote-risk", icon: FileSearch },
  { label: "NSW law lookup", task: "nsw-law-lookup", icon: Scale },
]

export function CardAiPanel({ card }: { card: BuildingCard | undefined }) {
  const [question, setQuestion] = React.useState("")
  const [state, setState] = React.useState<AiRunState>(initialAiState)

  function run(task: AiTask) {
    if (!card) return
    void runAiTask(task, { cardId: card.id, question }, setState)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <CardTitle>AI panel</CardTitle>
        </div>
        <CardDescription>
          {card
            ? `Ask cited, non-binding questions about ${card.title}.`
            : "AI actions become available when a visible card is present."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {CARD_AI_ACTIONS.map((action) => {
            const Icon = action.icon

            return (
              <Button
                key={action.label}
                type="button"
                variant="outline"
                className="min-h-11 justify-start"
                onClick={() => run(action.task)}
                disabled={!card || state.status === "loading"}
              >
                <Icon data-icon="inline-start" />
                {action.label}
              </Button>
            )
          })}
        </div>

        <div className="flex gap-2">
          <Input
            aria-label="Ask AI"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about the visible card"
            className="min-h-11 min-w-0 flex-1"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-11 shrink-0"
            aria-label="Send AI question"
            title="Send AI question"
            onClick={() => run("thread-summary")}
            disabled={!card || state.status === "loading" || !question.trim()}
          >
            <Send />
          </Button>
        </div>

        <AiResultCard state={state} />
      </CardContent>
    </Card>
  )
}
