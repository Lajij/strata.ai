import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSearchIndex, searchRecords } from "../src/lib/record-search.ts";

const root = process.cwd();

function read(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) throw new Error(`Missing search source: ${path}`);
  return readFileSync(absolute, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertContains(source, needle, label) {
  assert(source.includes(needle), `Missing ${label}: ${needle}`);
}

function assertNotContains(source, needle, label) {
  assert(!source.includes(needle), `Forbidden ${label}: ${needle}`);
}

const searchPage = read("src/components/pages/search-page.tsx");
const sidebar = read("src/components/sidebar-nav.tsx");
const shell = read("src/components/app-shell.tsx");
const appData = read("src/lib/strata-app-data.ts");
const packageJson = JSON.parse(read("package.json"));

for (const [needle, label] of [
  ['aria-label="Search all records"', "accessible search input"],
  ["Search boundary", "RLS search boundary"],
  ["Hidden records are not indexed", "hidden-record disclosure"],
  ["React.useDeferredValue(query)", "deferred query rendering"],
  ["React.useMemo(", "memoized search derivation"],
  ["buildSearchIndex", "shared search index"],
  ["EvidenceReferences", "result evidence references"],
  ['key: "search", label: "Search"', "Search navigation item"],
  ["search:", "Search page metadata"],
  ["return <SearchPage />", "Search page routing"],
  ["`budget_line:${line.id}`", "budget-line source reference"],
  ["`expense:${expense.id}`", "expense source reference"],
  ['select("id,budget_line_id,amount")', "expense identifier select"],
]) {
  const source = needle.includes('key: "search"') ? sidebar : needle === "search:" || needle === "return <SearchPage />" ? shell : needle.includes("budget_line") || needle.includes("expense") || needle.includes("budget_line_id") ? appData : searchPage;
  assertContains(source, needle, label);
}

assertNotContains(searchPage, "createClient", "direct Supabase client in SearchPage");
assertNotContains(searchPage, "/api/", "independent Search API call");
assertContains(packageJson.scripts["verify:search"] ?? "", "verify-search-source", "package search verifier");

const supabaseInput = {
  dataSource: "supabase",
  cards: [
    {
      id: "card-1",
      sourceRefs: ["card:card-1", "message:message-1"],
      type: "update",
      title: "Fire door decision",
      area: "Lobby",
      status: "Published",
      publishDate: "2026-08-01",
      summary: "Review the fire door quote",
      body: "Certification evidence is required",
      audience: "Committee",
      commentCount: 1,
      attachments: [],
      comments: [{ id: "message-1", author: "Chair", initials: "CH", body: "Check warranty", date: "2026-08-01" }],
      createdAt: "2026-08-01",
    },
    {
      id: "local-only",
      type: "update",
      title: "Unpersisted hidden sentinel",
      area: "Lobby",
      status: "Draft",
      publishDate: "",
      summary: "Must not enter Supabase search",
      body: "hidden-sentinel",
      audience: "Committee",
      commentCount: 0,
      attachments: [],
      comments: [],
      createdAt: "",
    },
  ],
  documents: [{ id: "doc-1", sourceRefs: ["document:doc-1"], name: "Fire inspection.pdf", category: "Compliance", size: "Indexed", updated: "2026-08-01", summary: "Fire door inspection" }],
  projects: [{ id: "project-1", sourceRefs: ["project:project-1", "document:doc-1"], name: "Fire remediation", status: "At risk", plannedScope: "Replace basement fire door", progress: 50, allowance: 100, committed: 50, invoiced: 0, remaining: 50, milestones: [], variations: [], invoices: [], quoteReviews: [], evidence: ["Fire inspection.pdf"], aiSummary: "Visible records only" }],
  activity: [{ id: "audit-1", sourceRef: "audit_log:audit-1", actor: "Chair", initials: "CH", action: "reviewed", target: "Fire quote", time: "Today" }],
  budgetLines: [{ sourceRefs: ["budget_line:line-1", "expense:expense-1"], category: "Fire compliance", account: "Admin fund", approved: 100, committed: 50, actual: 10, risk: "Monitor" }],
  vendors: [{ id: "vendor-1", name: "FireCo", contactEmail: "ops@example.com", phone: "000", insuranceStatus: "Current" }],
  people: [{ id: "member-1", name: "Alex Chair", initials: "AC", contextLabel: "Committee", role: "Committee", email: "alex@example.com" }],
};

const index = buildSearchIndex(supabaseInput);
assert(index.length === 7, `Expected 7 persisted search records, received ${index.length}`);
assert(index.every((result) => result.sourceRefs.length > 0), "A search result has no source references");
assert(!index.some((result) => result.key.includes("local-only")), "Unpersisted live card entered the search index");
assert(searchRecords(index, "fire door").length === 3, "Multi-term search did not require both terms");
assert(searchRecords(index, "hidden-sentinel").length === 0, "Hidden/unpersisted sentinel was searchable");
assert(searchRecords(index, "warranty")[0]?.sourceRefs.includes("message:message-1"), "Comment match lost its message source");
assert(index.find((result) => result.kind === "Budget")?.sourceRefs.includes("expense:expense-1"), "Budget search lost expense evidence");

const fallbackIndex = buildSearchIndex({ ...supabaseInput, dataSource: "fallback", cards: [supabaseInput.cards[1]] });
assert(fallbackIndex.some((result) => result.sourceRefs.includes("fallback-card:local-only")), "Fallback records are not labelled as fallback sources");

console.log("RLS-scoped record search verification passed.");
