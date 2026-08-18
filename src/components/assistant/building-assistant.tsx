"use client"

import * as React from "react"
import { ArrowUp, Sparkles, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAppStore } from "@/components/app-store"
import {
  generateReply,
  SUGGESTED_PROMPTS,
  type AssistantReply,
} from "@/components/assistant/assistant-engine"
import {
  aiOutputToMarkdown,
  runAiTask,
  type AiRunState,
  type AiTask,
} from "@/components/assistant/ai-tools"
import { MessageResponse } from "@/components/ai-elements/message"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

interface Message {
  id: string
  role: "user" | "assistant"
  text: string
  chips?: string[]
  markdown?: boolean
  citations?: string[]
  meta?: string
}

// Deterministic router: judgment lives in the AI task, the branch is code.
// Law/rules and budget questions go to the cited server AI; everything else
// gets the instant local heuristics over visible cards.
function routeAiTask(question: string): AiTask | null {
  const q = question.toLowerCase()
  if (/\blaw\b|\bact\b|legislation|by-?law|regulation|rules?\b|nsw|strata schemes/.test(q)) {
    return "nsw-law-lookup"
  }
  if (/budget|levy|levies|fund|spend|invoice|financ/.test(q)) {
    return "budget-insights"
  }
  return null
}

export function BuildingAssistant() {
  const { buildingName, cards, currentUser, assistantOpen, setAssistantOpen } = useAppStore()
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `Hi ${currentUser.name.split(" ")[0] ?? "there"}, I'm your building assistant. Ask me what needs attention, how votes are tracking, or to draft an update.`,
      chips: SUGGESTED_PROMPTS.slice(0, 3),
    },
  ])
  const [input, setInput] = React.useState("")
  const [thinking, setThinking] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const messageId = React.useRef(0)

  const makeMessageId = React.useCallback((prefix: string) => {
    messageId.current += 1
    return `${prefix}-${messageId.current}`
  }, [])

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, thinking])

  const replyLocally = React.useCallback(
    (value: string) => {
      const reply: AssistantReply = generateReply(value, cards, buildingName)
      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId("a"),
          role: "assistant",
          text: reply.text,
          chips: reply.chips,
        },
      ])
    },
    [buildingName, cards, makeMessageId],
  )

  function send(text: string) {
    const value = text.trim()
    if (!value || thinking) return
    const userMsg: Message = { id: makeMessageId("u"), role: "user", text: value }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setThinking(true)

    const task = routeAiTask(value)

    if (!task) {
      window.setTimeout(() => {
        replyLocally(value)
        setThinking(false)
      }, 550)
      return
    }

    void runAiTask(task, { question: value }, (state: AiRunState) => {
      if (state.status === "loading") return

      if (state.status === "success" && state.response) {
        const response = state.response
        setMessages((prev) => [
          ...prev,
          {
            id: makeMessageId("a"),
            role: "assistant",
            text: aiOutputToMarkdown(response),
            markdown: true,
            citations: response.citations,
            meta: `${response.mode ?? "ai"} · ${response.model ?? "no model"} · non-binding`,
          },
        ])
      } else {
        // Preserve fallback behaviour: if the live AI layer is unavailable,
        // answer from local heuristics rather than failing the conversation.
        replyLocally(value)
      }
      setThinking(false)
    })
  }

  return (
    <>
      <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full max-w-full gap-0 overflow-hidden p-0 sm:max-w-[400px]"
        >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-sm font-semibold">Building assistant</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Answers from your building data
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close assistant"
            onClick={() => setAssistantOpen(false)}
          >
            <X />
          </Button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-2">
                <div
                  className={cn(
                    "flex gap-2.5",
                    m.role === "user" && "flex-row-reverse",
                  )}
                >
                  {m.role === "assistant" && (
                    <Avatar className="size-7 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Sparkles className="size-3.5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-secondary text-secondary-foreground",
                    )}
                  >
                    {m.markdown ? <MessageResponse>{m.text}</MessageResponse> : m.text}
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.citations.map((citation) => (
                          <span
                            key={citation}
                            className="rounded-full border border-border bg-background px-2 py-0.5 text-xs"
                          >
                            {citation}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.meta && (
                      <p className="mt-2 font-mono text-[10px] text-muted-foreground">{m.meta}</p>
                    )}
                  </div>
                </div>
                {m.chips && m.chips.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-9">
                    {m.chips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => send(chip)}
                        className="min-h-11 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div className="flex gap-2.5">
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Sparkles className="size-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-secondary px-4 py-3">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </div>

        <form
          className="border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <InputGroup>
            <InputGroupInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder="Ask about updates, votes, turnout..."
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                variant="default"
                size="icon-xs"
                aria-label="Send message"
                disabled={!input.trim() || thinking}
              >
                <ArrowUp />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        </SheetContent>
      </Sheet>

      {/* Launcher */}
      <Button
        onClick={() => setAssistantOpen(!assistantOpen)}
        className={cn(
          "fixed bottom-4 right-4 z-30 h-12 gap-2 rounded-full pl-4 pr-5 shadow-lg transition-transform hover:scale-105",
          assistantOpen && "pointer-events-none opacity-0",
        )}
        aria-label="Open building assistant"
      >
        <Sparkles data-icon="inline-start" />
        Ask assistant
      </Button>
    </>
  )
}
