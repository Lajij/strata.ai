"use client"

import * as React from "react"
import { FileText, Search, Upload } from "lucide-react"

import { formatDate } from "@/lib/format"
import { authHeaders } from "@/lib/supabase/auth-headers"
import { useAppStore } from "@/components/app-store"
import { DocumentAiTool } from "@/components/assistant/ai-tools"
import { EvidenceReferences } from "@/components/evidence-references"
import { StatusMessage, type StatusValue } from "@/components/status-message"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

const readyStatus: StatusValue = {
  state: "idle",
  message: "Choose a text, Markdown, PDF, or DOCX file.",
}

export function DocumentsPage() {
  const { documents, refreshData } = useAppStore()
  const [query, setQuery] = React.useState("")
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [status, setStatus] = React.useState<StatusValue>(readyStatus)
  const formRef = React.useRef<HTMLFormElement>(null)
  const pending = status.state === "loading"

  const filtered = documents.filter((document) =>
    `${document.name} ${document.category} ${document.extractionStatus}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  function resetUpload() {
    formRef.current?.reset()
    setStatus(readyStatus)
  }

  function handleUploadOpenChange(open: boolean) {
    setUploadOpen(open)
    if (!open && !pending) resetUpload()
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus({ state: "loading", message: "Uploading and registering document..." })

    try {
      const payload = new FormData(event.currentTarget)
      const response = await fetch("/api/documents/create", {
        method: "POST",
        headers: await authHeaders({ contentType: "multipart" }),
        body: payload,
      })
      const body = (await response.json()) as { message?: string; error?: string }

      if (!response.ok) {
        throw new Error(body.error ?? "Document upload failed")
      }

      setStatus({ state: "success", message: body.message ?? "Document uploaded" })
      await refreshData()
    } catch (error) {
      setStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Document upload failed",
      })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="h-9 w-full sm:w-72">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search documents..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
        <Button aria-label="Open document upload" onClick={() => setUploadOpen(true)}>
          <Upload data-icon="inline-start" />
          Upload document
        </Button>
      </div>

      <Card className="py-0">
        <CardContent className="flex flex-col px-0">
          {filtered.map((document, index) => (
            <div key={document.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{document.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDate(document.updated)}
                    {document.fileSize ? ` · ${document.fileSize}` : ""}
                  </p>
                </div>
                <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                  <Badge variant="outline">{document.extractionStatus}</Badge>
                  <Badge variant="secondary">{document.category}</Badge>
                </div>
              </div>
              <div className="px-4 pb-3">
                <details className="mb-3 rounded-lg border border-border px-3 py-2">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium md:min-h-0">Document details</summary>
                  <div className="mt-3 flex flex-col gap-3 text-sm">
                    <div className="flex flex-wrap gap-2 sm:hidden">
                      <Badge variant="outline">{document.extractionStatus}</Badge>
                      <Badge variant="secondary">{document.category}</Badge>
                    </div>
                    <p>{document.summary ?? "No document summary is available."}</p>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Linked records</p>
                      {document.linkedTo?.length ? (
                        <ul className="mt-1 list-disc pl-4">
                          {document.linkedTo.map((record) => <li key={record}>{record}</li>)}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          No linked card or project record.
                        </p>
                      )}
                    </div>
                    <EvidenceReferences
                      references={
                        document.sourceRefs?.length
                          ? document.sourceRefs
                          : [`document:${document.id}`]
                      }
                      label="Document evidence records"
                    />
                  </div>
                </details>
                <DocumentAiTool documentId={document.id} documentName={document.name} />
              </div>
              {index < filtered.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={handleUploadOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <form ref={formRef} onSubmit={uploadDocument} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Upload document</DialogTitle>
              <DialogDescription>
                Text and Markdown files are indexed immediately. PDF and DOCX files show an extraction-pending state.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="document-title">Document title</Label>
              <Input id="document-title" name="title" aria-label="Document title" disabled={pending} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="document-type">Document type</Label>
              <Input
                id="document-type"
                name="documentType"
                aria-label="Document type"
                placeholder="e.g. Committee minutes"
                disabled={pending}
                required
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="document-visibility">Document visibility</Label>
                <select
                  id="document-visibility"
                  name="visibility"
                  aria-label="Document visibility"
                  defaultValue="all"
                  disabled={pending}
                  className="h-11 rounded-lg border border-input bg-background px-2 text-sm md:h-8"
                >
                  <option value="all">All members</option>
                  <option value="admins">Admins only</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="document-source-date">Document source date</Label>
                <Input
                  id="document-source-date"
                  name="sourceDate"
                  type="date"
                  aria-label="Document source date"
                  disabled={pending}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="document-file">Document file</Label>
              <Input
                id="document-file"
                name="file"
                type="file"
                aria-label="Document file"
                accept=".txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={pending}
                required
              />
            </div>
            <StatusMessage status={status} />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleUploadOpenChange(false)}
                disabled={pending}
              >
                Close
              </Button>
              <Button type="submit" aria-label="Upload document" disabled={pending}>
                {pending ? "Uploading..." : "Upload document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
