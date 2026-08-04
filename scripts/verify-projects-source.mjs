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

const projectsPage = read("src/components/pages/projects-page.tsx");
const appShell = read("src/components/app-shell.tsx");
const sidebar = read("src/components/sidebar-nav.tsx");
const appStore = read("src/components/app-store.tsx");
const aiTools = read("src/components/assistant/ai-tools.tsx");

for (const [needle, label] of [
  ['{ key: "projects", label: "Projects"', "Projects navigation item"],
  ['case "projects"', "Projects page route"],
  ["return <ProjectsPage />", "Projects page mount"],
]) {
  assertContains(`${sidebar}\n${appShell}`, needle, label);
}

assertContains(appStore, "rawProjects: initialData?.projects ?? []", "RLS payload project binding");
assertContains(projectsPage, "No visible projects", "RLS-empty project state");
assertContains(projectsPage, "through RLS", "RLS boundary disclosure");

for (const [needle, label] of [
  ["project.name", "project name"],
  ["project.plannedScope", "planned scope"],
  ["project.status", "project status"],
  ["project.progress", "project progress"],
  ["project.allowance", "project allowance"],
  ["project.committed", "project committed amount"],
  ["project.invoiced", "project invoiced amount"],
  ["project.remaining", "project remaining amount"],
  ["project.milestones.map", "project milestones"],
  ["project.variations.map", "project variations"],
  ["project.aiSummary", "recorded AI summary"],
  ["project.sourceRefs", "project source references"],
  ["project.evidence", "project evidence fallback"],
  ['label="Project evidence records"', "project evidence panel"],
  ["<ProjectAiTool", "project AI surface"],
]) {
  assertContains(projectsPage, needle, label);
}

assertContains(aiTools, 'runAiTask("project-status", { projectId }, setState)', "project-status AI request");
assertContains(aiTools, "Refresh project AI", "project AI accessible control");
assertContains(aiTools, "Saved to ai_outputs", "project AI persistence status surface");

for (const [needle, label] of [
  ["fetch(", "direct project-page fetch"],
  ["getSupabase", "direct project-page Supabase client"],
  ["SUPABASE_SECRET_KEY", "server secret in project UI"],
  ["SUPABASE_SERVICE_ROLE_KEY", "service-role key in project UI"],
]) {
  assertNotContains(projectsPage, needle, label);
}

console.log("Projects journey source verification passed.");
