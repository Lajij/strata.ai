# strata.ai Handoff

Last updated: 2026-06-28

## Current Goal

`strata.ai` is being prepared for Vercel Preview verification after completing live Supabase setup. The live Supabase project is now seeded and verified, but the Vercel-linked local checkout still needs to be consolidated with the migrated publishable/secret-key code before the preview/browser verification loop starts.

## Important Local Paths

Vercel-linked checkout:

```text
/Users/jjlecocq/Documents/Codex/strata.ai
```

Migrated publishable/secret-key checkout used for successful Supabase verification:

```text
/Users/jjlecocq/Documents/Codex/2026-06-28/new-chat/strata.ai
```

Current Vercel-linked project metadata in `/Users/jjlecocq/Documents/Codex/strata.ai/.vercel/project.json`:

```json
{"projectId":"prj_vV0YWNGeNd7ww61Z1eHnKnpRYFO0","orgId":"team_yGfSSn3ynBOeR2WRcs2Z3lVi","projectName":"strata-ai"}
```

## Environment

The Vercel-linked checkout has `.env.local` with these key names present:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not print env values. The successful local verification mapped:

```bash
SUPABASE_SECRET_KEY="$SUPABASE_SERVICE_ROLE_KEY"
```

for scripts that need Auth Admin / privileged cleanup behavior.

## Live Supabase State

Supabase project:

```text
https://osgvagsouxgbrnbljhxb.supabase.co
project ref: osgvagsouxgbrnbljhxb
status observed via Supabase connector: ACTIVE_HEALTHY
```

The live setup loop completed successfully after adding the service-role key locally. The following passed in the migrated checkout:

```bash
npm run supabase:seed-live
npm run seed:law
npm run verify:production-ready
npm run verify:documents
npm run verify:ai
npm run verify:law
STRATA_VERIFY_LIVE_AUTH=1 npm run verify:auth-flow
STRATA_VERIFY_LIVE_MEMBERS=1 npm run verify:member-management
```

Evidence from the successful run:

```text
Live workspace seed:
- adminEmail: strata.admin@example.com
- memberEmail: strata.member@example.com
- adminVisibleCards: 3
- memberVisibleCards: 1
- memberVisibleDocuments: 1
- memberVisibleMessages: 1
- memberAiContextRecords: 2

Law seed:
- sourceCount: 3
- chunkCount: 25

Production readiness:
- env: true
- secretHygiene: true
- aiFallbackOrLiveMode: true
- storageBucket: true
- memberRlsReads: true
```

The `strata-documents` bucket was repaired/applied through a non-destructive Supabase connector migration named:

```text
repair_document_storage_bucket
```

It recreated/confirmed:

- private `strata-documents` bucket
- 50 MiB file size limit
- allowed MIME types for text, markdown, PDF, and DOCX
- active-member upload policy
- active-member visible-document read policy

## Current Repo State

In `/Users/jjlecocq/Documents/Codex/strata.ai`, current notable working tree state:

```text
M  middleware.ts
D  supabase/migrations/202606260001_tighten_attachment_document_visibility.sql
?? supabase/migrations/20260628145525_tighten_attachment_document_visibility.sql
?? .agents/
?? skills-lock.json
?? supabase/.branches/
?? supabase/.temp/
```

The `middleware.ts` change is intentional and fixed a Vercel Edge deployment bundling issue:

```ts
import { updateSession } from "./src/lib/supabase/middleware";
```

instead of:

```ts
import { updateSession } from "@/lib/supabase/middleware";
```

The Vercel-linked checkout still appears to use legacy env names in code/scripts:

```text
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The migrated checkout contains the publishable/secret-key code changes:

```text
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

So do not start preview verification from the Vercel-linked checkout until the migrated changes are consolidated or the migrated checkout is linked to Vercel.

## Vercel State

Vercel team/scope:

```text
jjlecocq-8964s-projects
team_yGfSSn3ynBOeR2WRcs2Z3lVi
```

Vercel project:

```text
strata-ai
prj_vV0YWNGeNd7ww61Z1eHnKnpRYFO0
```

Previously created preview deployment:

```text
https://strata-ferbrs8ec-jjlecocq-8964s-projects.vercel.app
```

That preview was built before the publishable/secret-key migration was consolidated into the Vercel-linked checkout, so treat it as stale.

Important caution: an earlier attempted deploy was recorded by Vercel as an errored Production deployment even though preview was intended. Do not use `--prod`, `promote`, or rollback commands in the next loop.

## What Is Done

- Supabase URL and keys are present locally in the Vercel-linked checkout.
- Live Supabase storage bucket/policies are repaired.
- Live workspace seed passed.
- NSW law corpus seed passed.
- Production readiness passed in the migrated checkout.
- Documents, AI, law, live auth, and live member-management verification passed in the migrated checkout.
- Vercel project `strata-ai` exists and the Vercel-linked checkout has `.vercel/project.json`.

## What Is Not Done

- The publishable/secret-key migration is not consolidated into the Vercel-linked checkout.
- A fresh Vercel preview deployment has not been created from the consolidated code.
- Preview env vars for `strata-ai` may still need to be updated to include the new public key names.
- Preview browser verification has not passed yet:

```bash
STRATA_BROWSER_URL=<preview-url> npm run verify:auth-browser
STRATA_BROWSER_URL=<preview-url> npm run verify:ai-browser
```

## Recommended Next Loop

```text
> SELF-CHECKING LOOP

You will work in a loop until the task meets the bar.

TASK:
Consolidate the migrated Supabase publishable/secret-key code into the Vercel-linked strata.ai checkout, deploy a fresh Vercel Preview without promoting production, and verify the preview with browser-level auth and AI checks.

SUCCESS CRITERIA (be strict, no soft passes):
- The Vercel-linked checkout at /Users/jjlecocq/Documents/Codex/strata.ai contains the migrated publishable/secret-key code from /Users/jjlecocq/Documents/Codex/2026-06-28/new-chat/strata.ai.
- Existing useful Vercel link metadata is preserved or intentionally recreated for project strata-ai.
- Local .env.local contains required keys without printing values: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, and any verification credentials.
- Local checks pass in the Vercel-linked checkout:
  npm run lint
  npm run build
  npm run verify:security
  npm run verify:production-ready
  npm run verify:documents
  npm run verify:ai
  npm run verify:law
  STRATA_VERIFY_LIVE_AUTH=1 npm run verify:auth-flow
  STRATA_VERIFY_LIVE_MEMBERS=1 npm run verify:member-management
- Vercel Preview env vars are configured for the current key names, especially NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
- A fresh Vercel Preview deployment is created and reaches Ready status.
- Production is not promoted or modified during this loop.
- Preview URL is accessible for browser verification, using a temporary Vercel share URL if deployment protection requires it.
- Browser verification passes against preview:
  STRATA_BROWSER_URL=<preview-url> npm run verify:auth-browser
  STRATA_BROWSER_URL=<preview-url> npm run verify:ai-browser
- Preview proves signed-out locked state, admin sign-in, ordinary member sign-in, member-management restrictions, suspended-member lockout, hidden-record filtering, and AI fallback/live states.
- No secret, service-role, or Supabase secret key value is printed, committed, exposed to browser code, or added to NEXT_PUBLIC_*.

LOOP PROTOCOL, repeat every turn:
1. PLAN
   State the single next step.

2. DO
   Perform that step. Make sensible assumptions and continue unless blocked by secrets, account permissions, production promotion, destructive database actions, or risky external-state changes.

3. VERIFY
   Score each success criterion from 1-10.
   Be brutally honest.
   List exactly what is still weak, unproven, failing, or blocked.

4. DECIDE
   If every criterion is 8 or higher:
   - Print "FINAL".
   - Summarize completed work.
   - State what remains unproven, if anything.
   - Recommend the next loop.

   Otherwise:
   - Print "ITERATING".
   - Fix the weakest-scoring criterion first in the next pass.

RULES:
- Never call it done until every criterion is 8 or higher.
- Do not print secrets.
- Do not use vercel --prod, vercel promote, or production rollback.
- Do not weaken Supabase RLS, storage policies, or verification scripts to make checks pass.
- Preserve fallback mode.
- Preserve the middleware relative import fix unless a better verified Vercel-compatible fix is made.
- Keep SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SECRET_KEY server/local-only.

Begin. Run the loop until FINAL.
```
