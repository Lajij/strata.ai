import { resolveServiceKey } from "./service-key.mjs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.STRATA_BROWSER_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  resolveServiceKey();
const memberEmail = process.env.STRATA_MEMBER_EMAIL ?? "strata.member@example.com";
const memberPassword = process.env.STRATA_MEMBER_PASSWORD ?? "StrataMember123!";

if (!supabaseUrl || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for browser workflow cleanup.");
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

async function cleanupCard(title, description) {
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: cards, error } = await service.from("cards").select("id").eq("title", title).eq("description", description);

  if (error) {
    throw error;
  }

  for (const card of cards ?? []) {
    const { data: proposals } = await service.from("proposals").select("id").eq("card_id", card.id);
    const proposalIds = (proposals ?? []).map((proposal) => proposal.id);

    await service.from("audit_log").delete().eq("card_id", card.id);

    if (proposalIds.length) {
      await service.from("approval_conditions").delete().in("proposal_id", proposalIds);
      await service.from("votes").delete().in("proposal_id", proposalIds);
    }

    await service.from("proposals").delete().eq("card_id", card.id);
    await service.from("messages").delete().eq("card_id", card.id);
    await service.from("cards").delete().eq("id", card.id);
  }
}

const unique = new Date().toISOString().replace(/[:.]/g, "-");
const title = `UI verification card ${unique}`;
const description = "Browser verification record created through the Strata workflow UI; safe to delete.";
const message = `Browser verification message ${unique}`;
const proposal = `Approve browser verification ${unique}`;
const condition = `Browser verification condition ${unique}`;

await cleanupCard(title, description);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const observations = {
  signedIn: false,
  hiddenAbsent: false,
  noReloadAfterCreate: false,
  cardVisible: false,
  messageVisible: false,
  proposalVisible: false,
  voteRecorded: false,
  conditionVisible: false,
  auditVisible: false,
};

try {
  await page.goto(url, { waitUntil: "networkidle" });
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      navigations += 1;
    }
  });

  await page.getByLabel("Email").fill(memberEmail);
  await page.getByLabel("Password").fill(memberPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByText(memberEmail).waitFor({ timeout: 15000 });
  observations.signedIn = true;

  await page.getByRole("button", { name: "Cards" }).first().click();
  const initialText = await page.locator("body").innerText();
  observations.hiddenAbsent =
    !initialText.includes("Admin levy hardship matter") && !initialText.includes("Custom access legal review");

  const beforeCreateNavigations = navigations;
  await page.getByLabel("Card title").fill(title);
  await page.getByLabel("Card description").fill(description);
  await page.locator("form").filter({ hasText: "New card" }).getByLabel("Create card").click();
  await page.getByText(title).waitFor({ timeout: 20000 });
  observations.noReloadAfterCreate = navigations === beforeCreateNavigations;
  observations.cardVisible = true;

  await page.getByLabel("Message body").fill(message);
  await page.getByLabel("Post message").click();
  await page.getByText(message).waitFor({ timeout: 20000 });
  observations.messageVisible = true;

  await page.getByLabel("Proposal title").fill(proposal);
  await page.getByLabel("Proposal rationale").fill("Created during browser workflow verification.");
  await page.getByLabel("Create proposal").click();
  await page.getByText(proposal).waitFor({ timeout: 20000 });
  observations.proposalVisible = true;

  await page.getByLabel("Vote note").fill("Browser verification yes vote.");
  await page.getByLabel("Cast vote").click();
  await page.getByText("Vote cast and audited").waitFor({ timeout: 20000 });
  observations.voteRecorded = true;

  await page.getByLabel("Approval condition").fill(condition);
  await page.getByLabel("Add approval condition").click();
  await page.getByText(condition).waitFor({ timeout: 20000 });
  observations.conditionVisible = true;

  const finalText = await page.locator("body").innerText();
  observations.auditVisible =
    finalText.includes("Created card") ||
    finalText.includes("Posted message") ||
    finalText.includes("Created proposal") ||
    finalText.includes("Added approval condition");

  const ok = Object.values(observations).every(Boolean);

  console.log(JSON.stringify({ ok, observations }, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await cleanupCard(title, description);
}
