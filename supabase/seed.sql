-- Synthetic development/test seed only. Never include this file in a Production push.
-- Login-capable users and the remaining deterministic workspace records are created
-- by the separately guarded `npm run supabase:seed-live` operator script.

insert into public.committees (id, name, strata_plan, jurisdiction, address)
values (
  '77e87242-362d-4de6-a444-7174616a70b5',
  'Synthetic Strata Test Committee',
  'SP TEST-0001',
  'NSW Australia',
  '1 Example Street, Testville NSW 2000'
)
on conflict (id) do update
set
  name = excluded.name,
  strata_plan = excluded.strata_plan,
  jurisdiction = excluded.jurisdiction,
  address = excluded.address;
