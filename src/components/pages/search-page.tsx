"use client"

import * as React from "react"
import { ArrowRight, Search } from "lucide-react"

import { useAppStore } from "@/components/app-store"
import { EvidenceReferences } from "@/components/evidence-references"
import { buildSearchIndex, searchRecords } from "@/lib/record-search"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

export function SearchPage() {
  const {
    dataSource,
    cards,
    documents,
    rawProjects,
    activity,
    rawBudgetLines,
    rawVendors,
    people,
    sourceDetail,
    openCard,
    setPage,
  } = useAppStore()
  const [query, setQuery] = React.useState("")
  const deferredQuery = React.useDeferredValue(query)
  const index = React.useMemo(
    () =>
      buildSearchIndex({
        dataSource,
        cards,
        documents,
        projects: rawProjects,
        activity,
        budgetLines: rawBudgetLines,
        vendors: rawVendors,
        people,
      }),
    [dataSource, cards, documents, rawProjects, activity, rawBudgetLines, rawVendors, people],
  )
  const results = React.useMemo(
    () => searchRecords(index, deferredQuery),
    [index, deferredQuery],
  )
  const hasQuery = deferredQuery.trim().length > 0

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Search boundary
        </p>
        <p className="mt-1 text-sm">{sourceDetail}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Search is limited to records already returned for this session. Hidden records are not indexed.
        </p>
      </div>

      <InputGroup className="h-11 w-full">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search all records"
          placeholder="Search cards, documents, projects, activity, budgets, vendors and members..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </InputGroup>

      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {hasQuery ? `${results.length} matching record${results.length === 1 ? "" : "s"}` : `${index.length} visible records available to search`}
      </p>

      {!hasQuery ? (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>Search visible building records</EmptyTitle>
            <EmptyDescription>
              Enter one or more terms. Every result includes the records used to support it.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : results.length === 0 ? (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>No matching records</EmptyTitle>
            <EmptyDescription>
              Try fewer terms or check another spelling. Search does not inspect hidden records.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3">
          {results.map((result) => (
            <Card key={result.key} size="sm">
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{result.kind}</Badge>
                      <p className="font-medium">{result.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{result.excerpt}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (result.cardId) {
                        openCard(result.cardId)
                      } else {
                        setPage(result.nav)
                      }
                    }}
                  >
                    {result.cardId ? "Open record" : "View collection"}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
                <EvidenceReferences
                  references={result.sourceRefs}
                  label={`${result.kind} source records`}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
