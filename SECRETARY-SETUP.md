# Secretary Member Setup for RC Testing

**Problem:** After auth succeeds, the app still shows the sign-in form with "Member session already active" or fails with `SUPABASE_APP_DATA_QUERY_FAILED` because there is no active secretary member row linked to the authenticated user.

**Root cause:** The Supabase project `osgvagsouxgbrnbljhxb` is missing an active secretary member with the required schema:
- `user_id` must be set (linked to an Auth user)
- `status` must be `'active'`
- `role` must be `'secretary'` (or another role with write capability)
- `access_level` must NOT be `'read_only'` (default `'member'` is fine)
- `committee_id` must match `11111111-1111-1111-1111-111111111111` (33 Malvern)

---

## Operator Instructions

### Required Schema Verification

First, verify the Supabase project has the RC schema (motions, approvals, members.access_level):

```sql
-- Check motions table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'motions'
);

-- Check approval_requests table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'approval_requests'
);

-- Check access_level column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'members' 
  AND column_name = 'access_level';
```

**If any of these return false or no rows:** The migrations have not been applied. Run all migrations in `supabase/migrations/` in order, especially:
- `202606270001_member_invites.sql` (adds access_level)
- `202608160001_capability_and_attribution_hardening.sql` (adds capability functions)
- `20260819120001_motions_lifecycle.sql` (adds motions table)
- `20260820120001_committee_approvals.sql` (adds approval_requests/responses)

### Option 1: Create Secretary via Supabase Dashboard (Recommended)

1. **Create Auth User:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User" → "Create New User"
   - Email: `secretary@33malvern.example` (or real email JJ controls)
   - Password: (set a strong password JJ will use)
   - Check "Auto Confirm User"
   - Copy the generated `user_id` (UUID)

2. **Create Member Row:**
   - Go to Supabase Dashboard → Table Editor → `members`
   - Click "Insert" → "Insert Row"
   - Fields:
     ```
     id: (leave blank, auto-generated)
     committee_id: 11111111-1111-1111-1111-111111111111
     user_id: <paste the Auth user_id from step 1>
     email: secretary@33malvern.example
     full_name: Committee Secretary
     role: secretary
     status: active
     access_level: member
     ```
   - Click "Save"

3. **Test Sign-In:**
   - Go to https://strata-ai-azure.vercel.app/
   - Sign in with the secretary email and password
   - You should land in the committee workspace (not stay on sign-in form)
   - Empty motions list should show (no fixture data on RC)

### Option 2: Create Secretary via SQL (If Dashboard Access Unavailable)

If JJ has SQL access but not Dashboard access:

```sql
-- Step 1: Create the Auth user (requires auth admin API; if unavailable, use Dashboard)
-- This step MUST be done via Dashboard or Auth Admin API; raw SQL cannot create Auth users

-- Step 2: Create the member row (use the user_id from the Auth user created above)
INSERT INTO public.members (
  id,
  committee_id,
  user_id,
  email,
  full_name,
  role,
  status,
  access_level
) VALUES (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '<AUTH_USER_ID>', -- Replace with actual user_id from Auth
  'secretary@33malvern.example',
  'Committee Secretary',
  'secretary',
  'active',
  'member'
);
```

### Option 3: Modify Existing Seed Admin

**Warning:** This changes the seed admin to a secretary. Only do this if the seed admin is not being used for other testing.

```sql
UPDATE public.members
SET 
  role = 'secretary',
  full_name = 'Committee Secretary',
  status = 'active',
  access_level = 'member'
WHERE email = 'strata.admin@example.com'
  AND committee_id = '11111111-1111-1111-1111-111111111111';
```

Then sign in with the seed admin credentials (if known to JJ).

---

## Acceptance Criteria

After completing the setup, the following must work:

### 1. Secretary Sign-In Flow

- Navigate to https://strata-ai-azure.vercel.app/
- Sign in with secretary credentials
- ✅ **PASS:** Lands in committee workspace (not stuck on sign-in form)
- ✅ **PASS:** Empty motions list visible (no fixture data)
- ✅ **PASS:** "Motions" tab shows in navigation
- ❌ **FAIL:** Stays on sign-in form with "Member session already active"
- ❌ **FAIL:** Shows "Workspace temporarily unavailable" with `SUPABASE_APP_DATA_QUERY_FAILED`

### 2. Motion Creation (Secretary Capability)

Via browser console or API client:

```javascript
// Create a draft motion
const response = await fetch('/api/workflow/create-motion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '33 Malvern Test Motion',
    context: 'RC acceptance test'
  })
});
const result = await response.json();
console.log(result); // Should show { mode: 'supabase', id: '<uuid>', message: '...' }
```

✅ **PASS:** Returns 200 with motion id
❌ **FAIL:** Returns 403 "read-only" or 401 "Sign in as active member"

### 3. Motion Lifecycle (CI Coverage)

The following E2E tests already cover the motion lifecycle and should PASS in CI:

- `e2e/journeys/motion-lifecycle.spec.ts` - draft → open → decided/withdrawn
- `e2e/journeys/approval-flow.spec.ts` - open motion → approval request → responses → passed/failed outcome

Run CI to verify:
```bash
npm run test:e2e
```

---

## Why This Setup Is Required

The app uses a **fail-closed architecture**:

1. Sign-in is NOT sufficient to access the workspace
2. After auth succeeds, `/api/app-data` queries the `members` table for an active member row matching:
   ```typescript
   .from("members")
   .select("id, committee_id, role, full_name, user_id, email, access_level")
   .eq("user_id", user.id)          // Links to Auth user
   .eq("status", "active")          // Only active members
   .limit(1)
   .maybeSingle()
   ```
3. If no matching row is found, `getCurrentMember()` returns `null` and the app shows signed-out mode
4. Motions require `write_records` capability, which requires `access_level !== 'read_only'`

### Capability Matrix

| Role | Default access_level | Can create motions? | Can manage members? | Can manage finance? |
|------|---------------------|--------------------|--------------------|---------------------|
| admin | member | ✅ Yes | ✅ Yes | ✅ Yes |
| chair | member | ✅ Yes | ✅ Yes | ✅ Yes |
| secretary | member | ✅ Yes | ✅ Yes | ❌ No |
| treasurer | member | ✅ Yes | ❌ No | ✅ Yes |
| member | member | ✅ Yes | ❌ No | ❌ No |
| (any) | read_only | ❌ **NO** | ❌ No | ❌ No |

**Key:** The secretary role with default `access_level='member'` CAN create motions and run approvals. The issue is simply that no such member row exists yet.

---

## Verification Checklist

After setup, verify the following in the Supabase project:

- [ ] Auth user exists with email matching the secretary
- [ ] Auth user is confirmed (`email_confirmed_at` is set)
- [ ] Member row exists with `committee_id = '11111111-1111-1111-1111-111111111111'`
- [ ] Member row has `user_id` matching the Auth user's `id`
- [ ] Member row has `status = 'active'`
- [ ] Member row has `role = 'secretary'`
- [ ] Member row has `access_level = 'member'` (or `'admin'` / `'limited_admin'`, but NOT `'read_only'`)
- [ ] Migrations are applied (motions, approval_requests, approval_responses tables exist)
- [ ] Secretary can sign in at https://strata-ai-azure.vercel.app/
- [ ] Secretary lands in committee workspace (not stuck on sign-in)
- [ ] Empty motions list shows (no fixtures in RC)

---

## What This PR Contains

This PR provides:

1. **Documentation** (this file) explaining the exact operator steps to create a secretary member
2. **No code changes** - the repo code is correct; the gap is operator-side (missing secretary member in Supabase)
3. **Test verification** - existing E2E tests already cover motion lifecycle and approvals (they pass in CI when run against a properly seeded database)

The PR targets `codex/strata-v1-release-candidate` and does NOT touch main or Production.

---

## Questions?

If the secretary still cannot sign in after following these steps:

1. Check the browser console for errors (F12 → Console)
2. Check the Network tab for the `/api/app-data` response (should be 200, not 500)
3. Verify the member row exists and matches all criteria above
4. Verify migrations are applied (check for `motions` table, `access_level` column)
5. Try signing in with a different browser/incognito to rule out cached session issues
