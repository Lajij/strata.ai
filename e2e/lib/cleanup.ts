import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Marker-scoped cleanup for the Playwright e2e harness.
 *
 * Mirrors the `cleanupMarkedRecords` pattern from `scripts/verify-auth-browser.mjs`
 * (delete audit_log + members by marker, then `auth.admin.deleteUser`) and
 * extends it to every record the behavioural journeys create through the real
 * Data API (cards, documents, vendors, invoices, proposals, votes, conditions,
 * messages, attachments) and the second fixture committee. Every created
 * record carries the marker prefix in a searchable text field, so cleanup is
 * deterministic and never touches seeded workspace data.
 *
 * The cleanup runs at the start of `globalSetup` (pre-cleanup of any previous
 * run) and again in `globalTeardown`, and is idempotent. It uses the
 * service_role client, which bypasses RLS, so it can remove cross-committee
 * rows regardless of the request user.
 */

export const MARKER_PREFIX = "playwright-e2e-";

interface AuthUser {
  id: string;
  email?: string;
}

async function findAuthUsersByEmailPrefix(service: SupabaseClient, prefix: string): Promise<AuthUser[]> {
  const matches: AuthUser[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throw error;
    }

    const users = data.users ?? [];
    matches.push(
      ...users.filter((user) => (user.email ?? "").toLowerCase().startsWith(prefix.toLowerCase())),
    );

    if (users.length < 1000) {
      break;
    }
  }

  return matches;
}

async function collectIds(
  service: SupabaseClient,
  table: string,
  column: string,
  prefix: string,
): Promise<string[]> {
  const { data, error } = await service.from(table).select("id").ilike(column, `${prefix}%`);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: { id: string }) => row.id);
}

async function safeDelete(
  service: SupabaseClient,
  table: string,
  builder: (from: ReturnType<SupabaseClient["from"]>) => Promise<{ error: unknown }>,
): Promise<void> {
  try {
    const { error } = await builder(service.from(table));
    if (error) {
      console.warn(`[e2e cleanup] ${table} delete warning:`, error);
    }
  } catch (error) {
    // Idempotent: a missing/referenced row must not abort the rest of cleanup.
    console.warn(`[e2e cleanup] ${table} delete failed:`, error);
  }
}

/**
 * Remove every marker-scoped record created by the e2e harness. `prefix`
 * defaults to {@link MARKER_PREFIX} so a run also sweeps any rows left behind by
 * a previous interrupted run, not just the current marker.
 */
export async function cleanupE2eRecords(
  service: SupabaseClient,
  prefix: string = MARKER_PREFIX,
): Promise<void> {
  const pattern = `${prefix}%`;

  // Collect dependent ids before deleting parents.
  const cardIds = await collectIds(service, "cards", "title", prefix);
  const documentIds = await collectIds(service, "documents", "title", prefix);
  const motionIds = await collectIds(service, "motions", "title", prefix);

  // Proposals carry no marker text field; derive marker proposal ids from the
  // marker card set so their votes/conditions can be removed first.
  let markerProposalIds: string[] = [];
  if (cardIds.length > 0) {
    const { data, error } = await service.from("proposals").select("id").in("card_id", cardIds);
    if (!error) {
      markerProposalIds = (data ?? []).map((row: { id: string }) => row.id);
    }
  }

  // audit_log: target holds the card title / vendor name / invoice number (all
  // prefixed) and occasionally a member email; also sweep by marker card_id.
  await safeDelete(service, "audit_log", async (from) => from.delete().ilike("target", pattern));
  if (cardIds.length > 0) {
    await safeDelete(service, "audit_log", async (from) => from.delete().in("card_id", cardIds));
  }
  if (motionIds.length > 0) {
    await safeDelete(service, "audit_log", async (from) => from.delete().in("motion_id", motionIds));
  }

  // Child records referencing marker cards/proposals/documents.
  if (markerProposalIds.length > 0) {
    await safeDelete(service, "approval_conditions", async (from) =>
      from.delete().in("proposal_id", markerProposalIds),
    );
    await safeDelete(service, "votes", async (from) => from.delete().in("proposal_id", markerProposalIds));
  }
  if (cardIds.length > 0) {
    await safeDelete(service, "messages", async (from) => from.delete().in("card_id", cardIds));
    await safeDelete(service, "quote_reviews", async (from) => from.delete().in("card_id", cardIds));
  }
  if (cardIds.length > 0 || documentIds.length > 0) {
    await safeDelete(service, "attachments", async (from) => {
      let query = from.delete();
      if (cardIds.length > 0 && documentIds.length > 0) {
        query = query.or(`card_id.in.(${cardIds.join(",")}),document_id.in.(${documentIds.join(",")})`);
      } else if (cardIds.length > 0) {
        query = query.in("card_id", cardIds);
      } else {
        query = query.in("document_id", documentIds);
      }
      return query;
    });
  }
  if (markerProposalIds.length > 0) {
    await safeDelete(service, "proposals", async (from) => from.delete().in("id", markerProposalIds));
  }
  await safeDelete(service, "invoices", async (from) => from.delete().ilike("invoice_number", pattern));
  await safeDelete(service, "documents", async (from) => from.delete().ilike("title", pattern));
  await safeDelete(service, "motions", async (from) => from.delete().ilike("title", pattern));
  await safeDelete(service, "cards", async (from) => from.delete().ilike("title", pattern));
  await safeDelete(service, "vendors", async (from) => from.delete().ilike("name", pattern));

  // Members + the second fixture committee, then auth users.
  await safeDelete(service, "members", async (from) => from.delete().ilike("email", pattern));
  await safeDelete(service, "committees", async (from) => from.delete().ilike("name", pattern));

  const users = await findAuthUsersByEmailPrefix(service, prefix);
  for (const user of users) {
    try {
      const { error } = await service.auth.admin.deleteUser(user.id);
      if (error) {
        console.warn(`[e2e cleanup] auth.admin.deleteUser(${user.email}) warning:`, error);
      }
    } catch (error) {
      console.warn(`[e2e cleanup] auth.admin.deleteUser(${user.email}) failed:`, error);
    }
  }
}
