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

const peoplePage = read("src/components/pages/people-page.tsx");
const settingsPage = read("src/components/pages/settings-page.tsx");
const appShell = read("src/components/app-shell.tsx");
const sidebar = read("src/components/sidebar-nav.tsx");
const memberAuthorization = read("src/lib/member-authorization.ts");
const memberCapabilities = read("src/lib/member-capabilities.ts");
const inviteRoute = read("src/app/api/members/invite/route.ts");
const updateRoute = read("src/app/api/members/update/route.ts");
const authBrowser = read("scripts/verify-auth-browser.mjs");

for (const [needle, label] of [
  ['{ key: "people", label: "People"', "People navigation item"],
  ['item.key === "people" ? "Members"', "Members accessible navigation name"],
  ['case "people"', "People page route"],
  ["return <PeoplePage />", "People page mount"],
  ['case "settings"', "Settings page route"],
  ["return <SettingsPage />", "Settings page mount"],
]) {
  assertContains(`${sidebar}\n${appShell}`, needle, label);
}

for (const [needle, label] of [
  ['["admin", "chair", "secretary"].includes(currentMember.role)', "privileged role boundary"],
  ['fetch("/api/members/invite"', "member invite binding"],
  ['fetch("/api/members/update"', "member update binding"],
  ["headers: await authHeaders()", "authenticated member request"],
  ["disabled={!canManage || isInviting}", "unauthorized invite lock"],
  ["disabled={!canManage || isCurrentMember || isSaving}", "self-lockout control"],
  ['aria-label="Invite role"', "invite role label"],
  ['aria-label="Invite access level"', "invite access label"],
  ['aria-label={`Role for ${member.email}`}', "member role label"],
  ['aria-label={`Access level for ${member.email}`}', "member access label"],
  ['aria-label={`Status for ${member.email}`}', "member status label"],
  ['aria-label={`Save member ${member.email}`}', "member save label"],
  ['aria-live="polite"', "member action status announcement"],
  ["await refreshData()", "invite authoritative refresh"],
  ["await onDataRefresh()", "member-update authoritative refresh"],
]) {
  assertContains(peoplePage, needle, label);
}

assertContains(memberCapabilities, 'new Set(["admin", "chair", "secretary"])', "member-management role capability");
assertContains(memberCapabilities, 'principal.accessLevel === "read_only"', "read-only capability denial");
assertContains(memberAuthorization, '"manage_members"', "member-management server capability binding");

assertContains(inviteRoute, "if (!canManageMembers(member.role, member.access_level))", "server invite authorization");
assertContains(updateRoute, "if (!canManageMembers(member.role, member.access_level))", "server update authorization");

for (const [needle, label] of [
  ["Workspace source", "workspace provenance heading"],
  ["Read-only provenance", "read-only settings disclosure"],
  ["Current session", "session heading"],
  ["currentMember.email", "session email"],
  ["currentMember.role", "session role"],
  ["currentMember.access_level", "session access level"],
  ["member:{currentMember.id}", "member record identifier"],
]) {
  assertContains(settingsPage, needle, label);
}

for (const [needle, label] of [
  ["<Input", "editable settings input"],
  ["<Button", "settings mutation control"],
  ["onClick", "settings click mutation"],
  ["Save changes", "false settings persistence action"],
  ["SUPABASE_SECRET_KEY", "server secret in settings UI"],
  ["SUPABASE_SERVICE_ROLE_KEY", "service-role key in settings UI"],
]) {
  assertNotContains(settingsPage, needle, label);
}

for (const [needle, label] of [
  ["inviteCreatesPendingMember", "pending-invite browser observation"],
  ["backwardsInviteRejected", "lifecycle rejection browser observation"],
  ["selfLockoutControlsDisabled", "self-lockout browser observation"],
  ["ordinaryCannotInvite", "ordinary-member invite denial"],
  ["ordinaryCannotEdit", "ordinary-member edit denial"],
  ["cleanupScoped", "browser cleanup observation"],
]) {
  assertContains(authBrowser, needle, label);
}

for (const [needle, label] of [
  ["SUPABASE_SECRET_KEY", "server secret in People UI"],
  ["SUPABASE_SERVICE_ROLE_KEY", "service-role key in People UI"],
]) {
  assertNotContains(peoplePage, needle, label);
}

console.log("Admin journey source verification passed.");
