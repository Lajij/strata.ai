"use client"

import * as React from "react"

import { useAppStore } from "@/components/app-store"
import { StatusMessage, type StatusValue } from "@/components/status-message"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { authHeaders } from "@/lib/supabase/auth-headers"

const readyStatus: StatusValue = {
  state: "idle",
  message: "Ready to raise a motion.",
}

export function CreateMotionDialog() {
  const { motionCreateOpen, setMotionCreateOpen, refreshData, openMotion } = useAppStore()
  const [title, setTitle] = React.useState("")
  const [context, setContext] = React.useState("")
  const [status, setStatus] = React.useState<StatusValue>(readyStatus)
  const pending = status.state === "loading"

  function reset() {
    setTitle("")
    setContext("")
    setStatus(readyStatus)
  }

  function handleOpenChange(open: boolean) {
    setMotionCreateOpen(open)
    if (!open && !pending) reset()
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus({ state: "loading", message: "Creating and auditing motion..." })

    try {
      const response = await fetch("/api/workflow/create-motion", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ title, context }),
      })
      const body = (await response.json()) as { id?: string; message?: string; error?: string }

      if (!response.ok || !body.id) {
        throw new Error(body.error ?? "Motion creation failed")
      }

      setStatus({ state: "success", message: body.message ?? "Motion created" })
      await refreshData()
      setMotionCreateOpen(false)
      openMotion(body.id)
      reset()
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Motion creation failed",
      })
    }
  }

  return (
    <Dialog open={motionCreateOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>New motion</DialogTitle>
            <DialogDescription>
              Raise an auditable committee motion. It starts in draft and is advanced through its
              detail view: draft &rarr; open &rarr; decided or withdrawn.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="px-6 py-5">
            <Field>
              <FieldLabel htmlFor="motion-title">Motion title</FieldLabel>
              <Input
                id="motion-title"
                aria-label="Motion title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={pending}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="motion-context">Context</FieldLabel>
              <Textarea
                id="motion-context"
                aria-label="Motion context"
                value={context}
                onChange={(event) => setContext(event.target.value)}
                disabled={pending}
                rows={5}
              />
            </Field>
            <StatusMessage status={status} />
          </FieldGroup>

          <DialogFooter className="gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" aria-label="Create motion" disabled={pending}>
              {pending ? "Creating..." : "Create motion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
