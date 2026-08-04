import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const component = [
  "src/components/strata-app.tsx",
  "src/components/app-shell.tsx",
  "src/components/app-store.tsx",
  "src/components/cards/create-card-dialog.tsx",
  "src/components/cards/card-detail-drawer.tsx",
  "src/components/pages/cards-page.tsx",
  "src/components/pages/votes-page.tsx",
  "src/components/pages/updates-page.tsx",
]
  .map((path) => readFileSync(join(root, path), "utf8"))
  .join("\n");
const route = readFileSync(join(root, "src/app/api/workflow/[action]/route.ts"), "utf8");

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`Unexpected ${label}: ${needle}`);
  }
}

for (const label of [
  'aria-label="Card title"',
  'aria-label="Card description"',
  'aria-label="Create card"',
  'aria-label="Message body"',
  'aria-label="Post message"',
  'aria-label="Proposal title"',
  'aria-label="Create proposal"',
  'aria-label="Vote value"',
  'aria-label="Cast vote"',
  'aria-label="Approval condition"',
  'aria-label="Add approval condition"',
]) {
  assertContains(component, label, label);
}

assertNotContains(component, "window.location.reload()", "reload-based workflow refresh");
assertContains(component, 'fetch("/api/app-data"', "in-place workspace data refresh");
assertContains(component, "setData(nextData)", "client data state update");
assertContains(component, "/api/workflow/", "real workflow API binding");
for (const action of ["create-card", "add-message", "create-proposal", "cast-vote", "add-approval-condition"]) {
  assertContains(component, action, `${action} UI action binding`);
}
assertContains(component, "Card audit history", "card audit panel");
assertContains(component, "selected.audit.map", "visible audit event rendering");
assertContains(component, "StatusMessage", "clear status component");
assertContains(route, "requiredText(payload.title", "create-card required title validation");
assertContains(route, "requiredText(payload.description", "create-card required description validation");
assertContains(route, "requiredText(payload.body", "message required body validation");
assertContains(route, "requiredText(payload.condition", "condition required text validation");

console.log("Workflow UI source verification passed.");
