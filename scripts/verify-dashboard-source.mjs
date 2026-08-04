import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`Forbidden ${label}: ${needle}`);
  }
}

const dashboard = read("src/components/pages/dashboard-page.tsx");
const appStore = read("src/components/app-store.tsx");
const appData = read("src/lib/strata-app-data.ts");
const adapter = read("src/lib/building-platform-data.ts");
const liveVerifier = read("scripts/verify-live-dashboard-data.mjs");

for (const [needle, label] of [
  ["Evidence boundary", "dashboard evidence boundary"],
  ["sourceDetail", "data-source description"],
  ["Sources ({s.sourceIds.length})", "aggregate source disclosure"],
  ["card:{id}", "card source reference"],
  ["Source card:{featuredVote.id}", "featured-vote source reference"],
  ["Source {a.sourceRef}", "audit source reference"],
  ["`project:${project.id}`", "project source reference"],
  ['label="Project evidence records"', "project evidence panel"],
  ["openCard(id)", "source-record navigation"],
]) {
  assertContains(dashboard, needle, label);
}

assertContains(appData, "id: row.id", "audit_log identifier preservation");
assertContains(adapter, "`audit_log:${event.id}`", "audit_log source reference");
assertContains(adapter, "`card:${event.cardId}`", "card source fallback reference");
assertContains(appStore, "const nextData = await (onDataRefresh ?? noOpRefresh)()", "authoritative refresh result");
assertContains(appStore, "setCards(refreshed.cards)", "authoritative card refresh rebase");
assertContains(appStore, "refreshed.cards.some((card) => card.id === currentId)", "stale selected-card cleanup");

for (const [needle, label] of [
  ["supabaseCards.length ? cards : fallbackCards", "live card fallback"],
  ["supabaseDocuments.length", "live document fallback"],
  ["projects.length ? projects : fallbackProjects", "live project fallback"],
  ["activity.length ? activity : fallbackActivity", "live activity fallback"],
  ["budgetLines.length ? budgetLines : fallbackBudgetLines", "live budget fallback"],
]) {
  assertNotContains(appData, needle, label);
}

for (const [needle, label] of [
  ["records.every((record) => typeof record.id === \"string\" && record.id.length > 0)", "live source identifier assertion"],
  ["Member dashboard can read admin-only card", "admin-only card RLS negative"],
  ["Member dashboard can read custom card", "custom card RLS negative"],
  ["Member dashboard can read admin-only document", "admin-only document RLS negative"],
  ["Member dashboard can read admin-only audit event", "admin-only audit RLS negative"],
]) {
  assertContains(liveVerifier, needle, label);
}

console.log("Dashboard source-traceability verification passed.");
