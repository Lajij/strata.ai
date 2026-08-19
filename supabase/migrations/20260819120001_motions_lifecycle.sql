-- Issue #39: motion lifecycle draft -> open -> decided | withdrawn.
-- Separate from cards/proposals/votes (#6). Does not modify any existing RLS
-- policy; it only adds new policies on the new motions table plus one additive
-- audit_log.motion_id column that rides the existing card_id-is-null branch.

create type public.motion_status as enum ('draft', 'open', 'decided', 'withdrawn');

create table public.motions (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  title text not null,
  context text not null default '',
  status public.motion_status not null default 'draft',
  creator_member_id uuid references public.members(id) on delete set null,
  opened_at timestamptz,
  decided_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists motions_committee_id_idx on public.motions (committee_id);
create index if not exists motions_committee_updated_idx on public.motions (committee_id, updated_at desc);

-- Additive motion linkage on audit_log (mirrors card_id). The existing
-- audit_log SELECT/INSERT policies already admit card_id-is-null rows, so
-- motion audit rows pass without any policy change.
alter table public.audit_log
  add column if not exists motion_id uuid references public.motions(id) on delete set null;

-- State-machine guard. SECURITY INVOKER with a locked search_path and fully
-- qualified refs (mirrors RC's has_capability/enforce_audit_identity pattern).
-- Triggers are not bypassed by BYPASSRLS, so the lifecycle is enforced for every
-- role including service_role: inserts must start in draft, terminal motions are
-- immutable, and only draft->open, open->decided, open->withdrawn are legal.
create or replace function app_private.guard_motion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    if new.status is null then
      new.status := 'draft';
    end if;
    if new.status <> 'draft' then
      raise exception 'Motions must be created in draft status';
    end if;
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE: terminal motions are immutable.
  if old.status in ('decided', 'withdrawn') then
    raise exception 'Motion % is % and cannot be edited', old.id, old.status;
  end if;

  if new.status is distinct from old.status then
    if not ( (old.status = 'draft' and new.status = 'open')
          or (old.status = 'open'  and new.status = 'decided')
          or (old.status = 'open'  and new.status = 'withdrawn') ) then
      raise exception 'Illegal motion state transition: % -> %', old.status, new.status;
    end if;
    if new.status = 'open' then
      new.opened_at := now();
    elsif new.status = 'decided' then
      new.decided_at := now();
    elsif new.status = 'withdrawn' then
      new.withdrawn_at := now();
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function app_private.guard_motion() from public, anon;
drop trigger if exists motions_guard on public.motions;
create trigger motions_guard
  before insert or update on public.motions
  for each row execute function app_private.guard_motion();

alter table public.motions enable row level security;

-- All active committee members (including read_only) see motions and their state.
create policy "members read committee motions" on public.motions for select to authenticated
using (app_private.is_committee_member(committee_id));

-- Write-capable members create motions; creator is pinned to the caller
-- (mirrors the cards attribution policy).
create policy "members create motions" on public.motions for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and creator_member_id = app_private.current_member_id(committee_id)
);

-- Write-capable members advance/edit motions; the guard_motion trigger enforces
-- the legal transitions and the terminal-state lock.
create policy "members advance motions" on public.motions for update to authenticated
using (app_private.has_capability(committee_id, 'write_records'))
with check (app_private.has_capability(committee_id, 'write_records'));

-- No DELETE policy => denied (fail-closed). Terminal motions are retained as
-- history. authenticated still needs explicit DML grants for the new table
-- (the initial grant only covered then-existing tables).
grant select, insert, update on public.motions to authenticated;
