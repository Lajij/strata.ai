import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  citation,
  evidenceMissing,
  listVisibleCards,
  listVisibleDocuments,
  listVisibleProjects,
  requireActiveScope,
} from "../lib/scoped-data";

export default defineTool({
  description: "Search the current authenticated member's visible strata cards, documents, and projects. Returns persisted source references for every match.",
  inputSchema: z.object({
    query: z.string().trim().min(2).max(200),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  async execute({ query, limit }, ctx) {
    const scope = await requireActiveScope(ctx);
    const [cards, documents, projects] = await Promise.all([
      listVisibleCards(scope),
      listVisibleDocuments(scope),
      listVisibleProjects(scope),
    ]);
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matches = [
      ...cards.map((card) => ({
        kind: "card" as const,
        id: card.id,
        title: card.title,
        summary: `${card.type}; ${card.status}. ${card.description}`,
        search: `${card.title} ${card.description} ${card.type} ${card.status}`.toLocaleLowerCase(),
      })),
      ...documents.map((document) => ({
        kind: "document" as const,
        id: document.id,
        title: document.title,
        summary: `${document.document_type}; ${document.indexed_status}. ${document.summary ?? "No summary recorded."}`,
        search: `${document.title} ${document.document_type} ${document.indexed_status} ${document.summary ?? ""}`.toLocaleLowerCase(),
      })),
      ...projects.map((project) => ({
        kind: "project" as const,
        id: project.id,
        title: project.name,
        summary: `${project.status}; ${project.progress_percent}% complete. ${project.planned_scope}`,
        search: `${project.name} ${project.status} ${project.planned_scope}`.toLocaleLowerCase(),
      })),
    ]
      .filter((record) => terms.every((term) => record.search.includes(term)))
      .slice(0, limit)
      .map((record) => ({
        kind: record.kind,
        id: record.id,
        title: record.title,
        summary: record.summary,
        citations: [citation(`${record.kind}:${record.id}`, `${record.kind}: ${record.title}`)],
      }));

    if (!matches.length) return evidenceMissing("record", JSON.stringify(query));

    return {
      status: "ok" as const,
      query,
      matches,
      citations: matches.flatMap((match) => match.citations),
    };
  },
});
