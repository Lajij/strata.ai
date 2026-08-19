-- Issue #6 (v1): committee approvals on an open motion.
-- Additive to the motions lifecycle (#39). Adds an outcome column, two new
-- tables, one new BEFORE UPDATE trigger that computes/validates the recorded
-- outcome at decision time, and RLS policies on the new tables only. Does NOT
-- modify guard_motion, any existing RLS policy, or any merged migration.

create type public.motion_outcome as enum ('passed', 'failed');

alter table public.motions
  add column if not exists outcome public.motion_outcome;

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  motion_id uuid not null references public.motions(id) on delete cascade,
  opened_by_member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists approval_requests_motion_id_uidx
  on public.approval_requests (motion_id);
create index if not exists approval_requests_committee_idx
  on public.approval_requests (committee_id);

create type public.approval_response_value as enum ('approve', 'reject');

create table public.approval_responses (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  response public.approval_response_value not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz not null default now()
);
create unique index if not exists approval_responses_request_member_uidx
  on public.approval_responses (approval_request_id, member_id);
create index if not exists approval_responses_request_idx
  on public.approval_responses (approval_request_id);

-- Fail-closed outcome guard. SECURITY INVOKER (mirrors guard_motion): fires for
-- every role (triggers are not bypassed by BYPASSRLS). Acts only on open->decided.
-- When an approval_request exists it RECOMPUTES outcome from recorded, attributed
-- responses (caller cannot forge passed/failed): PASSED iff approvals > rejections
-- among the votes cast; FAILED otherwise. The eligible-member count is never the
-- majority denominator. Every open->decided transition records a definitive outcome
-- (passed or failed); a bare decide with no approval request has zero votes cast
-- (approvals not greater than rejections) and records failed, so no decided motion
-- is left with a NULL outcome. NULL outcomes remain only for motions that are not
-- decided (draft / open / withdrawn). The transition legality itself is owned by
-- the existing motions_guard trigger; this guard only touches the outcome column
-- and is a no-op for every transition that is not open->decided, so trigger firing
-- order is irrelevant.
create or replace function app_private.guard_motion_outcome()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_id uuid;
  approvals int;
  rejections int;
begin
  if not (old.status = 'open' and new.status = 'decided') then
    return new;
  end if;

  select ar.id into request_id
  from public.approval_requests ar
  where ar.motion_id = new.id
  limit 1;

  select count(*) into approvals
  from public.approval_responses r
  where r.approval_request_id = request_id
    and r.response = 'approve';

  select count(*) into rejections
  from public.approval_responses r
  where r.approval_request_id = request_id
    and r.response = 'reject';

  if approvals > rejections then
    new.outcome := 'passed';
  else
    new.outcome := 'failed';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_motion_outcome() from public, anon;
drop trigger if exists guard_motion_outcome on public.motions;
create trigger guard_motion_outcome
  before update on public.motions
  for each row execute function app_private.guard_motion_outcome();

alter table public.approval_requests enable row level security;
alter table public.approval_responses enable row level security;

create policy "members read committee approval requests" on public.approval_requests
  for select to authenticated using (app_private.is_committee_member(committee_id));

create policy "members create approval request on open motion" on public.approval_requests
  for insert to authenticated with check (
    app_private.has_capability(committee_id, 'write_records')
    and opened_by_member_id = app_private.current_member_id(committee_id)
    and exists (
      select 1 from public.motions m
      where m.id = approval_requests.motion_id
        and m.committee_id = approval_requests.committee_id
        and m.status = 'open'
    )
  );

create policy "members read committee approval responses" on public.approval_responses
  for select to authenticated using (app_private.is_committee_member(committee_id));

create policy "members respond to open motion approval" on public.approval_responses
  for insert to authenticated with check (
    app_private.has_capability(committee_id, 'write_records')
    and member_id = app_private.current_member_id(committee_id)
    and exists (
      select 1 from public.approval_requests ar
      join public.motions m on m.id = ar.motion_id
      where ar.id = approval_responses.approval_request_id
        and ar.committee_id = approval_responses.committee_id
        and m.status = 'open'
    )
  );

create policy "members supersede own approval response on open motion" on public.approval_responses
  for update to authenticated
  using (
    member_id = app_private.current_member_id(committee_id)
    and app_private.has_capability(committee_id, 'write_records')
  )
  with check (
    app_private.has_capability(committee_id, 'write_records')
    and member_id = app_private.current_member_id(committee_id)
    and exists (
      select 1 from public.approval_requests ar
      join public.motions m on m.id = ar.motion_id
      where ar.id = approval_responses.approval_request_id
        and ar.committee_id = approval_responses.committee_id
        and m.status = 'open'
    )
  );

-- No DELETE policies => fail-closed. Requests/responses retained as history;
-- terminal motions are immutable (motions_guard blocks updates).
grant select, insert, update on public.approval_requests, public.approval_responses to authenticated;
