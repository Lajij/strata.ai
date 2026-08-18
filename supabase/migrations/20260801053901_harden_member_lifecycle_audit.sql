create or replace function app_private.enforce_member_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_user_id uuid := (select auth.uid());
begin
  if new.status = 'active' and new.user_id is null then
    raise exception 'Invited members must sign in before they can be marked active';
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'invited' and new.status = 'invited' then
      raise exception 'Active or suspended members cannot be moved back to invited';
    end if;

    if request_user_id is not null then
      if old.id is distinct from new.id
        or old.committee_id is distinct from new.committee_id
        or old.user_id is distinct from new.user_id
        or old.email is distinct from new.email
        or old.invited_by is distinct from new.invited_by
        or old.invited_by_member_id is distinct from new.invited_by_member_id
        or old.invited_at is distinct from new.invited_at
        or old.accepted_at is distinct from new.accepted_at then
        raise exception 'Member identity and invitation fields can only be changed by trusted server routes';
      end if;

      if old.user_id = request_user_id
        and (
          old.role is distinct from new.role
          or old.status is distinct from new.status
          or old.access_level is distinct from new.access_level
        ) then
        raise exception 'You cannot change your own role, access level, or active status';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_member_lifecycle() from public, anon, authenticated;

drop trigger if exists enforce_member_lifecycle on public.members;
create trigger enforce_member_lifecycle
before insert or update on public.members
for each row execute function app_private.enforce_member_lifecycle();

create or replace function app_private.audit_member_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_user_id uuid;
  audit_action text;
  previous_state jsonb;
begin
  if tg_op = 'UPDATE'
    and row(old.full_name, old.role, old.status, old.access_level)
      is not distinct from row(new.full_name, new.role, new.status, new.access_level) then
    return new;
  end if;

  actor_user_id := coalesce(
    (select auth.uid()),
    case
      when tg_op = 'INSERT' then new.invited_by
      when old.status = 'invited' and new.status = 'active' then new.user_id
      else null
    end
  );
  audit_action := case
    when tg_op = 'INSERT' and new.status = 'invited' then 'Invited member'
    when tg_op = 'INSERT' then 'Created member'
    when old.status is distinct from new.status then 'Changed member status'
    else 'Updated member access'
  end;
  previous_state := case
    when tg_op = 'INSERT' then null
    else jsonb_build_object(
      'full_name', old.full_name,
      'role', old.role,
      'status', old.status,
      'access_level', old.access_level
    )
  end;

  insert into public.audit_log (committee_id, user_id, action, target, metadata)
  values (
    new.committee_id,
    actor_user_id,
    audit_action,
    new.email,
    jsonb_build_object(
      'workflow', 'member-lifecycle',
      'member_id', new.id,
      'previous', previous_state,
      'next', jsonb_build_object(
        'full_name', new.full_name,
        'role', new.role,
        'status', new.status,
        'access_level', new.access_level
      )
    )
  );

  return new;
end;
$$;

revoke all on function app_private.audit_member_lifecycle() from public, anon, authenticated;

drop trigger if exists audit_member_lifecycle on public.members;
create trigger audit_member_lifecycle
after insert or update of full_name, role, status, access_level on public.members
for each row execute function app_private.audit_member_lifecycle();
