import type { DataSource, StrataAppData } from "@/lib/strata-app-data"
import type { ActivityItem, Card, DocItem, NavKey, Person } from "@/lib/types"

export type SearchResultKind =
  | "Card"
  | "Document"
  | "Project"
  | "Activity"
  | "Budget"
  | "Vendor"
  | "Member"

export interface SearchResult {
  key: string
  kind: SearchResultKind
  title: string
  excerpt: string
  sourceRefs: string[]
  nav: NavKey
  cardId?: string
  searchText: string
}

export interface SearchRecordsInput {
  dataSource: DataSource
  cards: Card[]
  documents: DocItem[]
  projects: StrataAppData["projects"]
  activity: ActivityItem[]
  budgetLines: StrataAppData["budgetLines"]
  vendors: StrataAppData["vendors"]
  people: Person[]
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function fallbackReference(dataSource: DataSource, kind: string, id: string) {
  return `${dataSource === "fallback" ? "fallback-" : ""}${kind}:${id}`
}

function persistedReferences(
  dataSource: DataSource,
  references: string[] | undefined,
  kind: string,
  id: string,
) {
  if (references?.length) return unique(references)
  if (dataSource === "fallback") return [fallbackReference(dataSource, kind, id)]
  return null
}

function addResult(
  results: SearchResult[],
  result: Omit<SearchResult, "searchText"> & { searchable: Array<string | number | null | undefined> },
) {
  results.push({
    key: result.key,
    kind: result.kind,
    title: result.title,
    excerpt: result.excerpt,
    sourceRefs: unique(result.sourceRefs),
    nav: result.nav,
    cardId: result.cardId,
    searchText: result.searchable.filter((value) => value !== null && value !== undefined).join(" ").toLocaleLowerCase(),
  })
}

export function buildSearchIndex(input: SearchRecordsInput): SearchResult[] {
  const results: SearchResult[] = []

  for (const card of input.cards) {
    const sourceRefs = persistedReferences(input.dataSource, card.sourceRefs, "card", card.id)
    if (!sourceRefs) continue
    const content = card.type === "update" ? `${card.summary} ${card.body}` : card.description
    const related = card.type === "update"
      ? card.comments.map((comment) => `${comment.author} ${comment.body}`).join(" ")
      : card.options.map((option) => option.label).join(" ")

    addResult(results, {
      key: `card:${card.id}`,
      kind: "Card",
      title: card.title,
      excerpt: card.type === "update" ? card.summary : card.description,
      sourceRefs,
      nav: card.type === "vote" ? "votes" : "cards",
      cardId: card.id,
      searchable: [card.title, card.area, card.status, card.audience, content, related],
    })
  }

  for (const document of input.documents) {
    const sourceRefs = persistedReferences(input.dataSource, document.sourceRefs, "document", document.id)
    if (!sourceRefs) continue
    addResult(results, {
      key: `document:${document.id}`,
      kind: "Document",
      title: document.name,
      excerpt: document.summary ?? `${document.category} · ${document.extractionStatus}`,
      sourceRefs,
      nav: "documents",
      searchable: [document.name, document.category, document.fileSize, document.extractionStatus, document.summary, ...(document.linkedTo ?? []), ...(document.citations ?? [])],
    })
  }

  for (const project of input.projects) {
    const sourceRefs = persistedReferences(input.dataSource, project.sourceRefs, "project", project.id)
    if (!sourceRefs) continue
    addResult(results, {
      key: `project:${project.id}`,
      kind: "Project",
      title: project.name,
      excerpt: `${project.status} · ${project.progress}% complete · ${project.plannedScope}`,
      sourceRefs,
      nav: "projects",
      searchable: [
        project.name,
        project.status,
        project.progress,
        project.plannedScope,
        project.aiSummary,
        ...project.evidence,
        ...project.milestones.flatMap((milestone) => [milestone.label, milestone.status, milestone.planned, milestone.actual]),
        ...project.variations.flatMap((variation) => [variation.title, variation.status, variation.amount]),
      ],
    })
  }

  for (const event of input.activity) {
    addResult(results, {
      key: `activity:${event.id}`,
      kind: "Activity",
      title: `${event.actor} ${event.action}`,
      excerpt: `${event.target} · ${event.time}`,
      sourceRefs: [event.sourceRef],
      nav: "dashboard",
      searchable: [event.actor, event.action, event.target, event.time],
    })
  }

  input.budgetLines.forEach((line, index) => {
    const sourceRefs = persistedReferences(input.dataSource, line.sourceRefs, "budget-line", String(index + 1))
    if (!sourceRefs) return
    addResult(results, {
      key: `budget:${line.category}:${index}`,
      kind: "Budget",
      title: line.category,
      excerpt: `${line.account} · approved ${line.approved} · committed ${line.committed} · actual ${line.actual}`,
      sourceRefs,
      nav: "budget",
      searchable: [line.category, line.account, line.approved, line.committed, line.actual, line.risk],
    })
  })

  for (const vendor of input.vendors) {
    addResult(results, {
      key: `vendor:${vendor.id}`,
      kind: "Vendor",
      title: vendor.name,
      excerpt: `${vendor.insuranceStatus} · ${vendor.contactEmail}`,
      sourceRefs: [fallbackReference(input.dataSource, "vendor", vendor.id)],
      nav: "budget",
      searchable: [vendor.name, vendor.contactEmail, vendor.phone, vendor.insuranceStatus],
    })
  }

  for (const person of input.people) {
    addResult(results, {
      key: `member:${person.id}`,
      kind: "Member",
      title: person.name,
      excerpt: `${person.role} · ${person.contextLabel}`,
      sourceRefs: [fallbackReference(input.dataSource, "member", person.id)],
      nav: "people",
      searchable: [person.name, person.email, person.role, person.contextLabel],
    })
  }

  return results
}

export function searchRecords(index: SearchResult[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  return index.filter((result) => terms.every((term) => result.searchText.includes(term)))
}
