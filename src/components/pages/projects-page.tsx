"use client"

import { CalendarClock, CircleDollarSign, FolderKanban, Milestone } from "lucide-react"

import { useAppStore } from "@/components/app-store"
import { ProjectAiTool } from "@/components/assistant/ai-tools"
import { EvidenceReferences } from "@/components/evidence-references"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
})

export function ProjectsPage() {
  const { rawProjects } = useAppStore()

  if (rawProjects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No visible projects</CardTitle>
          <CardDescription>
            No project records are available to this session through RLS.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {rawProjects.map((project) => (
        <Card key={project.id}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FolderKanban className="size-4 text-primary" aria-hidden="true" />
                  <CardTitle>{project.name}</CardTitle>
                </div>
                <CardDescription className="mt-2 max-w-3xl leading-6">
                  {project.plannedScope}
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit">
                {project.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            <section aria-labelledby={`progress-${project.id}`}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <h2 id={`progress-${project.id}`} className="font-medium">
                  Progress
                </h2>
                <span className="tabular-nums text-muted-foreground">
                  {project.progress}% complete
                </span>
              </div>
              <Progress value={project.progress} aria-labelledby={`progress-${project.id}`} />
            </section>

            <section aria-labelledby={`financials-${project.id}`}>
              <div className="mb-3 flex items-center gap-2">
                <CircleDollarSign className="size-4 text-primary" aria-hidden="true" />
                <h2 id={`financials-${project.id}`} className="text-sm font-semibold">
                  Financial position
                </h2>
              </div>
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Allowance", project.allowance],
                  ["Committed", project.committed],
                  ["Invoiced", project.invoiced],
                  ["Remaining", project.remaining],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-border bg-muted/30 p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums">
                      {currency.format(Number(value))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section aria-labelledby={`milestones-${project.id}`}>
                <div className="mb-3 flex items-center gap-2">
                  <Milestone className="size-4 text-primary" aria-hidden="true" />
                  <h2 id={`milestones-${project.id}`} className="text-sm font-semibold">
                    Milestones
                  </h2>
                </div>
                {project.milestones.length ? (
                  <ul className="flex flex-col gap-2">
                    {project.milestones.map((milestone) => (
                      <li key={`${milestone.label}-${milestone.planned}`} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium">{milestone.label}</p>
                          <Badge variant="secondary">{milestone.status}</Badge>
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock className="size-3.5" aria-hidden="true" />
                          Planned {milestone.planned} · Actual {milestone.actual || "Not recorded"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No milestones recorded.</p>
                )}
              </section>

              <section aria-labelledby={`variations-${project.id}`}>
                <h2 id={`variations-${project.id}`} className="mb-3 text-sm font-semibold">
                  Variations
                </h2>
                {project.variations.length ? (
                  <ul className="flex flex-col gap-2">
                    {project.variations.map((variation) => (
                      <li key={variation.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{variation.title}</p>
                            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                              variation:{variation.id}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">
                              {currency.format(variation.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">{variation.status}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No variations recorded.</p>
                )}
              </section>
            </div>

            <Separator />

            <section aria-labelledby={`summary-${project.id}`} className="rounded-lg border border-border bg-muted/30 p-4">
              <h2 id={`summary-${project.id}`} className="text-sm font-semibold">
                Recorded AI summary
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {project.aiSummary || "No project summary is available."}
              </p>
            </section>

            <EvidenceReferences
              references={
                project.sourceRefs?.length
                  ? project.sourceRefs
                  : [`project:${project.id}`, ...project.evidence]
              }
              label="Project evidence records"
            />

            <ProjectAiTool projectId={project.id} projectName={project.name} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
