import { createHash } from "node:crypto";
import { generateText, Output, streamText } from "ai";
import { z } from "zod";
import {
  buildVisibleAiContext,
  type AiCitation,
  type AiContextBundle,
  type AiTask,
} from "@/lib/ai/context";
import { getCurrentMember } from "@/lib/strata-app-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const model = process.env.STRATA_AI_MODEL ?? "openai/gpt-5.4";
const supportedTasks = new Set<AiTask>([
  "card-brief",
  "thread-summary",
  "document-qa",
  "nsw-law-lookup",
  "budget-insights",
  "quote-risk",
  "project-status",
]);

const disclaimer =
  "General information only. Not legal, financial, accounting, engineering, compliance, fire-safety, or strata-management advice. Verify with qualified advisers and official strata records before formal decisions.";

const budgetInsightSchema = z.object({
  summary: z.string(),
  risks: z.array(z.string()),
  recommendedChecks: z.array(z.string()),
  disclaimer: z.string(),
});

const quoteRiskSchema = z.object({
  overallRisk: z.enum(["low", "medium", "high"]),
  missingInclusions: z.array(z.string()),
  riskyExclusions: z.array(z.string()),
  clarificationQuestions: z.array(z.string()),
  approvalConditions: z.array(z.string()),
  disclaimer: z.string(),
});

const projectStatusSchema = z.object({
  summary: z.string(),
  progressAssessment: z.string(),
  budgetRisks: z.array(z.string()),
  nextChecks: z.array(z.string()),
  disclaimer: z.string(),
});

const lawLookupSchema = z.object({
  answer: z.string(),
  citedSources: z.array(z.string()),
  limitations: z.array(z.string()),
  recommendedChecks: z.array(z.string()),
  disclaimer: z.string(),
});

function hasGatewayCredentials() {
  return Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function promptHash(prompt: string) {
  return createHash("sha256").update(prompt).digest("hex");
}

function sanitizeErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown AI error");

  return raw
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-token]")
    .replace(/(?:sk|sb|supabase|vercel|ai)[A-Za-z0-9_-]{24,}/gi, "[redacted-secret]")
    .slice(0, 600);
}

function citationLabels(citations: AiCitation[]) {
  return citations.map((citation) => citation.label).slice(0, 12);
}

function requestedRecordIsVisible(contextBundle: AiContextBundle, body: Record<string, unknown>) {
  const cardId = textValue(body.cardId);
  const documentId = textValue(body.documentId);
  const projectId = textValue(body.projectId);

  if (cardId && !contextBundle.records.some((record) => record.kind === "card" && record.id === cardId)) {
    return false;
  }

  if (documentId && !contextBundle.records.some((record) => record.kind === "document" && record.id === documentId)) {
    return false;
  }

  if (projectId && !contextBundle.records.some((record) => record.kind === "project" && record.id === projectId)) {
    return false;
  }

  return true;
}

function hasIndexedLawContext(contextBundle: AiContextBundle) {
  return contextBundle.records.some((record) => record.kind === "legislation" && record.summary.includes("Official source:"));
}

function lawRefusal(contextBundle: AiContextBundle) {
  return {
    mode: "refusal",
    task: "nsw-law-lookup" as const,
    model,
    persisted: false,
    context: contextBundle,
    citations: citationLabels(contextBundle.citations),
    output: {
      answer:
        "No indexed NSW strata law context is available for this request, so Strata will not generate a legal-information answer. Add curated official NSW legislation or guidance chunks first.",
      citedSources: [],
      limitations: ["No relevant indexed law source was available through the current member's RLS-filtered context."],
      recommendedChecks: ["Check the current official NSW legislation website or NSW Government strata guidance directly."],
      disclaimer: "This is general information, not legal advice.",
    },
    disclaimer: "This is general information, not legal advice.",
  };
}

function fallback(task: AiTask, contextBundle: AiContextBundle, body: Record<string, unknown>) {
  const base = {
    mode: "mock",
    task,
    model,
    persisted: false,
    context: contextBundle,
    citations: citationLabels(contextBundle.citations),
    disclaimer,
  };

  if (task === "budget-insights") {
    return {
      ...base,
      output: {
        summary:
          "Visible budget records show allowance and commitment pressure should be checked before more approvals. Reconcile figures against official strata accounts.",
        risks: ["Uncosted scope may remain", "Committed and invoiced amounts may not yet match", "Card-linked invoice context may be incomplete"],
        recommendedChecks: ["Confirm approved budget lines", "Compare committed vs invoiced spend", "Ask treasurer or strata manager to verify source accounts"],
        disclaimer,
      },
    };
  }

  if (task === "quote-risk") {
    return {
      ...base,
      output: {
        overallRisk: "medium",
        missingInclusions: ["Make-good scope", "Certification evidence", "Warranty prerequisites"],
        riskyExclusions: ["Damage to surrounding finishes", "Out-of-hours work", "Unspecified materials"],
        clarificationQuestions: ["What is included in the fixed price?", "What evidence is supplied before payment?", "Who is responsible for certification?"],
        approvalConditions: ["Payment after inspection", "Confirm make-good scope", "Attach certificate or completion evidence"],
        disclaimer,
      },
    };
  }

  if (task === "project-status") {
    return {
      ...base,
      output: {
        summary: "Visible project records can support a plan-vs-current update, but official progress, invoice, and variation figures should be verified.",
        progressAssessment: "Progress is based on current Supabase project records and linked evidence only.",
        budgetRisks: ["Variations may not be fully priced", "Invoices may lag completed work"],
        nextChecks: ["Confirm milestones", "Review linked evidence", "Reconcile project allowance against invoices"],
        disclaimer,
      },
    };
  }

  if (task === "nsw-law-lookup") {
    if (!hasIndexedLawContext(contextBundle)) {
      return lawRefusal(contextBundle);
    }

    return {
      ...base,
      output: {
        answer:
          "Use the cited indexed NSW strata law and guidance sources as a starting point only. Check the current official source and obtain legal advice before formal committee action.",
        citedSources: citationLabels(contextBundle.citations).filter((citation) => /strata|NSW|Act|Regulation/i.test(citation)),
        limitations: ["This is general information, not legal advice.", "The indexed law corpus is curated and not complete.", "Check the current official source before committee action"],
        recommendedChecks: ["Open the cited official source", "Ask the strata manager or lawyer for binding advice if needed"],
        disclaimer: "This is general information, not legal advice.",
      },
    };
  }

  const question = textValue(body.question) ?? "No question supplied.";
  return {
    ...base,
    text: [
      `**${task.replace(/-/g, " ")}**`,
      `Mock answer for: ${question}`,
      "The response uses only visible context returned by the Strata context builder. Configure Vercel AI Gateway credentials for live generation.",
    ].join("\n\n"),
  };
}

function buildPrompt(task: AiTask, body: Record<string, unknown>, contextBundle: AiContextBundle) {
  return [
    "You are the AI assistant for Strata, an NSW strata committee governance platform.",
    "Use only the RLS-filtered context JSON. Do not infer hidden records. If evidence is missing, say so.",
    "Every response must include a short non-binding disclaimer appropriate to legal, financial, engineering, compliance, and strata matters.",
    "For NSW strata law lookup, use indexed legislation records only and say this is general information, not legal advice.",
    "For budget, quote, and project work, cite visible source records and advise checking official strata accounts or qualified advisers.",
    `Task: ${task}`,
    `User request JSON: ${JSON.stringify(body).slice(0, 2500)}`,
    `RLS-filtered context JSON: ${JSON.stringify(contextBundle).slice(0, 12000)}`,
  ].join("\n\n");
}

async function persistAiOutput({
  task,
  prompt,
  response,
  body,
  contextBundle,
  accessToken,
  status = "completed",
  durationMs,
  createdMode,
  errorMessage,
  providerMetadata,
}: {
  task: AiTask;
  prompt: string;
  response: Record<string, unknown>;
  body: Record<string, unknown>;
  contextBundle: AiContextBundle;
  accessToken?: string;
  status?: "completed" | "error";
  durationMs: number;
  createdMode: string;
  errorMessage?: string | null;
  providerMetadata: Record<string, unknown>;
}) {
  const supabase = await getSupabaseServerClient(accessToken);

  if (!supabase) {
    return { persisted: false };
  }

  const member = await getCurrentMember(supabase);

  if (!member) {
    return { persisted: false };
  }

  const cardId = textValue(body.cardId) ?? null;
  const documentId = textValue(body.documentId) ?? null;
  const projectId = textValue(body.projectId) ?? null;
  const verificationMarker = textValue(body.verificationMarker);
  const output = verificationMarker ? { ...response, verification_marker: verificationMarker } : response;
  const citations = contextBundle.citations.slice(0, 30) as unknown as Json;
  const { data, error } = await supabase
    .from("ai_outputs")
    .insert({
      committee_id: member.committee_id,
      card_id: cardId,
      document_id: documentId,
      project_id: projectId,
      output_type: task,
      prompt_hash: promptHash(prompt),
      output: output as Json,
      citations,
      model,
      status,
      duration_ms: durationMs,
      input_record_count: contextBundle.records.length,
      citation_count: contextBundle.citations.length,
      error_message: errorMessage ?? null,
      provider_metadata: providerMetadata as Json,
      created_mode: createdMode,
      created_by_member_id: member.id,
    })
    .select("id")
    .single();

  if (error) {
    return { persisted: false, error: error.message };
  }

  await supabase.from("audit_log").insert({
    committee_id: member.committee_id,
    card_id: cardId,
    user_id: member.user_id,
    action: "Generated AI output",
    target: task,
    metadata: {
      workflow: "ai-generation",
      ai_output_id: data.id,
      status,
      created_mode: createdMode,
      duration_ms: durationMs,
      input_record_count: contextBundle.records.length,
      citation_count: contextBundle.citations.length,
      document_id: documentId,
      project_id: projectId,
      verification_marker: verificationMarker,
    },
  });

  return { persisted: true, id: data.id };
}

async function generateTextTask(task: AiTask, prompt: string) {
  const result = streamText({ model, prompt });
  let text = "";

  for await (const chunk of result.textStream) {
    text += chunk;
  }

  return { text };
}

async function generateStructuredTask(task: AiTask, prompt: string) {
  if (task === "budget-insights") {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: budgetInsightSchema }),
      prompt,
    });
    return { output };
  }

  if (task === "quote-risk") {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: quoteRiskSchema }),
      prompt,
    });
    return { output };
  }

  if (task === "project-status") {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: projectStatusSchema }),
      prompt,
    });
    return { output };
  }

  const { output } = await generateText({
    model,
    output: Output.object({ schema: lawLookupSchema }),
    prompt,
  });
  return { output };
}

function isStructuredTask(task: AiTask) {
  return task === "budget-insights" || task === "quote-risk" || task === "project-status" || task === "nsw-law-lookup";
}

export async function POST(request: Request, context: { params: Promise<{ task: string }> }) {
  const startedAt = Date.now();
  const { task: rawTask } = await context.params;

  if (!supportedTasks.has(rawTask as AiTask)) {
    return Response.json({ error: "Unsupported AI task" }, { status: 404 });
  }

  const task = rawTask as AiTask;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const contextBundle = await buildVisibleAiContext({
    task,
    cardId: textValue(body.cardId),
    documentId: textValue(body.documentId),
    projectId: textValue(body.projectId),
    question: textValue(body.question),
  }, accessToken);

  if (contextBundle.source === "supabase" && !requestedRecordIsVisible(contextBundle, body)) {
    return Response.json(
      {
        error: "The requested AI source is not visible to this member.",
        context: contextBundle,
      },
      { status: 403 },
    );
  }

  const prompt = buildPrompt(task, body, contextBundle);
  const providerMetadata = {
    task,
    forced_fallback: body.forceFallback === "true",
    gateway_credentials_present: hasGatewayCredentials(),
  };

  if (task === "nsw-law-lookup" && !hasIndexedLawContext(contextBundle)) {
    const refusal = lawRefusal(contextBundle);
    const persistence = await persistAiOutput({
      task,
      prompt,
      response: refusal,
      body,
      contextBundle,
      accessToken,
      status: "error",
      durationMs: Date.now() - startedAt,
      createdMode: "refusal",
      errorMessage: "No indexed NSW strata law context",
      providerMetadata,
    });

    return Response.json({ ...refusal, status: "error", created_mode: "refusal", ...persistence }, { status: 422 });
  }

  if (body.forceFallback === "true" || !hasGatewayCredentials()) {
    const mockResponse = fallback(task, contextBundle, body);
    const persistence = await persistAiOutput({
      task,
      prompt,
      response: mockResponse,
      body,
      contextBundle,
      accessToken,
      status: "completed",
      durationMs: Date.now() - startedAt,
      createdMode: "mock",
      providerMetadata,
    });
    return Response.json({ ...mockResponse, status: "completed", created_mode: "mock", ...persistence });
  }

  try {
    const generated = isStructuredTask(task) ? await generateStructuredTask(task, prompt) : await generateTextTask(task, prompt);
    const response = {
      mode: "live",
      task,
      model,
      context: contextBundle,
      citations: citationLabels(contextBundle.citations),
      disclaimer,
      ...generated,
    };
    const persistence = await persistAiOutput({
      task,
      prompt,
      response,
      body,
      contextBundle,
      accessToken,
      status: "completed",
      durationMs: Date.now() - startedAt,
      createdMode: "live",
      providerMetadata,
    });

    return Response.json({ ...response, status: "completed", created_mode: "live", ...persistence });
  } catch (error) {
    const sanitizedError = sanitizeErrorMessage(error);
    const mockResponse = fallback(task, contextBundle, body);
    const persistence = await persistAiOutput({
      task,
      prompt,
      response: { ...mockResponse, error: sanitizedError },
      body,
      contextBundle,
      accessToken,
      status: "error",
      durationMs: Date.now() - startedAt,
      createdMode: "error-fallback",
      errorMessage: sanitizedError,
      providerMetadata,
    });

    return Response.json({
      ...mockResponse,
      mode: "error-fallback",
      status: "error",
      created_mode: "error-fallback",
      error: sanitizedError,
      ...persistence,
    });
  }
}
