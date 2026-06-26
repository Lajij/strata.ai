import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const routeSource = readFileSync(join(root, "src/app/api/ai/[task]/route.ts"), "utf8");
const contextSource = readFileSync(join(root, "src/lib/ai/context.ts"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

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

async function signInClient(url, anonKey) {
  const email = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
  const password = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });

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

assert(packageJson.scripts["seed:law"]?.includes("seed-nsw-law-sources"), "Missing seed:law script");
assert(packageJson.scripts["verify:law"]?.includes("verify-law-sources"), "Missing verify:law script");
assert(contextSource.includes('.from("legislation_sources")'), "AI context must load legislation_sources metadata");
assert(contextSource.includes("legislation_source_id"), "AI context must join legislation chunk source IDs");
assert(contextSource.includes("sourceUrl"), "AI context must expose official source URLs in law citations");
assert(contextSource.includes("Limitation:"), "AI context must expose law limitation metadata");
assert(routeSource.includes("No indexed NSW strata law context"), "Law lookup must refuse when no indexed law context exists");
assert(routeSource.includes("general information, not legal advice"), "Law lookup must include legal disclaimer language");
assert(!routeSource.includes("placeholder chunks"), "Law route fallback must not describe placeholder chunks");

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (url && anonKey && serviceKey) {
  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const memberClient = await signInClient(url, anonKey);

  const [sources, chunks, visibleChunks] = await Promise.all([
    must("read legislation sources", service.from("legislation_sources").select("id,source,title,url,version_label,indexed_at")),
    must(
      "read legislation chunks",
      service.from("legislation_chunks").select("id,legislation_source_id,source,section,topic_tags,body,metadata"),
    ),
    must(
      "member read legislation chunks",
      memberClient.from("legislation_chunks").select("id,legislation_source_id,source,section,topic_tags,body,metadata"),
    ),
  ]);

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const curated = chunks.filter((chunk) => /^77777777-7777-7777-7777-77777777/.test(chunk.id));

  assert(curated.length >= 25, `Expected at least 25 curated chunks, found ${curated.length}`);
  assert(visibleChunks.length >= 25, `Expected ordinary member to see at least 25 law chunks, found ${visibleChunks.length}`);
  assert(
    !chunks.some((chunk) => /Placeholder chunk|placeholder chunks/i.test(chunk.body)),
    "Placeholder chunk text still exists in live legislation_chunks",
  );
  assert(
    curated.every((chunk) => chunk.legislation_source_id && sourceById.has(chunk.legislation_source_id)),
    "Every curated chunk must reference a source",
  );
  assert(curated.every((chunk) => chunk.topic_tags.length > 0 && chunk.body.length > 120), "Curated chunks need tags and body text");
  assert(
    curated.every(
      (chunk) =>
        chunk.metadata?.corpus === "nsw-strata-v2" &&
        chunk.metadata?.official_source_title &&
        chunk.metadata?.official_source_url &&
        chunk.metadata?.indexed_date &&
        chunk.metadata?.version_label &&
        /not complete and not legal advice/i.test(chunk.metadata?.limitation ?? ""),
    ),
    "Every curated chunk must include source and limitation metadata",
  );
  assert(
    curated.every((chunk) => {
      const source = sourceById.get(chunk.legislation_source_id);
      return source?.url.startsWith("https://legislation.nsw.gov.au/") || source?.url.startsWith("https://www.nsw.gov.au/");
    }),
    "Every curated chunk must point to an official NSW URL through its source",
  );
  assert(
    curated.some((chunk) => sourceById.get(chunk.legislation_source_id)?.title.includes("Act 2015")) &&
      curated.some((chunk) => sourceById.get(chunk.legislation_source_id)?.title.includes("Regulation 2016")) &&
      curated.some((chunk) => sourceById.get(chunk.legislation_source_id)?.title.includes("NSW Government")),
    "Curated chunks must cover Act, Regulation, and NSW guidance sources",
  );
  for (const requiredTopic of [
    "maintenance",
    "common property",
    "renovation",
    "by-laws",
    "records",
    "meetings",
    "levies",
    "finances",
    "committee duties",
    "repairs",
    "disputes",
    "document access",
  ]) {
    assert(
      curated.some((chunk) => chunk.topic_tags.includes(requiredTopic)),
      `Curated chunks must cover topic tag: ${requiredTopic}`,
    );
  }
  assert(
    sources.every((source) => source.title && source.url && source.version_label && source.indexed_at),
    "Each law source needs title, URL, version label, and indexed date",
  );
}

console.log("NSW law source verification passed.");
