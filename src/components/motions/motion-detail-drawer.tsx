"use client"

import * as React from "react"
import { Gavel, LockKeyhole } from "lucide-react"

import { authHeaders } from "@/lib/supabase/auth-headers"
import type { Motion } from "@/lib/strata-data"
import { useAppStore } from "@/components/app-store"
import { MotionStatusBadge } from "@/components/motions/motion-status-badge"
import { StatusMessage, type StatusValue } from "@/components/status-message"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const readyStatus: StatusValue = { state: "idle", message: "Motion lifecycle ready." }

export function MotionDetailDrawer() {
  const { motions, selectedMotionId, closeMotion } = useAppStore()
  const motion = motions.find((item) => item.id === selectedMotionId) ?? null

  return (
    <Sheet open={!!motion} onOpenChange={(open: boolean) => !open && closeMotion()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetTitle className="sr-only">{motion ? motion.title : "Motion details"}</SheetTitle>
        {motion && <DrawerBody motion={motion} onClose={closeMotion} />}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({ motion, onClose }: { motion: Motion; onClose: () => void }) {
  const { refreshData } = useAppStore()
  const [status, setStatus] = React.useState<StatusValue>(readyStatus)
  const pending = status.state === "loading"
  const terminal = motion.statusValue === "decided" || motion.statusValue === "withdrawn"

  async function advance(to: "open" | "decided" | "withdrawn") {
    setStatus({ state: "loading", message: `Advancing motion to ${to}...` })

    try {
      const response = await fetch("/api/workflow/advance-motion", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ motionId: motion.id, to }),
      })
      const body = (await response.json()) as { message?: string; error?: string }

      if (!response.ok) {
        throw new Error(body.error ?? "Motion could not be advanced")
      }

      setStatus({ state: "success", message: body.message ?? `Motion advanced to ${to}` })
      await refreshData()
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Motion advance failed",
      })
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-6 pb-5 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <MotionStatusBadge status={motion.status} />
          {terminal ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" />
              Locked &mdash; terminal motion
            </span>
          ) : null}
        </div>
        <h2 className="text-pretty text-lg font-semibold leading-snug">{motion.title}</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Raised by {motion.creator}</span>
          <span>Created {motion.created}</span>
          <span>Updated {motion.updated}</span>
          {motion.openedAt ? <span>Opened {motion.openedAt}</span> : null}
          {motion.decidedAt ? <span>Decided {motion.decidedAt}</span> : null}
          {motion.withdrawnAt ? <span>Withdrawn {motion.withdrawnAt}</span> : null}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5">
        <section className="flex flex-col gap-2" aria-labelledby="motion-context-heading">
          <h3 id="motion-context-heading" className="text-sm font-medium">
            Context
          </h3>
          <p className="text-pretty leading-relaxed text-foreground">
            {motion.context || "No context recorded."}
          </p>
        </section>

        <Separator />

        <section className="grid gap-3" aria-labelledby="motion-lifecycle-heading">
          <div>
            <h3 id="motion-lifecycle-heading" className="flex items-center gap-1.5 font-semibold">
              <Gavel className="size-4" />
              Lifecycle
            </h3>
            <p className="text-sm text-muted-foreground">
              A motion moves draft &rarr; open &rarr; decided or withdrawn. Terminal motions cannot be
              edited as if still open.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => advance("open")}
              disabled={pending || terminal || motion.statusValue !== "draft"}
            >
              Open motion
            </Button>
            <Button
              type="button"
              onClick={() => advance("decided")}
              disabled={pending || terminal || motion.statusValue !== "open"}
            >
              Decide
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => advance("withdrawn")}
              disabled={pending || terminal || motion.statusValue !== "open"}
            >
              Withdraw
            </Button>
          </div>

          {terminal ? (
            <p className="text-xs text-muted-foreground">
              This motion is {motion.statusValue.toLowerCase()} and locked. Advance controls are disabled.
            </p>
          ) : null}

          <StatusMessage status={status} />
        </section>

        <Separator />

        <section className="grid gap-3" aria-labelledby="motion-audit-heading">
          <div>
            <h3 id="motion-audit-heading" className="font-semibold">Motion audit history</h3>
            <p className="text-sm text-muted-foreground">Persisted lifecycle events for this motion.</p>
          </div>
          {motion.audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visible audit events.</p>
          ) : (
            <div className="grid gap-2">
              {motion.audit.map((event, index) => (
                <div key={event.id ?? `motion-audit-${index}`} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{event.action}</p>
                  <p className="text-muted-foreground">{event.actor} &middot; {event.target}</p>
                  <p className="text-xs text-muted-foreground">{event.time}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Separator />
      <div className="flex items-center justify-end px-6 py-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
