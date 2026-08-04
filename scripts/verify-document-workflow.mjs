import { resolveServiceKey } from "./service-key.mjs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const COMMITTEE_ID = "11111111-1111-1111-1111-111111111111";
const MEMBER_ID = "33333333-3333-3333-3333-333333333332";
const ADMIN_MEMBER_ID = "33333333-3333-3333-3333-333333333331";
const VISIBLE_DOC_ID = "77777777-7777-7777-7777-777777779981";
const VISIBLE_ATTACHMENT_ID = "cccccccc-cccc-cccc-cccc-cccccccc9981";
const PENDING_DOC_ID = "77777777-7777-7777-7777-777777779983";
const PENDING_ATTACHMENT_ID = "cccccccc-cccc-cccc-cccc-cccccccc9983";
const HIDDEN_DOC_ID = "77777777-7777-7777-7777-777777779982";
const HIDDEN_ATTACHMENT_ID = "cccccccc-cccc-cccc-cccc-cccccccc9982";
const CARD_ID = "44444444-4444-4444-4444-444444444441";
const PROJECT_ID = "55555555-5555-5555-5555-555555555551";
const BUCKET = "strata-documents";
const VISIBLE_OBJECT_PATH = `${COMMITTEE_ID}/${VISIBLE_DOC_ID}/visible-document-workflow.txt`;
const PENDING_OBJECT_PATH = `${COMMITTEE_ID}/${PENDING_DOC_ID}/pending-extraction-workflow.pdf`;
const HIDDEN_OBJECT_PATH = `${COMMITTEE_ID}/${HIDDEN_DOC_ID}/hidden-document-workflow.txt`;

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey =
  resolveServiceKey();
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";

if (!url || !anonKey || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function loadEnv(file) {
  const path = resolve(process.cwd(), file);

  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function must(label, promise) {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function signInClient() {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: memberEmail, password: memberPassword });

  if (error) {
    throw error;
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
  });
}

async function cleanup() {
  const failures = [];

  try {
    await must("attachment cleanup", admin.from("attachments").delete().in("id", [VISIBLE_ATTACHMENT_ID, PENDING_ATTACHMENT_ID, HIDDEN_ATTACHMENT_ID]));
  } catch (error) {
    failures.push(error);
  }

  try {
    await must("document cleanup", admin.from("documents").delete().in("id", [VISIBLE_DOC_ID, PENDING_DOC_ID, HIDDEN_DOC_ID]));
  } catch (error) {
    failures.push(error);
  }

  try {
    await must("storage cleanup", admin.storage.from(BUCKET).remove([VISIBLE_OBJECT_PATH, PENDING_OBJECT_PATH, HIDDEN_OBJECT_PATH]));
  } catch (error) {
    failures.push(error);
  }

  if (failures.length) {
    throw new AggregateError(failures, "Document workflow cleanup failed");
  }
}

await cleanup();

const memberClient = await signInClient();
const visibleText = "Visible AGM minute extract for document workflow verification.";
const visibleMarkdown = `# Visible document workflow verification\n\n${visibleText}`;

try {
await must(
  "member upload visible storage object",
  memberClient.storage.from(BUCKET).upload(VISIBLE_OBJECT_PATH, new Blob([visibleText], { type: "text/plain" }), {
    contentType: "text/plain",
    upsert: false,
  }),
);

await must(
  "member create visible document",
  memberClient.from("documents").insert({
    id: VISIBLE_DOC_ID,
    committee_id: COMMITTEE_ID,
    title: "Visible document workflow verification",
    document_type: "AGM minutes",
    source: "upload",
    source_date: "2026-06-26",
    visibility: "all",
    storage_path: `${BUCKET}/${VISIBLE_OBJECT_PATH}`,
    extracted_text_path: `${COMMITTEE_ID}/${VISIBLE_DOC_ID}/extracted.txt`,
    markdown_path: `${COMMITTEE_ID}/${VISIBLE_DOC_ID}/document.md`,
    indexed_status: "markdown_ready",
    summary: visibleText,
    metadata: {
      script: "verify-document-workflow",
      cleanup: true,
      storage_bucket: BUCKET,
      storage_object_path: VISIBLE_OBJECT_PATH,
      linked_card_id: CARD_ID,
      linked_project_id: PROJECT_ID,
    },
    created_by_member_id: MEMBER_ID,
  }),
);

await must(
  "member create visible attachment",
  memberClient.from("attachments").insert({
    id: VISIBLE_ATTACHMENT_ID,
    committee_id: COMMITTEE_ID,
    card_id: CARD_ID,
    document_id: VISIBLE_DOC_ID,
    uploader_member_id: MEMBER_ID,
    file_name: "visible-document-workflow.txt",
    file_path: VISIBLE_OBJECT_PATH,
    file_size: visibleText.length,
    file_type: "text/plain",
    extracted_text: visibleText,
    markdown: visibleMarkdown,
  }),
);

const pendingMarkdown = [
  "# Pending extraction workflow verification",
  "",
  "Extraction pending.",
  "",
  "Original file: pending-extraction-workflow.pdf",
  "MIME type: application/pdf",
].join("\n");

await must(
  "member upload pending extraction storage object",
  memberClient.storage.from(BUCKET).upload(PENDING_OBJECT_PATH, new Blob(["%PDF-verify"], { type: "application/pdf" }), {
    contentType: "application/pdf",
    upsert: false,
  }),
);

await must(
  "member create pending extraction document",
  memberClient.from("documents").insert({
    id: PENDING_DOC_ID,
    committee_id: COMMITTEE_ID,
    title: "Pending extraction workflow verification",
    document_type: "Engineer report",
    source: "upload",
    source_date: "2026-06-26",
    visibility: "all",
    storage_path: `${BUCKET}/${PENDING_OBJECT_PATH}`,
    extracted_text_path: null,
    markdown_path: `${COMMITTEE_ID}/${PENDING_DOC_ID}/document.md`,
    indexed_status: "needs_extraction",
    summary: "pending-extraction-workflow.pdf stored in Supabase Storage. PDF/DOCX extraction is pending and a deterministic Markdown placeholder is available.",
    metadata: {
      script: "verify-document-workflow",
      cleanup: true,
      storage_bucket: BUCKET,
      storage_object_path: PENDING_OBJECT_PATH,
      linked_card_id: CARD_ID,
      linked_project_id: PROJECT_ID,
      extraction_status: "pending_worker",
      markdown_placeholder: true,
      mime_type: "application/pdf",
    },
    created_by_member_id: MEMBER_ID,
  }),
);

await must(
  "member create pending extraction attachment",
  memberClient.from("attachments").insert({
    id: PENDING_ATTACHMENT_ID,
    committee_id: COMMITTEE_ID,
    card_id: CARD_ID,
    document_id: PENDING_DOC_ID,
    uploader_member_id: MEMBER_ID,
    file_name: "pending-extraction-workflow.pdf",
    file_path: PENDING_OBJECT_PATH,
    file_size: 11,
    file_type: "application/pdf",
    extracted_text: null,
    markdown: pendingMarkdown,
  }),
);

await must(
  "service upload hidden storage object",
  admin.storage.from(BUCKET).upload(HIDDEN_OBJECT_PATH, new Blob(["Hidden attachment that must not leak."], { type: "text/plain" }), {
    contentType: "text/plain",
    upsert: false,
  }),
);

await must(
  "hidden document seed",
  admin.from("documents").insert({
    id: HIDDEN_DOC_ID,
    committee_id: COMMITTEE_ID,
    title: "Hidden document workflow verification",
    document_type: "Admin memo",
    source: "upload",
    visibility: "admins",
    storage_path: `${BUCKET}/${HIDDEN_OBJECT_PATH}`,
    extracted_text_path: `${COMMITTEE_ID}/${HIDDEN_DOC_ID}/extracted.txt`,
    markdown_path: `${COMMITTEE_ID}/${HIDDEN_DOC_ID}/document.md`,
    indexed_status: "markdown_ready",
    summary: "Hidden document that must not leak to ordinary members.",
    metadata: {
      script: "verify-document-workflow",
      cleanup: true,
      storage_bucket: BUCKET,
      storage_object_path: HIDDEN_OBJECT_PATH,
    },
    created_by_member_id: ADMIN_MEMBER_ID,
  }),
);

await must(
  "hidden attachment seed",
  admin.from("attachments").insert({
    id: HIDDEN_ATTACHMENT_ID,
    committee_id: COMMITTEE_ID,
    document_id: HIDDEN_DOC_ID,
    uploader_member_id: ADMIN_MEMBER_ID,
    file_name: "hidden-document-workflow.txt",
    file_path: HIDDEN_OBJECT_PATH,
    file_size: 51,
    file_type: "text/plain",
    extracted_text: "Hidden attachment that must not leak.",
    markdown: "# Hidden\n\nHidden attachment that must not leak.",
  }),
);

const docs = await must(
  "member document read",
  memberClient
    .from("documents")
    .select("id,title,visibility,indexed_status,storage_path,markdown_path,summary,metadata")
    .eq("committee_id", COMMITTEE_ID),
);
const attachments = await must(
  "member attachment read",
  memberClient.from("attachments").select("id,card_id,document_id,file_name,file_path,file_type,extracted_text,markdown").eq("committee_id", COMMITTEE_ID),
);
const aiDocs = await must(
  "member AI document context read",
  memberClient
    .from("documents")
    .select("id,title,summary,visibility,storage_path,markdown_path,extracted_text_path,metadata")
    .eq("committee_id", COMMITTEE_ID)
    .limit(20),
);
const visibleDownload = await must("member download visible storage object", memberClient.storage.from(BUCKET).download(VISIBLE_OBJECT_PATH));
const pendingDownload = await must("member download pending extraction storage object", memberClient.storage.from(BUCKET).download(PENDING_OBJECT_PATH));
const hiddenDownload = await memberClient.storage.from(BUCKET).download(HIDDEN_OBJECT_PATH);

assert(docs.some((document) => document.id === VISIBLE_DOC_ID && document.indexed_status === "markdown_ready"), "Member cannot read visible Markdown-ready document");
assert(
  docs.some(
    (document) =>
      document.id === VISIBLE_DOC_ID &&
      document.markdown_path &&
      document.metadata?.linked_card_id === CARD_ID &&
      document.metadata?.linked_project_id === PROJECT_ID,
  ),
  "Visible document is missing citation paths or card/project link metadata",
);
assert(
  attachments.some(
    (attachment) =>
      attachment.id === VISIBLE_ATTACHMENT_ID &&
      attachment.card_id === CARD_ID &&
      attachment.file_path === VISIBLE_OBJECT_PATH &&
      attachment.markdown?.includes(visibleText),
  ),
  "Member cannot read visible linked Markdown attachment",
);
assert((await visibleDownload.text()).includes(visibleText), "Member cannot download visible storage object");
assert(docs.some((document) => document.id === PENDING_DOC_ID && document.indexed_status === "needs_extraction"), "Member cannot read visible pending-extraction document");
assert(
  docs.some(
    (document) =>
      document.id === PENDING_DOC_ID &&
      document.storage_path === `${BUCKET}/${PENDING_OBJECT_PATH}` &&
      document.markdown_path === `${COMMITTEE_ID}/${PENDING_DOC_ID}/document.md` &&
      document.metadata?.extraction_status === "pending_worker" &&
      document.metadata?.markdown_placeholder === true,
  ),
  "Pending PDF/DOCX document is missing storage, status, placeholder, or link metadata",
);
assert(
  attachments.some(
    (attachment) =>
      attachment.id === PENDING_ATTACHMENT_ID &&
      attachment.file_type === "application/pdf" &&
      attachment.extracted_text === null &&
      attachment.markdown?.includes("Extraction pending."),
  ),
  "Pending extraction attachment lacks deterministic Markdown placeholder",
);
assert((await pendingDownload.text()).includes("%PDF-verify"), "Member cannot download pending extraction storage object");
assert(!docs.some((document) => document.id === HIDDEN_DOC_ID), "Member can read hidden document");
assert(!attachments.some((attachment) => attachment.id === HIDDEN_ATTACHMENT_ID), "Member can read hidden document attachment");
assert(!aiDocs.some((document) => document.id === HIDDEN_DOC_ID), "Member AI document context can read hidden document");
assert(aiDocs.some((document) => document.id === VISIBLE_DOC_ID && document.markdown_path), "AI document context lacks visible citation fields");
assert(aiDocs.some((document) => document.id === PENDING_DOC_ID && document.storage_path && document.markdown_path), "AI document context lacks pending extraction citation fields");
assert(hiddenDownload.error, "Member can download hidden storage object");
} finally {
  await cleanup();
}

console.log(
  JSON.stringify(
    {
      ok: true,
      visibleDocumentCreated: VISIBLE_DOC_ID,
      visibleStorageUploaded: VISIBLE_OBJECT_PATH,
      hiddenDocumentFiltered: HIDDEN_DOC_ID,
      visibleAttachmentCreated: VISIBLE_ATTACHMENT_ID,
      pendingDocumentCreated: PENDING_DOC_ID,
      pendingStorageUploaded: PENDING_OBJECT_PATH,
      pendingAttachmentCreated: PENDING_ATTACHMENT_ID,
      hiddenAttachmentFiltered: HIDDEN_ATTACHMENT_ID,
      hiddenStorageDownloadBlocked: HIDDEN_OBJECT_PATH,
    },
    null,
    2,
  ),
);
