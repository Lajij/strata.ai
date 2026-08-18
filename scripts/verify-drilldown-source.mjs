import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

const appData = read("src/lib/strata-app-data.ts");
const adapter = read("src/lib/building-platform-data.ts");
const evidence = read("src/components/evidence-references.tsx");
const cardDrawer = read("src/components/cards/card-detail-drawer.tsx");
const documentsPage = read("src/components/pages/documents-page.tsx");
const dashboard = read("src/components/pages/dashboard-page.tsx");
const liveVerifier = read("scripts/verify-live-dashboard-data.mjs");

for (const [needle, label] of [
  ["`card:${row.id}`", "card source reference"],
  ["`proposal:${proposal.id}`", "proposal source reference"],
  ["`vote:${vote.id}`", "vote source reference"],
  ["`condition:${condition.id}`", "condition source reference"],
  ["`message:${message.id}`", "message source reference"],
  ["`attachment:${attachment.id}`", "attachment source reference"],
  ["`document:${row.id}`", "document source reference"],
  ["`project:${row.id}`", "project source reference"],
  ["votes(id,vote)", "nested vote identifier select"],
  ["approval_conditions(id,condition_text,status)", "nested condition identifier select"],
  [".select(\"id,project_id,label,planned_on,actual_on,status\")", "milestone identifier select"],
]) {
  assertContains(appData, needle, label);
}

assertContains(adapter, "sourceRefs: card.sourceRefs", "card source propagation");
assertContains(adapter, "sourceRefs: document.sourceRefs", "document source propagation");
assertContains(evidence, "Evidence records", "shared evidence panel");
assertContains(evidence, "uniqueReferences.map", "complete evidence reference list");
assertContains(cardDrawer, 'label="Card evidence records"', "card drilldown evidence panel");
assertContains(documentsPage, "Document details", "document drilldown");
assertContains(documentsPage, 'label="Document evidence records"', "document provenance panel");
assertContains(dashboard, "Project record: {project.name}", "project drilldown");
assertContains(dashboard, 'label="Project evidence records"', "project provenance panel");
assertContains(liveVerifier, "nestedSourceRecords.length > 0", "live nested-source fixture assertion");
assertContains(liveVerifier, "nestedSourceRecords.every", "live nested-source identifier assertion");

console.log("Record drilldown source-traceability verification passed.");
