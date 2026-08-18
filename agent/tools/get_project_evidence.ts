import { defineTool } from "eve/tools";
import { z } from "zod";

import { evalFixtureProjectEvidence } from "../lib/eval-fixtures";
import { citation, evidenceMissing, findVisibleProject, requireActiveScope, visibleCardIdSet } from "../lib/scoped-data";
import { getAgentAdminClient } from "../lib/supabase";

export default defineTool({
  description: "Read one visible project and its RLS-equivalent milestone, allowance, variation, and invoice evidence with persisted source references.",
  inputSchema: z.object({ projectId: z.string().uuid() }),
  async execute({ projectId }, ctx) {
    const scope = await requireActiveScope(ctx);
    const project = await findVisibleProject(scope, projectId);
    if (!project) return evidenceMissing("project", projectId);
    const fixtureEvidence = evalFixtureProjectEvidence(scope, project);

    if (fixtureEvidence) return fixtureEvidence;
    const admin = getAgentAdminClient();
    const [milestonesResult, variationsResult, invoicesResult, allowanceResult] = await Promise.all([
      admin.from("project_milestones").select("id,label,planned_on,actual_on,status,created_at").eq("committee_id", scope.committeeId).eq("project_id", project.id).order("planned_on"),
      admin.from("variations").select("id,card_id,title,amount,status,scope_change,created_at").eq("committee_id", scope.committeeId).eq("project_id", project.id).order("created_at"),
      admin.from("invoices").select("id,card_id,document_id,invoice_number,amount,approval_status,due_on,created_at").eq("committee_id", scope.committeeId).eq("project_id", project.id).order("created_at"),
      project.budget_allowance_id
        ? admin.from("budget_allowances").select("id,name,approved_amount,committed_amount,invoiced_amount,notes").eq("committee_id", scope.committeeId).eq("id", project.budget_allowance_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (milestonesResult.error || variationsResult.error || invoicesResult.error || allowanceResult.error) {
      throw new Error("Project evidence could not be read.");
    }

    const visibleCardIds = await visibleCardIdSet(scope, [
      ...(variationsResult.data ?? []).map((row) => row.card_id),
      ...(invoicesResult.data ?? []).map((row) => row.card_id),
    ]);
    const cardVisible = <T extends { card_id: string | null }>(row: T) => !row.card_id || visibleCardIds.has(row.card_id);
    const variations = (variationsResult.data ?? []).filter(cardVisible);
    const invoices = (invoicesResult.data ?? []).filter(cardVisible);
    const milestones = milestonesResult.data ?? [];
    const allowance = allowanceResult.data;
    const citations = [
      citation(`project:${project.id}`, `project: ${project.name}`),
      ...milestones.map((milestone) => citation(`milestone:${milestone.id}`, `milestone: ${milestone.label}`)),
      ...(allowance ? [citation(`budget_allowance:${allowance.id}`, `budget allowance: ${allowance.name}`)] : []),
      ...variations.map((variation) => citation(`variation:${variation.id}`, `variation: ${variation.title}`)),
      ...invoices.map((invoice) => citation(`invoice:${invoice.id}`, `invoice: ${invoice.invoice_number ?? invoice.id}`)),
    ];

    return { status: "ok" as const, project, milestones, allowance, variations, invoices, citations };
  },
});
