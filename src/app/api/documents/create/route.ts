import { NextRequest, NextResponse } from "next/server";
import { PublicRequestError, fixtureWriteDisabledResponse, operationFailureResponse, runtimeFailureResponse } from "@/lib/runtime-configuration";
import { getCurrentMember } from "@/lib/strata-app-data";
import { canWriteRecords } from "@/lib/member-authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentStatusDb, Json, VisibilityLevel } from "@/lib/supabase/types";

const DOCUMENT_BUCKET = "strata-documents";
const TEXT_FILE_TYPES = new Set(["text/plain", "text/markdown"]);
const DEFERRED_EXTRACTION_FILE_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new PublicRequestError("REQUEST_FIELD_REQUIRED", `${label} is required`);
  }

  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function markdownFromText(title: string, text: string | null) {
  const body = text?.trim() || "Extraction pending.";
  return `# ${title}\n\n${body}`;
}

function pendingMarkdown(title: string, fileName: string, fileType: string) {
  return [
    `# ${title}`,
    "",
    "Extraction pending.",
    "",
    `Original file: ${fileName}`,
    `MIME type: ${fileType}`,
    "",
    "This deterministic placeholder keeps the document queryable by status until a PDF/DOCX extraction worker replaces it with full Markdown.",
  ].join("\n");
}

function sanitizeFileName(value: string) {
  const sanitized = value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return sanitized || "document.txt";
}

function formValue(payload: FormData | Record<string, unknown>, key: string) {
  if (payload instanceof FormData) {
    return payload.get(key);
  }

  return payload[key];
}

async function parsePayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return request.formData();
  }

  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

function isTextFile(file: File | null, fileName: string, fileType: string) {
  return TEXT_FILE_TYPES.has(fileType) || /\.(txt|md|markdown)$/i.test(fileName) || file?.type.startsWith("text/");
}

function isDeferredExtractionFile(fileName: string, fileType: string) {
  return DEFERRED_EXTRACTION_FILE_TYPES.has(fileType) || /\.(pdf|docx)$/i.test(fileName);
}

export async function POST(request: NextRequest) {
  const payload = await parsePayload(request);
  let supabase;

  try {
    supabase = await getSupabaseServerClient();
  } catch (error) {
    return runtimeFailureResponse(error);
  }

  if (!supabase) {
    return fixtureWriteDisabledResponse();
  }

  let member;

  try {
    member = await getCurrentMember(supabase);
  } catch (error) {
    return runtimeFailureResponse(error);
  }

  if (!member) {
    return NextResponse.json({ error: "Sign in as an active committee member to add documents" }, { status: 401 });
  }

  if (!canWriteRecords(member.role, member.access_level)) {
    return NextResponse.json(
      { error: "This committee membership is read-only", code: "WRITE_CAPABILITY_REQUIRED" },
      { status: 403 },
    );
  }

  try {
    const id = crypto.randomUUID();
    const title = requiredText(formValue(payload, "title"), "Document title");
    const documentType = requiredText(formValue(payload, "documentType"), "Document type");
    const visibility = enumValue<VisibilityLevel>(formValue(payload, "visibility"), ["all", "admins", "custom"], "all");
    const sourceDate = optionalText(formValue(payload, "sourceDate"));
    const linkedCardId = optionalText(formValue(payload, "cardId"));
    const linkedProjectId = optionalText(formValue(payload, "projectId"));
    const fileEntry = payload instanceof FormData ? payload.get("file") : null;
    const file = fileEntry instanceof File ? fileEntry : null;
    const fallbackFileName = optionalText(formValue(payload, "fileName")) ?? `${title}.txt`;
    const fileName = sanitizeFileName(file?.name || fallbackFileName);
    const fileType = file?.type || optionalText(formValue(payload, "fileType")) || "text/plain";
    let extractedText = optionalText(formValue(payload, "extractedText"));

    if (file && isTextFile(file, fileName, fileType)) {
      extractedText = await file.text();
    }

    const needsDeferredExtraction = !extractedText && isDeferredExtractionFile(fileName, fileType);
    const markdown = extractedText ? markdownFromText(title, extractedText) : pendingMarkdown(title, fileName, fileType);
    const storageObjectPath = `${member.committee_id}/${id}/${fileName}`;
    const storagePath = `${DOCUMENT_BUCKET}/${storageObjectPath}`;
    const extractedTextPath = extractedText ? `${member.committee_id}/${id}/extracted.txt` : null;
    const markdownPath = `${member.committee_id}/${id}/document.md`;
    const indexedStatus: DocumentStatusDb = extractedText ? "markdown_ready" : "needs_extraction";
    let uploadedObjectPath: string | null = null;
    const uploadBody = file ?? (extractedText ? new Blob([extractedText], { type: "text/plain" }) : null);

    if (uploadBody) {
      const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storageObjectPath, uploadBody, {
        contentType: fileType,
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      uploadedObjectPath = storageObjectPath;
    }

    const metadata: Json = {
      workflow: "document-create",
      conversion: extractedText ? "text-to-markdown" : "stored-file-needs-extraction",
      extraction_status: extractedText ? "complete" : needsDeferredExtraction ? "pending_worker" : "pending_text",
      storage_bucket: DOCUMENT_BUCKET,
      storage_object_path: storageObjectPath,
      original_file_name: fileName,
      mime_type: fileType,
      linked_card_id: linkedCardId,
      linked_project_id: linkedProjectId,
      markdown_placeholder: !extractedText,
    };

    const { error: documentError } = await supabase
      .from("documents")
      .insert({
        id,
        committee_id: member.committee_id,
        title,
        document_type: documentType,
        source: "upload",
        source_date: sourceDate,
        visibility,
        storage_path: storagePath,
        extracted_text_path: extractedTextPath,
        markdown_path: markdownPath,
        indexed_status: indexedStatus,
        summary: extractedText
          ? extractedText.slice(0, 240)
          : `${fileName} stored in Supabase Storage. PDF/DOCX extraction is pending and a deterministic Markdown placeholder is available.`,
        metadata,
        created_by_member_id: member.id,
      });

    if (documentError) {
      if (uploadedObjectPath) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([uploadedObjectPath]);
      }

      throw documentError;
    }

    const { error: attachmentError } = await supabase.from("attachments").insert({
      committee_id: member.committee_id,
      card_id: linkedCardId,
      document_id: id,
      uploader_member_id: member.id,
      file_name: fileName,
      file_path: storageObjectPath,
      file_size: file?.size ?? extractedText?.length ?? null,
      file_type: fileType,
      extracted_text: extractedText,
      markdown,
    });

    if (attachmentError) {
      if (uploadedObjectPath) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([uploadedObjectPath]);
      }

      throw attachmentError;
    }

    return NextResponse.json({
      mode: "supabase",
      id,
      message: extractedText ? "Document uploaded and Markdown created" : "Document uploaded; extraction pending with Markdown placeholder",
    });
  } catch (error) {
    return operationFailureResponse(error, {
      code: "DOCUMENT_OPERATION_FAILED",
      message: "The document operation could not be completed.",
    });
  }
}
