import { defineAgent } from "eve";
import { mockModel, type MockModelRequest } from "eve/evals";

import { isEvalFixtureEnabled } from "./lib/eval-fixtures";

function fixtureResponse(request: MockModelRequest) {
  const result = request.toolResults.at(-1);
  if (result) return JSON.stringify(result.output);

  const prompt = request.lastUserMessage?.trim() ?? "";
  const separator = prompt.indexOf(" ");
  const command = (separator === -1 ? prompt : prompt.slice(0, separator)).toUpperCase();
  const argument = separator === -1 ? "" : prompt.slice(separator + 1).trim();
  const fixtureInput = () => {
    try {
      return JSON.parse(argument) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  if (command === "SEARCH") {
    return { toolCalls: [{ name: "search_records", input: { query: argument, limit: 10 } }] };
  }
  if (command === "CARD") {
    return { toolCalls: [{ name: "get_card_evidence", input: { cardId: argument } }] };
  }
  if (command === "DOCUMENT") {
    return { toolCalls: [{ name: "get_document_evidence", input: { documentId: argument } }] };
  }
  if (command === "PROJECT") {
    return { toolCalls: [{ name: "get_project_evidence", input: { projectId: argument } }] };
  }
  if (command === "SAVE_PROPOSAL_DRAFT") {
    return { toolCalls: [{ name: "save_proposal_draft", input: fixtureInput() }] };
  }
  if (command === "SAVE_CONDITION_DRAFT") {
    return { toolCalls: [{ name: "save_approval_condition_draft", input: fixtureInput() }] };
  }

  return "Evidence missing: the deterministic eval fixture received an unsupported command.";
}

export default defineAgent({
  model: isEvalFixtureEnabled()
    ? mockModel({ modelId: "strata-eval-fixture", provider: "strata-evals", respond: fixtureResponse })
    : process.env.STRATA_AI_MODEL ?? "openai/gpt-5.4",
  ...(isEvalFixtureEnabled() ? { modelContextWindowTokens: 100_000 } : {}),
  limits: {
    maxInputTokensPerSession: 200_000,
    maxOutputTokensPerSession: 30_000,
    sessionTimeoutMs: 24 * 60 * 60 * 1_000,
  },
});
