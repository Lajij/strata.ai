-- Make access_level an enforceable write boundary and pin caller-controlled
-- attribution/tenant links. The financial confirmer role set is the provisional
-- technical default (admin/chair/treasurer) pending the real-building human gate.

create index if not exists members_active_user_committee_idx
  on public.members (user_id, committee_id)
  where status = 'active';
create index if not exists cards_committee_id_idx on public.cards (committee_id);
create index if not exists documents_committee_id_idx on public.documents (committee_id);
create index if not exists projects_committee_id_idx on public.projects (committee_id);
create index if not exists incidents_committee_id_idx on public.incidents (committee_id);
create index if not exists audit_log_committee_created_at_idx on public.audit_log (committee_id, created_at desc);

create or replace function app_private.current_member_id(target_committee_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.id
  from public.members member
  where member.committee_id = target_committee_id
    and member.user_id = (select auth.uid())
    and member.status = 'active'
  limit 1;
$$;

create or replace function app_private.is_committee_member(target_committee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.current_member_id(target_committee_id) is not null;
$$;

create or replace function app_private.member_role(target_committee_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select member.role
  from public.members member
  where member.id = app_private.current_member_id(target_committee_id);
$$;

create or replace function app_private.has_capability(target_committee_id uuid, requested_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members member
    where member.id = app_private.current_member_id(target_committee_id)
      and (
        requested_capability = 'read_committee'
        or (
          member.access_level <> 'read_only'
          and (
            requested_capability = 'write_records'
            or (
              requested_capability = 'manage_members'
              and member.role in ('admin', 'chair', 'secretary')
            )
            or (
              requested_capability in ('manage_finance', 'confirm_financial_figures')
              and member.role in ('admin', 'chair', 'treasurer')
            )
          )
        )
      )
  );
$$;

create or replace function app_private.can_access_card(target_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cards card
    where card.id = target_card_id
      and app_private.is_committee_member(card.committee_id)
      and (
        card.visibility = 'all'
        or (
          card.visibility = 'admins'
          and app_private.member_role(card.committee_id) in ('admin', 'chair', 'secretary', 'treasurer')
        )
        or (
          card.visibility = 'custom'
          and exists (
            select 1
            from public.card_access access
            where access.card_id = card.id
              and access.member_id = app_private.current_member_id(card.committee_id)
          )
        )
      )
  );
$$;

create or replace function app_private.can_access_document(target_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.documents document
    where document.id = target_document_id
      and app_private.is_committee_member(document.committee_id)
      and (
        document.visibility = 'all'
        or (
          document.visibility in ('admins', 'custom')
          and app_private.member_role(document.committee_id) in ('admin', 'chair', 'secretary', 'treasurer')
        )
      )
  );
$$;

create or replace function app_private.can_access_incident(target_incident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.incidents incident
    where incident.id = target_incident_id
      and app_private.is_committee_member(incident.committee_id)
      and (
        incident.visibility = 'all'
        or (
          incident.visibility in ('admins', 'custom')
          and app_private.member_role(incident.committee_id) in ('admin', 'chair', 'secretary', 'treasurer')
        )
      )
  );
$$;

revoke all on function app_private.current_member_id(uuid) from public, anon;
revoke all on function app_private.is_committee_member(uuid) from public, anon;
revoke all on function app_private.member_role(uuid) from public, anon;
revoke all on function app_private.has_capability(uuid, text) from public, anon;
revoke all on function app_private.can_access_card(uuid) from public, anon;
revoke all on function app_private.can_access_document(uuid) from public, anon;
revoke all on function app_private.can_access_incident(uuid) from public, anon;
grant execute on function app_private.current_member_id(uuid) to authenticated;
grant execute on function app_private.is_committee_member(uuid) to authenticated;
grant execute on function app_private.member_role(uuid) to authenticated;
grant execute on function app_private.has_capability(uuid, text) to authenticated;
grant execute on function app_private.can_access_card(uuid) to authenticated;
grant execute on function app_private.can_access_document(uuid) to authenticated;
grant execute on function app_private.can_access_incident(uuid) to authenticated;

create or replace function app_private.enforce_audit_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_user_id uuid := (select auth.uid());
begin
  if request_user_id is not null then
    if app_private.current_member_id(new.committee_id) is null then
      raise exception 'Audit actor is not an active member of the target committee';
    end if;

    new.user_id := request_user_id;
    new.created_at := statement_timestamp();
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_audit_identity() from public, anon, authenticated;
drop trigger if exists enforce_audit_identity on public.audit_log;
create trigger enforce_audit_identity
before insert on public.audit_log
for each row execute function app_private.enforce_audit_identity();

create or replace function app_private.enforce_invoice_confirmation_capability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and old.approval_status is distinct from new.approval_status
    and not app_private.has_capability(new.committee_id, 'confirm_financial_figures') then
    raise exception 'Financial confirmation capability is required';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_invoice_confirmation_capability() from public, anon, authenticated;
drop trigger if exists enforce_invoice_confirmation_capability on public.invoices;
create trigger enforce_invoice_confirmation_capability
before update of approval_status on public.invoices
for each row execute function app_private.enforce_invoice_confirmation_capability();

drop policy if exists "admins can manage committee roster" on public.members;
create policy "capability inserts committee roster" on public.members for insert to authenticated
with check (app_private.has_capability(committee_id, 'manage_members'));
create policy "capability updates committee roster" on public.members for update to authenticated
using (app_private.has_capability(committee_id, 'manage_members'))
with check (app_private.has_capability(committee_id, 'manage_members'));

drop policy if exists "members can create cards in their committee" on public.cards;
drop policy if exists "members can insert cards with active member row" on public.cards;
drop policy if exists "admins and creators can update cards" on public.cards;
create policy "capability creates attributed cards" on public.cards for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and creator_member_id = app_private.current_member_id(committee_id)
  and (
    linked_project_id is null
    or exists (select 1 from public.projects project where project.id = linked_project_id and project.committee_id = cards.committee_id)
  )
);
create policy "capability updates visible cards" on public.cards for update to authenticated
using (app_private.can_access_card(id) and app_private.has_capability(committee_id, 'write_records'))
with check (
  app_private.has_capability(committee_id, 'write_records')
  and (
    linked_project_id is null
    or exists (select 1 from public.projects project where project.id = linked_project_id and project.committee_id = cards.committee_id)
  )
);

drop policy if exists "admins can manage card access" on public.card_access;
create policy "member managers control card access" on public.card_access for all to authenticated
using (
  exists (
    select 1 from public.cards card
    where card.id = card_access.card_id
      and app_private.has_capability(card.committee_id, 'manage_members')
  )
)
with check (
  exists (
    select 1
    from public.cards card
    join public.members member on member.id = card_access.member_id
    where card.id = card_access.card_id
      and member.committee_id = card.committee_id
      and app_private.has_capability(card.committee_id, 'manage_members')
  )
);

drop policy if exists "members insert messages on visible cards" on public.messages;
create policy "capability creates attributed messages" on public.messages for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and author_member_id = app_private.current_member_id(committee_id)
  and exists (
    select 1 from public.cards card
    where card.id = messages.card_id
      and card.committee_id = messages.committee_id
      and app_private.can_access_card(card.id)
  )
);

drop policy if exists "members create documents" on public.documents;
create policy "capability creates attributed documents" on public.documents for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and created_by_member_id = app_private.current_member_id(committee_id)
);

drop policy if exists "members create attachments" on public.attachments;
create policy "capability creates attributed attachments" on public.attachments for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and uploader_member_id = app_private.current_member_id(committee_id)
  and (
    card_id is null
    or exists (
      select 1 from public.cards card
      where card.id = attachments.card_id
        and card.committee_id = attachments.committee_id
        and app_private.can_access_card(card.id)
    )
  )
  and (
    document_id is null
    or exists (
      select 1 from public.documents document
      where document.id = attachments.document_id
        and document.committee_id = attachments.committee_id
        and app_private.can_access_document(document.id)
    )
  )
);

drop policy if exists "members create proposals on visible cards" on public.proposals;
create policy "capability creates attributed proposals" on public.proposals for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and created_by_member_id = app_private.current_member_id(committee_id)
  and exists (
    select 1 from public.cards card
    where card.id = proposals.card_id
      and card.committee_id = proposals.committee_id
      and app_private.can_access_card(card.id)
  )
);

drop policy if exists "members cast their own vote" on public.votes;
create policy "capability casts own vote" on public.votes for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and member_id = app_private.current_member_id(committee_id)
  and exists (
    select 1 from public.proposals proposal
    where proposal.id = votes.proposal_id
      and proposal.committee_id = votes.committee_id
      and app_private.can_access_card(proposal.card_id)
  )
);

drop policy if exists "members create approval conditions" on public.approval_conditions;
create policy "capability creates attributed approval conditions" on public.approval_conditions for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and created_by_member_id = app_private.current_member_id(committee_id)
  and (
    proposal_id is null
    or exists (
      select 1 from public.proposals proposal
      where proposal.id = approval_conditions.proposal_id
        and proposal.committee_id = approval_conditions.committee_id
        and app_private.can_access_card(proposal.card_id)
    )
  )
);

drop policy if exists "treasurers manage account data" on public.accounts;
create policy "finance capability manages accounts" on public.accounts for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (app_private.has_capability(committee_id, 'manage_finance'));
drop policy if exists "treasurers manage budget periods" on public.budget_periods;
create policy "finance capability manages budget periods" on public.budget_periods for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (app_private.has_capability(committee_id, 'manage_finance'));
drop policy if exists "treasurers manage budget lines" on public.budget_lines;
create policy "finance capability manages budget lines" on public.budget_lines for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (
  app_private.has_capability(committee_id, 'manage_finance')
  and (budget_period_id is null or exists (select 1 from public.budget_periods period where period.id = budget_lines.budget_period_id and period.committee_id = budget_lines.committee_id))
  and (account_id is null or exists (select 1 from public.accounts account where account.id = budget_lines.account_id and account.committee_id = budget_lines.committee_id))
);
drop policy if exists "treasurers manage allowances" on public.budget_allowances;
create policy "finance capability manages allowances" on public.budget_allowances for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (
  app_private.has_capability(committee_id, 'manage_finance')
  and (budget_line_id is null or exists (select 1 from public.budget_lines line where line.id = budget_allowances.budget_line_id and line.committee_id = budget_allowances.committee_id))
);
drop policy if exists "members manage projects" on public.projects;
create policy "finance capability manages projects" on public.projects for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (
  app_private.has_capability(committee_id, 'manage_finance')
  and (budget_allowance_id is null or exists (select 1 from public.budget_allowances allowance where allowance.id = projects.budget_allowance_id and allowance.committee_id = projects.committee_id))
);
drop policy if exists "members manage project milestones" on public.project_milestones;
create policy "finance capability manages project milestones" on public.project_milestones for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (
  app_private.has_capability(committee_id, 'manage_finance')
  and exists (select 1 from public.projects project where project.id = project_milestones.project_id and project.committee_id = project_milestones.committee_id)
);
drop policy if exists "admins manage vendors" on public.vendors;
create policy "finance capability manages vendors" on public.vendors for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (app_private.has_capability(committee_id, 'manage_finance'));
drop policy if exists "members manage variations" on public.variations;
create policy "finance capability manages variations" on public.variations for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (
  app_private.has_capability(committee_id, 'manage_finance')
  and (project_id is null or exists (select 1 from public.projects project where project.id = variations.project_id and project.committee_id = variations.committee_id))
  and (card_id is null or exists (select 1 from public.cards card where card.id = variations.card_id and card.committee_id = variations.committee_id and app_private.can_access_card(card.id)))
  and (vendor_id is null or exists (select 1 from public.vendors vendor where vendor.id = variations.vendor_id and vendor.committee_id = variations.committee_id))
);
drop policy if exists "treasurers manage invoices" on public.invoices;
create policy "finance capability manages invoices" on public.invoices for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (
  app_private.has_capability(committee_id, 'manage_finance')
  and (project_id is null or exists (select 1 from public.projects project where project.id = invoices.project_id and project.committee_id = invoices.committee_id))
  and (card_id is null or exists (select 1 from public.cards card where card.id = invoices.card_id and card.committee_id = invoices.committee_id and app_private.can_access_card(card.id)))
  and (vendor_id is null or exists (select 1 from public.vendors vendor where vendor.id = invoices.vendor_id and vendor.committee_id = invoices.committee_id))
  and (document_id is null or exists (select 1 from public.documents document where document.id = invoices.document_id and document.committee_id = invoices.committee_id and app_private.can_access_document(document.id)))
);
drop policy if exists "treasurers manage expenses" on public.expenses;
create policy "finance capability manages expenses" on public.expenses for all to authenticated
using (app_private.has_capability(committee_id, 'manage_finance'))
with check (
  app_private.has_capability(committee_id, 'manage_finance')
  and (account_id is null or exists (select 1 from public.accounts account where account.id = expenses.account_id and account.committee_id = expenses.committee_id))
  and (budget_line_id is null or exists (select 1 from public.budget_lines line where line.id = expenses.budget_line_id and line.committee_id = expenses.committee_id))
  and (project_id is null or exists (select 1 from public.projects project where project.id = expenses.project_id and project.committee_id = expenses.committee_id))
  and (invoice_id is null or exists (select 1 from public.invoices invoice where invoice.id = expenses.invoice_id and invoice.committee_id = expenses.committee_id))
);
drop policy if exists "members create quote reviews" on public.quote_reviews;
create policy "finance capability creates quote reviews" on public.quote_reviews for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'manage_finance')
  and (card_id is null or exists (select 1 from public.cards card where card.id = quote_reviews.card_id and card.committee_id = quote_reviews.committee_id and app_private.can_access_card(card.id)))
  and (document_id is null or exists (select 1 from public.documents document where document.id = quote_reviews.document_id and document.committee_id = quote_reviews.committee_id and app_private.can_access_document(document.id)))
);

drop policy if exists "members create incidents" on public.incidents;
create policy "capability creates attributed incidents" on public.incidents for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and created_by_member_id = app_private.current_member_id(committee_id)
);
drop policy if exists "members read incident evidence" on public.incident_evidence;
create policy "members read visible incident evidence" on public.incident_evidence for select to authenticated
using (
  exists (
    select 1 from public.incidents incident
    where incident.id = incident_evidence.incident_id
      and incident.committee_id = incident_evidence.committee_id
      and app_private.can_access_incident(incident.id)
  )
  and (
    document_id is null
    or exists (
      select 1 from public.documents document
      where document.id = incident_evidence.document_id
        and document.committee_id = incident_evidence.committee_id
        and app_private.can_access_document(document.id)
    )
  )
);
drop policy if exists "members create incident evidence" on public.incident_evidence;
create policy "capability creates visible incident evidence" on public.incident_evidence for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and exists (
    select 1 from public.incidents incident
    where incident.id = incident_evidence.incident_id
      and incident.committee_id = incident_evidence.committee_id
      and app_private.can_access_incident(incident.id)
  )
  and (
    document_id is null
    or exists (
      select 1 from public.documents document
      where document.id = incident_evidence.document_id
        and document.committee_id = incident_evidence.committee_id
        and app_private.can_access_document(document.id)
    )
  )
);

drop policy if exists "members create email sources" on public.email_sources;
create policy "capability creates email sources" on public.email_sources for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and (card_id is null or exists (select 1 from public.cards card where card.id = email_sources.card_id and card.committee_id = email_sources.committee_id and app_private.can_access_card(card.id)))
);

drop policy if exists "members read ai outputs" on public.ai_outputs;
create policy "members read visible linked ai outputs" on public.ai_outputs for select to authenticated
using (
  app_private.is_committee_member(committee_id)
  and (card_id is null or exists (select 1 from public.cards card where card.id = ai_outputs.card_id and card.committee_id = ai_outputs.committee_id and app_private.can_access_card(card.id)))
  and (document_id is null or exists (select 1 from public.documents document where document.id = ai_outputs.document_id and document.committee_id = ai_outputs.committee_id and app_private.can_access_document(document.id)))
  and (project_id is null or exists (select 1 from public.projects project where project.id = ai_outputs.project_id and project.committee_id = ai_outputs.committee_id))
  and (incident_id is null or exists (select 1 from public.incidents incident where incident.id = ai_outputs.incident_id and incident.committee_id = ai_outputs.committee_id and app_private.can_access_incident(incident.id)))
);
drop policy if exists "members create ai outputs" on public.ai_outputs;
create policy "capability creates attributed ai outputs" on public.ai_outputs for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and created_by_member_id = app_private.current_member_id(committee_id)
  and (card_id is null or exists (select 1 from public.cards card where card.id = ai_outputs.card_id and card.committee_id = ai_outputs.committee_id and app_private.can_access_card(card.id)))
  and (document_id is null or exists (select 1 from public.documents document where document.id = ai_outputs.document_id and document.committee_id = ai_outputs.committee_id and app_private.can_access_document(document.id)))
  and (project_id is null or exists (select 1 from public.projects project where project.id = ai_outputs.project_id and project.committee_id = ai_outputs.committee_id))
  and (incident_id is null or exists (select 1 from public.incidents incident where incident.id = ai_outputs.incident_id and incident.committee_id = ai_outputs.committee_id and app_private.can_access_incident(incident.id)))
);

drop policy if exists "members create audit log" on public.audit_log;
create policy "capability creates pinned audit log" on public.audit_log for insert to authenticated
with check (
  app_private.has_capability(committee_id, 'write_records')
  and user_id = (select auth.uid())
  and (card_id is null or exists (select 1 from public.cards card where card.id = audit_log.card_id and card.committee_id = audit_log.committee_id and app_private.can_access_card(card.id)))
);

drop policy if exists "active members upload strata document objects" on storage.objects;
create policy "write capability uploads strata document objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'strata-documents'
  and app_private.has_capability(((storage.foldername(name))[1])::uuid, 'write_records')
);
