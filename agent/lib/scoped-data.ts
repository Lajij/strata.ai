import type { ToolContext } from "eve/tools";

import type { Database, MemberRole } from "../../src/lib/supabase/types";
import {
  evalFixtureCards,
  evalFixtureDocuments,
  evalFixtureProjects,
  getEvalFixtureScope,
} from "./eval-fixtures";
import { getAgentAdminClient } from "./supabase";

type Card = Database["public"]["Tables"]["cards"]["Row"];

export interface AgentScope {
  committeeId: string;
  memberId: string;
  role: MemberRole;
  userId: string;
}

const ADMIN_ROLES = new Set<MemberRole>(["admin", "chair", "secretary", "treasurer"]);

export function isAdminScope(scope: AgentScope) {
  return ADMIN_ROLES.has(scope.role);
}

export async function requireActiveSessionScope(session: ToolContext["session"]): Promise<AgentScope> {
  const caller = session.auth.current;
  const fixtureScope = getEvalFixtureScope(caller);
  if (fixtureScope) return fixtureScope;

  const committeeId = caller?.attributes.committeeId;
  const memberId = caller?.attributes.memberId;

  if (!caller || caller.principalType !== "user" || typeof committeeId !== "string" || typeof memberId !== "string") {
    throw new Error("Active member scope is required.");
  }

  const { data, error } = await getAgentAdminClient()
    .from("members")
    .select("id,committee_id,user_id,role,status")
    .eq("id", memberId)
    .eq("committee_id", committeeId)
    .eq("user_id", caller.principalId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data?.user_id) {
    throw new Error("Active member scope is required.");
  }

  return {
    committeeId: data.committee_id,
    memberId: data.id,
    role: data.role,
    userId: data.user_id,
  };
}

export async function requireActiveScope(ctx: ToolContext): Promise<AgentScope> {
  return requireActiveSessionScope(ctx.session);
}

async function customCardIds(scope: AgentScope) {
  const { data, error } = await getAgentAdminClient()
    .from("card_access")
    .select("card_id")
    .eq("member_id", scope.memberId);

  if (error) throw new Error("Scoped card access could not be read.");
  return new Set((data ?? []).map((row) => row.card_id));
}

async function filterVisibleCards(scope: AgentScope, cards: Card[]) {
  if (isAdminScope(scope)) return cards;
  const custom = await customCardIds(scope);
  return cards.filter((card) => card.visibility === "all" || (card.visibility === "custom" && custom.has(card.id)));
}

export async function listVisibleCards(scope: AgentScope) {
  const fixtureCards = evalFixtureCards(scope);
  if (fixtureCards) return fixtureCards;

  const { data, error } = await getAgentAdminClient()
    .from("cards")
    .select("id,committee_id,title,description,type,status,visibility,creator_member_id,linked_project_id,created_at,updated_at")
    .eq("committee_id", scope.committeeId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw new Error("Scoped cards could not be read.");
  return filterVisibleCards(scope, data ?? []);
}

export async function findVisibleCard(scope: AgentScope, cardId: string) {
  const fixtureCards = evalFixtureCards(scope);
  if (fixtureCards) return fixtureCards.find((card) => card.id === cardId) ?? null;

  const { data, error } = await getAgentAdminClient()
    .from("cards")
    .select("id,committee_id,title,description,type,status,visibility,creator_member_id,linked_project_id,created_at,updated_at")
    .eq("committee_id", scope.committeeId)
    .eq("id", cardId)
    .maybeSingle();

  if (error || !data) return null;
  return (await filterVisibleCards(scope, [data]))[0] ?? null;
}

export async function listVisibleDocuments(scope: AgentScope) {
  const fixtureDocuments = evalFixtureDocuments(scope);
  if (fixtureDocuments) return fixtureDocuments;

  const { data, error } = await getAgentAdminClient()
    .from("documents")
    .select("id,committee_id,title,document_type,source,source_date,version_label,visibility,storage_path,extracted_text_path,markdown_path,indexed_status,summary,metadata,created_by_member_id,created_at")
    .eq("committee_id", scope.committeeId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error("Scoped documents could not be read.");
  if (isAdminScope(scope)) return data ?? [];
  return (data ?? []).filter((document) => document.visibility === "all");
}

export async function findVisibleDocument(scope: AgentScope, documentId: string) {
  const fixtureDocuments = evalFixtureDocuments(scope);
  if (fixtureDocuments) return fixtureDocuments.find((document) => document.id === documentId) ?? null;

  const { data, error } = await getAgentAdminClient()
    .from("documents")
    .select("id,committee_id,title,document_type,source,source_date,version_label,visibility,storage_path,extracted_text_path,markdown_path,indexed_status,summary,metadata,created_by_member_id,created_at")
    .eq("committee_id", scope.committeeId)
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) return null;
  return isAdminScope(scope) || data.visibility === "all" ? data : null;
}

export async function listVisibleProjects(scope: AgentScope) {
  const fixtureProjects = evalFixtureProjects(scope);
  if (fixtureProjects) return fixtureProjects;

  const { data, error } = await getAgentAdminClient()
    .from("projects")
    .select("id,committee_id,name,status,planned_scope,progress_percent,budget_allowance_id,created_at")
    .eq("committee_id", scope.committeeId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error("Scoped projects could not be read.");
  return data ?? [];
}

export async function findVisibleProject(scope: AgentScope, projectId: string) {
  const fixtureProjects = evalFixtureProjects(scope);
  if (fixtureProjects) return fixtureProjects.find((project) => project.id === projectId) ?? null;

  const { data, error } = await getAgentAdminClient()
    .from("projects")
    .select("id,committee_id,name,status,planned_scope,progress_percent,budget_allowance_id,created_at")
    .eq("committee_id", scope.committeeId)
    .eq("id", projectId)
    .maybeSingle();

  return error ? null : data;
}

export async function visibleCardIdSet(scope: AgentScope, cardIds: Array<string | null>) {
  const ids = [...new Set(cardIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Set<string>();

  const fixtureCards = evalFixtureCards(scope);
  if (fixtureCards) return new Set(fixtureCards.filter((card) => ids.includes(card.id)).map((card) => card.id));

  const { data, error } = await getAgentAdminClient()
    .from("cards")
    .select("id,committee_id,title,description,type,status,visibility,creator_member_id,linked_project_id,created_at,updated_at")
    .eq("committee_id", scope.committeeId)
    .in("id", ids);

  if (error) throw new Error("Scoped card references could not be read.");
  return new Set((await filterVisibleCards(scope, data ?? [])).map((card) => card.id));
}

export async function visibleDocumentIdSet(scope: AgentScope, documentIds: Array<string | null>) {
  const ids = [...new Set(documentIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Set<string>();

  const fixtureDocuments = evalFixtureDocuments(scope);
  if (fixtureDocuments) return new Set(fixtureDocuments.filter((document) => ids.includes(document.id)).map((document) => document.id));

  const { data, error } = await getAgentAdminClient()
    .from("documents")
    .select("id,committee_id,title,document_type,source,source_date,version_label,visibility,storage_path,extracted_text_path,markdown_path,indexed_status,summary,metadata,created_by_member_id,created_at")
    .eq("committee_id", scope.committeeId)
    .in("id", ids);

  if (error) throw new Error("Scoped document references could not be read.");
  const visible = isAdminScope(scope) ? data ?? [] : (data ?? []).filter((document) => document.visibility === "all");
  return new Set(visible.map((document) => document.id));
}

export function evidenceMissing(kind: string, idOrQuery: string) {
  return {
    status: "evidence_missing" as const,
    message: `Evidence missing: no visible ${kind} evidence matched ${idOrQuery}.`,
    citations: [] as Array<{ label: string; ref: string }>,
  };
}

export function citation(ref: string, label: string) {
  return { label, ref };
}
