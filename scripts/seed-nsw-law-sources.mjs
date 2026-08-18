import { resolveServiceKey } from "./service-key.mjs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertSafeMutationTarget } from "./target-environment-guard.mjs";

loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  resolveServiceKey();

if (!supabaseUrl || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to seed NSW law sources.");
}

assertSafeMutationTarget({
  url: supabaseUrl,
  operation: "seed:law",
});

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const indexedAt = new Date().toISOString();

const sources = [
  {
    id: "22222222-2222-2222-2222-222222222221",
    source: "legislation.nsw.gov.au",
    title: "Strata Schemes Management Act 2015 No 50",
    url: "https://legislation.nsw.gov.au/view/html/inforce/current/act-2015-050",
    version_label: "current; checked 2026-06-26",
    indexed_at: indexedAt,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    source: "legislation.nsw.gov.au",
    title: "Strata Schemes Management Regulation 2016",
    url: "https://legislation.nsw.gov.au/view/html/inforce/current/sl-2016-0501",
    version_label: "current; checked 2026-06-26",
    indexed_at: indexedAt,
  },
  {
    id: "22222222-2222-2222-2222-222222222223",
    source: "nsw.gov.au",
    title: "NSW Government strata guidance",
    url: "https://www.nsw.gov.au/housing-and-construction/strata",
    version_label: "NSW Government strata hub; checked 2026-06-26",
    indexed_at: indexedAt,
  },
];

const sourceById = new Map(sources.map((source) => [source.id, source]));

function lawChunk(index, source, section, tags, body) {
  const parent = sourceById.get(source.id);

  return {
    id: `77777777-7777-7777-7777-77777777${String(index).padStart(4, "0")}`,
    legislation_source_id: source.id,
    source: source.title,
    section,
    topic_tags: tags,
    body,
    metadata: {
      corpus: "nsw-strata-v2",
      official_source_title: parent.title,
      official_source_url: parent.url,
      indexed_date: indexedAt,
      version_label: parent.version_label,
      limitation: "Curated general-information summary for retrieval. Not complete and not legal advice.",
      source_access_note:
        parent.source === "legislation.nsw.gov.au"
          ? "Official current legislation URL verified; automated text fetching may be challenged by the source site."
          : "Official NSW Government guidance page checked during corpus preparation.",
    },
  };
}

const chunks = [
  lawChunk(
    1,
    sources[0],
    "Section 9 - owners corporation functions",
    ["owners corporation", "committee duties", "governance"],
    "Curated summary: the owners corporation is the legal body responsible for managing the strata scheme for the benefit of owners. Committee workflows should distinguish owner-level decisions, delegated committee actions, and strata manager administration.",
  ),
  lawChunk(
    2,
    sources[0],
    "Section 36 - functions of strata committee",
    ["strata committee", "committee duties", "delegation"],
    "Curated summary: the strata committee exercises functions of the owners corporation unless the Act, regulations, or owners corporation decision reserves the matter. AI recommendations should flag when a decision may need owners corporation approval rather than committee action alone.",
  ),
  lawChunk(
    3,
    sources[0],
    "Section 43 - strata committee meetings",
    ["meetings", "committee", "minutes"],
    "Curated summary: strata committee meeting procedure and decision records matter for governance evidence. Summaries should separate motions, votes, action items, conflicts, and informal discussion so minutes can be checked before reliance.",
  ),
  lawChunk(
    4,
    sources[0],
    "Part 4 - by-laws",
    ["by-laws", "scheme rules", "enforcement"],
    "Curated summary: by-laws regulate scheme conduct and use of lots/common property. The app should cite the building's registered by-laws before suggesting enforcement, breach action, renovation approval conditions, or resident obligations.",
  ),
  lawChunk(
    5,
    sources[0],
    "Section 106 - duty to maintain and repair common property",
    ["maintenance", "common property", "repairs"],
    "Curated summary: owners corporations are responsible for maintaining common property in good and serviceable repair and renewing or replacing common-property fixtures or fittings when needed. Repair workflows should capture urgency, common-property nexus, evidence, quote scope, and decision authority.",
  ),
  lawChunk(
    6,
    sources[0],
    "Section 108 - changes to common property",
    ["common property", "approval", "renovation"],
    "Curated summary: adding to, altering, or erecting a new structure on common property is a formal owners corporation decision area. The app should flag likely special-resolution or by-law checks before approving works affecting shared property.",
  ),
  lawChunk(
    7,
    sources[0],
    "Section 109 - common property rights by-laws",
    ["common property rights", "exclusive use", "by-laws"],
    "Curated summary: exclusive-use or special-privilege arrangements over common property require the correct by-law pathway. The app should not treat exclusive-use rights as ordinary maintenance or informal permission.",
  ),
  lawChunk(
    8,
    sources[0],
    "Section 110 - minor renovations by owners",
    ["renovation", "approval", "lot owner"],
    "Curated summary: minor renovations have a specific approval pathway. Committees should check whether the work is minor, whether a by-law changes approval handling, and whether waterproofing, structure, safety, or common property effects push the matter into a stricter category.",
  ),
  lawChunk(
    9,
    sources[0],
    "Section 111 - cosmetic work by owners",
    ["renovation", "cosmetic work", "lot owner"],
    "Curated summary: cosmetic work is treated differently from minor renovation and common-property alteration work. The app should classify work type and capture exclusions before suggesting that no formal approval is needed.",
  ),
  lawChunk(
    10,
    sources[0],
    "Part 5 - administrative and capital works funds",
    ["finances", "levies", "capital works"],
    "Curated summary: strata finances operate through administrative and capital works funds, budgets, owner contributions, and levy decisions. Budget insights should cite official accounts, levy motions, invoices, and treasurer or strata-manager records.",
  ),
  lawChunk(
    11,
    sources[0],
    "Part 5 - contribution notices, interest, and arrears",
    ["levies", "arrears", "payment plans"],
    "Curated summary: levy collection, arrears, interest, and payment arrangements are formal financial governance matters. Recommendations should distinguish hardship/payment-plan discussion from binding levy decisions and debt recovery steps.",
  ),
  lawChunk(
    12,
    sources[0],
    "Part 10 - records and information",
    ["records", "document access", "strata roll"],
    "Curated summary: schemes have record-keeping and access obligations covering records such as minutes, notices, strata roll material, financial statements, correspondence, and owners corporation documents. AI summaries should mark whether a source is an official record or working note.",
  ),
  lawChunk(
    13,
    sources[0],
    "Part 12 - orders and dispute resolution",
    ["disputes", "NCAT", "mediation"],
    "Curated summary: some strata disputes may need mediation, tribunal orders, or other formal pathways. The app should treat dispute guidance as triage only and recommend professional advice where rights, orders, or enforcement consequences are involved.",
  ),
  lawChunk(
    14,
    sources[1],
    "Regulation - meeting notices and agenda material",
    ["meetings", "agenda", "notices"],
    "Curated summary: the Regulation supplements the Act with operational meeting detail, including prescribed procedural material. Meeting workflows should retain notice date, agenda, motion wording, attachments, attendance, votes, and minutes links.",
  ),
  lawChunk(
    15,
    sources[1],
    "Regulation - voting and committee procedure",
    ["votes", "committee", "procedure"],
    "Curated summary: voting and meeting procedure must be checked against the current Regulation, Act, and scheme circumstances. The app should flag when a workflow record is only a draft tally rather than official minutes.",
  ),
  lawChunk(
    16,
    sources[1],
    "Regulation - records and inspection detail",
    ["records", "inspection", "document access"],
    "Curated summary: regulation-level detail supports records inspection and prescribed document processes. Document vault answers should cite official records and avoid implying that uploaded files are complete strata records.",
  ),
  lawChunk(
    17,
    sources[1],
    "Regulation - model by-laws and scheme rules",
    ["by-laws", "model by-laws", "scheme rules"],
    "Curated summary: the Regulation includes model by-law material and related rule settings, but registered scheme by-laws may differ. The app should cite the building's uploaded by-laws before recommending breach steps or conditions.",
  ),
  lawChunk(
    18,
    sources[1],
    "Regulation - forms and certificates",
    ["forms", "certificates", "compliance"],
    "Curated summary: prescribed forms, certificates, and supporting records can be relevant to committee workflows. The app should capture completion evidence, certification obligations, and the source document path before recommending approval or payment.",
  ),
  lawChunk(
    19,
    sources[2],
    "Renovation rules",
    ["renovation", "approval", "common property"],
    "Curated guidance summary: NSW Government guidance tells owners to understand what approvals are needed before making changes and to use the relevant approval process. The app should classify cosmetic, minor, and common-property-impacting work before recommending next steps.",
  ),
  lawChunk(
    20,
    sources[2],
    "Repairs and maintenance",
    ["repairs", "maintenance", "common property"],
    "Curated guidance summary: NSW Government guidance explains who is responsible for repairs and maintenance and how to request them. Committee workflows should capture request date, common-property connection, urgency, evidence, quote status, and manager response.",
  ),
  lawChunk(
    21,
    sources[2],
    "Strata by-laws",
    ["by-laws", "breach", "scheme rules"],
    "Curated guidance summary: NSW Government guidance explains that by-laws cover scheme rules such as pets, smoking, parking, noise, short-term rental accommodation, and conduct. The app should compare questions against the uploaded registered by-laws before suggesting enforcement action.",
  ),
  lawChunk(
    22,
    sources[2],
    "Strata meetings",
    ["meetings", "agm", "general meetings", "minutes"],
    "Curated guidance summary: NSW Government guidance describes annual general meetings and general meetings as owner decision points. AI meeting summaries should identify decisions, action items, unresolved issues, and items needing formal minutes or notices checked.",
  ),
  lawChunk(
    23,
    sources[2],
    "Strata finances",
    ["levies", "budget", "capital works", "administration fund"],
    "Curated guidance summary: NSW Government guidance frames strata finances around costs such as repairs, maintenance, administration, and capital works. Budget AI should reconcile against official statements, levy motions, invoices, and treasurer or strata-manager records.",
  ),
  lawChunk(
    24,
    sources[2],
    "Strata records and strata roll",
    ["records", "strata roll", "document access"],
    "Curated guidance summary: NSW Government guidance covers strata roll and record-keeping requirements. The app should preserve document provenance, visibility, indexed status, and citation paths when answering questions from uploaded files.",
  ),
  lawChunk(
    25,
    sources[2],
    "Resolving strata disputes",
    ["disputes", "mediation", "tribunal"],
    "Curated guidance summary: NSW Government guidance points residents and committees toward structured dispute-resolution pathways. AI should frame dispute output as triage, cite visible records, and recommend qualified advice for rights, orders, or enforcement questions.",
  ),
];

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

await must("upsert legislation sources", supabase.from("legislation_sources").upsert(sources, { onConflict: "id" }));

const placeholderRows = await must(
  "find placeholder chunks",
  supabase.from("legislation_chunks").select("id,body").ilike("body", "Placeholder chunk%"),
);
const managedRows = await must(
  "find previous managed law corpus chunks",
  supabase.from("legislation_chunks").select("id"),
);

const deleteIds = [
  ...new Set([
    ...placeholderRows.map((row) => row.id),
    ...managedRows.filter((row) => row.id.startsWith("77777777-7777-7777-7777-77777777")).map((row) => row.id),
  ]),
];

if (deleteIds.length) {
  await must(
    "delete previous managed or placeholder chunks",
    supabase
      .from("legislation_chunks")
      .delete()
      .in("id", deleteIds),
  );
}

await must("upsert curated legislation chunks", supabase.from("legislation_chunks").upsert(chunks, { onConflict: "id" }));

console.log(
  JSON.stringify(
    {
      ok: true,
      sourceCount: sources.length,
      chunkCount: chunks.length,
      deletedPlaceholderCount: placeholderRows.length,
      deletedManagedCount: managedRows.length,
      indexedAt,
    },
    null,
    2,
  ),
);
