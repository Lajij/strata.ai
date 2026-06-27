alter table public.members
  add column if not exists access_level text not null default 'member',
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by_member_id uuid references public.members(id),
  add column if not exists accepted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'members_access_level_check'
  ) then
    alter table public.members
      add constraint members_access_level_check
      check (access_level in ('admin', 'member', 'limited_admin', 'read_only'));
  end if;
end $$;

alter table public.members validate constraint members_access_level_check;
