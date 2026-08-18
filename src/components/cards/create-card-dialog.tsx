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
  message: "Ready to create a committee card.",
}

export function CreateCardDialog() {
  const { createOpen, setCreateOpen, refreshData, openCard } = useAppStore()
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [status, setStatus] = React.useState<StatusValue>(readyStatus)
  const pending = status.state === "loading"

  function reset() {
    setTitle("")
    setDescription("")
    setStatus(readyStatus)
  }

  function handleOpenChange(open: boolean) {
    setCreateOpen(open)
    if (!open && !pending) reset()
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus({ state: "loading", message: "Creating and auditing card..." })

    try {
      const response = await fetch("/api/workflow/create-card", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ title, description, type: "general", visibility: "all" }),
      })
      const body = (await response.json()) as { id?: string; message?: string; error?: string }

      if (!response.ok || !body.id) {
        throw new Error(body.error ?? "Card creation failed")
      }

      setStatus({ state: "success", message: body.message ?? "Card created" })
      await refreshData()
      setCreateOpen(false)
      openCard(body.id)
      reset()
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Card creation failed",
      })
    }
  }

  return (
    <Dialog open={createOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle>New card</DialogTitle>
            <DialogDescription>
              Create an auditable committee record. Proposals, votes, and conditions are added from its detail view.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="px-6 py-5">
            <Field>
              <FieldLabel htmlFor="card-title">Card title</FieldLabel>
              <Input
                id="card-title"
                aria-label="Card title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={pending}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="card-description">Card description</FieldLabel>
              <Textarea
                id="card-description"
                aria-label="Card description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={pending}
                rows={5}
                required
              />
            </Field>
            <StatusMessage status={status} />
          </FieldGroup>

          <DialogFooter className="gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" aria-label="Create card" disabled={pending}>
              {pending ? "Creating..." : "Create card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
