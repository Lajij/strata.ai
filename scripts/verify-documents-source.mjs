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

const page = read("src/components/pages/documents-page.tsx");
const route = read("src/app/api/documents/create/route.ts");
const authHeaders = read("src/lib/supabase/auth-headers.ts");
const types = read("src/lib/types.ts");
const adapter = read("src/lib/building-platform-data.ts");
const search = read("src/lib/record-search.ts");

for (const [needle, label] of [
  ['fetch("/api/documents/create"', "real document route binding"],
  ["new FormData(event.currentTarget)", "browser multipart payload"],
  ['authHeaders({ contentType: "multipart" })', "multipart authentication headers"],
  ["await refreshData()", "authoritative post-upload refresh"],
  ['aria-label="Document title"', "document title name"],
  ['aria-label="Document type"', "document type name"],
  ['aria-label="Document visibility"', "document visibility name"],
  ['aria-label="Document source date"', "document source date name"],
  ['aria-label="Document file"', "document file name"],
  ['aria-label="Upload document"', "upload action name"],
  ['accept=".txt,.md,.markdown,.pdf,.docx', "supported upload formats"],
  ['state: "loading"', "upload loading state"],
  ['state: "success"', "upload success state"],
  ['state: "error"', "upload error state"],
  ["<StatusMessage", "accessible upload status"],
  ["document.extractionStatus", "extraction-state presentation"],
  ["document.fileSize", "independent file-size presentation"],
]) {
  assertContains(page, needle, label);
}

for (const [needle, label] of [
  ['contentType?: "json" | "multipart"', "auth-header content-type contract"],
  ['if (contentType === "json")', "multipart boundary preservation"],
  ['headers["Content-Type"] = "application/json"', "JSON default header"],
]) {
  assertContains(authHeaders, needle, label);
}

for (const [needle, label] of [
  ["extractionStatus: string", "document extraction-status type"],
  ["fileSize?: string", "optional document file-size type"],
]) {
  assertContains(types, needle, label);
}

assertContains(adapter, "extractionStatus: document.status", "status adapter binding");
assertNotContains(adapter, "size: document.status", "status disguised as file size");
assertContains(search, "document.extractionStatus", "search extraction-status indexing");
assertContains(search, "document.fileSize", "search file-size indexing");

for (const [needle, label] of [
  ['contentType.includes("multipart/form-data")', "multipart route parsing"],
  ['requiredText(formValue(payload, "title")', "server document-title validation"],
  ['requiredText(formValue(payload, "documentType")', "server document-type validation"],
  ['payload.get("file")', "server file extraction"],
  ['getCurrentMember(supabase)', "active-member authorization"],
  ['storage.from(DOCUMENT_BUCKET).upload', "bucket upload"],
  ['.from("documents")', "document persistence"],
  ['.from("attachments")', "attachment persistence"],
  ['storage.from(DOCUMENT_BUCKET).remove', "failed-write storage cleanup"],
]) {
  assertContains(route, needle, label);
}

for (const [source, needle, label] of [
  [page, "toast.success", "demo upload toast"],
  [page, "Upload started (demo)", "demo upload behavior"],
  [page, "SUPABASE_SECRET_KEY", "server secret in Documents UI"],
  [page, "SUPABASE_SERVICE_ROLE_KEY", "service-role key in Documents UI"],
]) {
  assertNotContains(source, needle, label);
}

console.log("Documents journey source verification passed.");
