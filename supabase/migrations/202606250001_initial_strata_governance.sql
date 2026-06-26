create extension if not exists "pgcrypto";
create extension if not exists "vector";

create schema if not exists app_private;

create type public.member_role as enum ('admin', 'chair', 'secretary', 'treasurer', 'member', 'strata_manager');
create type public.member_status as enum ('active', 'invited', 'suspended');
create type public.visibility_level as enum ('all', 'admins', 'custom');
create type public.card_status as enum ('open', 'pending_vote', 'resolved', 'urgent', 'confidential');
create type public.card_type as enum ('maintenance', 'quote', 'invoice', 'compliance', 'budget', 'project', 'variation', 'incident', 'dispute', 'meeting', 'general');
create type public.vote_value as enum ('yes', 'no', 'abstain');
create type public.document_status as enum ('uploaded', 'needs_extraction', 'markdown_ready', 'indexed', 'review_required');
create type public.project_status as enum ('on_track', 'at_risk', 'needs_decision', 'resolved');
create type public.incident_status as enum ('open', 'investigating', 'closed');
create type public.severity_level as enum ('low', 'medium', 'high');

create table public.committees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  strata_plan text,
  jurisdiction text not null default 'NSW Australia',
  address text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.member_role not null default 'member',
  status public.member_status not null default 'invited',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (committee_id, email)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  title text not null,
  description text not null default '',
  type public.card_type not null default 'general',
  status public.card_status not null default 'open',
  visibility public.visibility_level not null default 'all',
  creator_member_id uuid references public.members(id),
  linked_project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_access (
  card_id uuid not null references public.cards(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, member_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  author_member_id uuid references public.members(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  title text not null,
  document_type text not null,
  source text not null default 'upload',
  source_date date,
  version_label text,
  visibility public.visibility_level not null default 'all',
  storage_path text,
  extracted_text_path text,
  markdown_path text,
  indexed_status public.document_status not null default 'uploaded',
  summary text,
  metadata jsonb not null default '{}',
  created_by_member_id uuid references public.members(id),
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  uploader_member_id uuid references public.members(id),
  file_name text not null,
  file_path text not null,
  file_size bigint,
  file_type text,
  extracted_text text,
  markdown text,
  created_at timestamptz not null default now()
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  title text not null,
  rationale text,
  status text not null default 'open',
  deadline timestamptz,
  created_by_member_id uuid references public.members(id),
  created_at timestamptz not null default now()
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  vote public.vote_value not null,
  note text,
  created_at timestamptz not null default now(),
  unique (proposal_id, member_id)
);

create table public.approval_conditions (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete cascade,
  vote_id uuid references public.votes(id) on delete cascade,
  condition_text text not null,
  status text not null default 'open',
  created_by_member_id uuid references public.members(id),
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  name text not null,
  account_type text not null,
  opening_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now()
);

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  budget_period_id uuid references public.budget_periods(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category text not null,
  approved_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.budget_allowances (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  budget_line_id uuid references public.budget_lines(id) on delete set null,
  name text not null,
  approved_amount numeric(12,2) not null default 0,
  committed_amount numeric(12,2) not null default 0,
  invoiced_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  name text not null,
  status public.project_status not null default 'on_track',
  planned_scope text not null default '',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  budget_allowance_id uuid references public.budget_allowances(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.cards
  add constraint cards_linked_project_id_fkey foreign key (linked_project_id) references public.projects(id) on delete set null;

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  planned_on date,
  actual_on date,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  name text not null,
  contact_email text,
  phone text,
  license_number text,
  insurance_status text,
  created_at timestamptz not null default now()
);

create table public.variations (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  title text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  scope_change text,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  invoice_number text,
  amount numeric(12,2) not null default 0,
  approval_status text not null default 'pending',
  due_on date,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  budget_line_id uuid references public.budget_lines(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null default 0,
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.quote_reviews (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  overall_risk public.severity_level not null default 'medium',
  missing_inclusions text[] not null default '{}',
  risky_exclusions text[] not null default '{}',
  clarification_questions text[] not null default '{}',
  approval_conditions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  title text not null,
  severity public.severity_level not null default 'medium',
  status public.incident_status not null default 'open',
  location text,
  occurred_at timestamptz,
  summary text not null default '',
  visibility public.visibility_level not null default 'all',
  created_by_member_id uuid references public.members(id),
  created_at timestamptz not null default now()
);

create table public.incident_evidence (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  evidence_type text not null,
  description text,
  external_url text,
  created_at timestamptz not null default now()
);

create table public.email_sources (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  thread_id text,
  message_id text,
  subject text,
  sender text,
  sent_at timestamptz,
  source_summary text,
  created_at timestamptz not null default now()
);

create table public.legislation_sources (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  title text not null,
  url text not null,
  version_label text,
  indexed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.legislation_chunks (
  id uuid primary key default gen_random_uuid(),
  legislation_source_id uuid references public.legislation_sources(id) on delete cascade,
  source text not null,
  section text not null,
  topic_tags text[] not null default '{}',
  body text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create table public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  incident_id uuid references public.incidents(id) on delete set null,
  output_type text not null,
  prompt_hash text,
  output jsonb not null,
  citations jsonb not null default '[]',
  model text,
  created_by_member_id uuid references public.members(id),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function app_private.is_committee_member(target_committee_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.committee_id = target_committee_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function app_private.member_role(target_committee_id uuid)
returns public.member_role
language sql
security definer
set search_path = public
as $$
  select m.role
  from public.members m
  where m.committee_id = target_committee_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1;
$$;

create or replace function app_private.can_access_card(target_card_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cards c
    where c.id = target_card_id
      and app_private.is_committee_member(c.committee_id)
      and (
        c.visibility = 'all'
        or (c.visibility = 'admins' and app_private.member_role(c.committee_id) in ('admin', 'chair', 'secretary', 'treasurer'))
        or (
          c.visibility = 'custom'
          and exists (
            select 1
            from public.card_access ca
            join public.members m on m.id = ca.member_id
            where ca.card_id = c.id
              and m.user_id = (select auth.uid())
              and m.status = 'active'
          )
        )
      )
  );
$$;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_committee_member(uuid) to authenticated;
grant execute on function app_private.member_role(uuid) to authenticated;
grant execute on function app_private.can_access_card(uuid) to authenticated;

alter table public.committees enable row level security;
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.cards enable row level security;
alter table public.card_access enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.attachments enable row level security;
alter table public.proposals enable row level security;
alter table public.votes enable row level security;
alter table public.approval_conditions enable row level security;
alter table public.accounts enable row level security;
alter table public.budget_periods enable row level security;
alter table public.budget_lines enable row level security;
alter table public.budget_allowances enable row level security;
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.vendors enable row level security;
alter table public.variations enable row level security;
alter table public.invoices enable row level security;
alter table public.expenses enable row level security;
alter table public.quote_reviews enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_evidence enable row level security;
alter table public.email_sources enable row level security;
alter table public.legislation_sources enable row level security;
alter table public.legislation_chunks enable row level security;
alter table public.ai_outputs enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "members can read their committees" on public.committees for select to authenticated
using (app_private.is_committee_member(id));

create policy "members can read committee roster" on public.members for select to authenticated
using (app_private.is_committee_member(committee_id));

create policy "admins can manage committee roster" on public.members for all to authenticated
using (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary'))
with check (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary'));

create policy "members can read visible cards" on public.cards for select to authenticated
using (app_private.can_access_card(id));

create policy "members can create cards in their committee" on public.cards for insert to authenticated
with check (app_private.is_committee_member(committee_id));

create policy "members can insert cards with active member row" on public.cards for insert to authenticated
with check (
  exists (
    select 1
    from public.members m
    where m.committee_id = cards.committee_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "admins and creators can update cards" on public.cards for update to authenticated
using (app_private.can_access_card(id) and app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'))
with check (app_private.is_committee_member(committee_id));

create policy "members can read card access rows" on public.card_access for select to authenticated
using (app_private.can_access_card(card_id));

create policy "admins can manage card access" on public.card_access for all to authenticated
using (
  exists (
    select 1 from public.cards c
    where c.id = card_access.card_id
      and app_private.member_role(c.committee_id) in ('admin', 'chair', 'secretary')
  )
)
with check (
  exists (
    select 1 from public.cards c
    where c.id = card_access.card_id
      and app_private.member_role(c.committee_id) in ('admin', 'chair', 'secretary')
  )
);

create policy "members read card-scoped messages" on public.messages for select to authenticated
using (app_private.can_access_card(card_id));

create policy "members insert messages on visible cards" on public.messages for insert to authenticated
with check (app_private.can_access_card(card_id) and app_private.is_committee_member(committee_id));

create policy "members read visible documents" on public.documents for select to authenticated
using (
  app_private.is_committee_member(committee_id)
  and (
    visibility = 'all'
    or (visibility = 'admins' and app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'))
    or (visibility = 'custom' and app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'))
  )
);

create policy "members create documents" on public.documents for insert to authenticated
with check (app_private.is_committee_member(committee_id));

create policy "members read visible attachments" on public.attachments for select to authenticated
using (
  app_private.is_committee_member(committee_id)
  and (card_id is null or app_private.can_access_card(card_id))
  and (
    document_id is null
    or exists (
      select 1
      from public.documents d
      where d.id = attachments.document_id
        and d.committee_id = attachments.committee_id
        and (
          d.visibility = 'all'
          or (d.visibility = 'admins' and app_private.member_role(d.committee_id) in ('admin', 'chair', 'secretary', 'treasurer'))
          or (d.visibility = 'custom' and app_private.member_role(d.committee_id) in ('admin', 'chair', 'secretary', 'treasurer'))
        )
    )
  )
);

create policy "members create attachments" on public.attachments for insert to authenticated
with check (app_private.is_committee_member(committee_id) and (card_id is null or app_private.can_access_card(card_id)));

create policy "members read proposals on visible cards" on public.proposals for select to authenticated
using (app_private.can_access_card(card_id));

create policy "members create proposals on visible cards" on public.proposals for insert to authenticated
with check (app_private.can_access_card(card_id) and app_private.is_committee_member(committee_id));

create policy "members read votes on visible proposals" on public.votes for select to authenticated
using (
  exists (
    select 1 from public.proposals p
    where p.id = votes.proposal_id and app_private.can_access_card(p.card_id)
  )
);

create policy "members cast their own vote" on public.votes for insert to authenticated
with check (
  app_private.is_committee_member(committee_id)
  and exists (
    select 1 from public.proposals p
    where p.id = votes.proposal_id
      and p.committee_id = votes.committee_id
      and app_private.can_access_card(p.card_id)
  )
  and exists (
    select 1 from public.members m
    where m.id = votes.member_id
      and m.user_id = (select auth.uid())
      and m.committee_id = votes.committee_id
  )
);

create policy "members read approval conditions" on public.approval_conditions for select to authenticated
using (
  exists (
    select 1 from public.proposals p
    where p.id = approval_conditions.proposal_id and app_private.can_access_card(p.card_id)
  )
);

create policy "members create approval conditions" on public.approval_conditions for insert to authenticated
with check (
  app_private.is_committee_member(committee_id)
  and (
    proposal_id is null
    or exists (
      select 1 from public.proposals p
      where p.id = approval_conditions.proposal_id
        and p.committee_id = approval_conditions.committee_id
        and app_private.can_access_card(p.card_id)
    )
  )
);

create policy "members read account data" on public.accounts for select to authenticated using (app_private.is_committee_member(committee_id));
create policy "treasurers manage account data" on public.accounts for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer'));

create policy "members read budget periods" on public.budget_periods for select to authenticated using (app_private.is_committee_member(committee_id));
create policy "treasurers manage budget periods" on public.budget_periods for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer'));

create policy "members read budget lines" on public.budget_lines for select to authenticated using (app_private.is_committee_member(committee_id));
create policy "treasurers manage budget lines" on public.budget_lines for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer'));

create policy "members read allowances" on public.budget_allowances for select to authenticated using (app_private.is_committee_member(committee_id));
create policy "treasurers manage allowances" on public.budget_allowances for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer'));

create policy "members read projects" on public.projects for select to authenticated using (app_private.is_committee_member(committee_id));
create policy "members manage projects" on public.projects for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'));

create policy "members read project milestones" on public.project_milestones for select to authenticated using (app_private.is_committee_member(committee_id));
create policy "members manage project milestones" on public.project_milestones for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'));

create policy "members read vendors" on public.vendors for select to authenticated using (app_private.is_committee_member(committee_id));
create policy "admins manage vendors" on public.vendors for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'));

create policy "members read variations" on public.variations for select to authenticated using (app_private.is_committee_member(committee_id) and (card_id is null or app_private.can_access_card(card_id)));
create policy "members manage variations" on public.variations for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'));

create policy "members read invoices" on public.invoices for select to authenticated using (app_private.is_committee_member(committee_id) and (card_id is null or app_private.can_access_card(card_id)));
create policy "treasurers manage invoices" on public.invoices for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer'));

create policy "members read expenses" on public.expenses for select to authenticated using (app_private.is_committee_member(committee_id));
create policy "treasurers manage expenses" on public.expenses for all to authenticated using (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer')) with check (app_private.member_role(committee_id) in ('admin', 'chair', 'treasurer'));

create policy "members read quote reviews" on public.quote_reviews for select to authenticated using (app_private.is_committee_member(committee_id) and (card_id is null or app_private.can_access_card(card_id)));
create policy "members create quote reviews" on public.quote_reviews for insert to authenticated with check (app_private.is_committee_member(committee_id));

create policy "members read incidents" on public.incidents for select to authenticated
using (
  app_private.is_committee_member(committee_id)
  and (
    visibility = 'all'
    or (visibility = 'admins' and app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'))
    or (visibility = 'custom' and app_private.member_role(committee_id) in ('admin', 'chair', 'secretary', 'treasurer'))
  )
);
create policy "members create incidents" on public.incidents for insert to authenticated with check (app_private.is_committee_member(committee_id));

create policy "members read incident evidence" on public.incident_evidence for select to authenticated using (app_private.is_committee_member(committee_id));
create policy "members create incident evidence" on public.incident_evidence for insert to authenticated with check (app_private.is_committee_member(committee_id));

create policy "members read email sources" on public.email_sources for select to authenticated using (app_private.is_committee_member(committee_id) and (card_id is null or app_private.can_access_card(card_id)));
create policy "members create email sources" on public.email_sources for insert to authenticated with check (app_private.is_committee_member(committee_id));

create policy "authenticated read legislation sources" on public.legislation_sources for select to authenticated using (true);
create policy "authenticated read legislation chunks" on public.legislation_chunks for select to authenticated using (true);

create policy "members read ai outputs" on public.ai_outputs for select to authenticated
using (
  app_private.is_committee_member(committee_id)
  and (card_id is null or app_private.can_access_card(card_id))
);
create policy "members create ai outputs" on public.ai_outputs for insert to authenticated with check (app_private.is_committee_member(committee_id));

create policy "members read audit log" on public.audit_log for select to authenticated
using (app_private.is_committee_member(committee_id) and (card_id is null or app_private.can_access_card(card_id)));
create policy "members create audit log" on public.audit_log for insert to authenticated
with check (app_private.is_committee_member(committee_id) and (card_id is null or app_private.can_access_card(card_id)));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.legislation_sources, public.legislation_chunks to anon;

insert into public.committees (id, name, strata_plan, jurisdiction, address)
values ('11111111-1111-1111-1111-111111111111', 'SP 6430 - 33 Malvern Avenue', 'SP 6430', 'NSW Australia', '33 Malvern Avenue, Manly NSW 2095');

insert into public.legislation_sources (id, source, title, url, version_label, indexed_at)
values
  ('22222222-2222-2222-2222-222222222221', 'legislation.nsw.gov.au', 'Strata Schemes Management Act 2015 No 50', 'https://legislation.nsw.gov.au/view/html/inforce/current/act-2015-050', 'current', now()),
  ('22222222-2222-2222-2222-222222222222', 'legislation.nsw.gov.au', 'Strata Schemes Management Regulation 2016', 'https://legislation.nsw.gov.au/view/html/inforce/current/sl-2016-0501', 'current', now()),
  ('22222222-2222-2222-2222-222222222223', 'nsw.gov.au', 'NSW Government strata guidance', 'https://www.nsw.gov.au/housing-and-construction/strata', 'last checked 2026-06-25', now());

insert into public.legislation_chunks (legislation_source_id, source, section, topic_tags, body)
values
  ('22222222-2222-2222-2222-222222222221', 'Strata Schemes Management Act 2015', 'Owners corporation duties', array['maintenance', 'common property'], 'Placeholder chunk for owners corporation duties. Replace with curated current legislation text during ingestion.'),
  ('22222222-2222-2222-2222-222222222221', 'Strata Schemes Management Act 2015', 'Levy interest and payment plans', array['levies', 'arrears'], 'Placeholder chunk for levy interest and payment-plan decisions. Replace with curated current legislation text during ingestion.'),
  ('22222222-2222-2222-2222-222222222222', 'Strata Schemes Management Regulation 2016', 'Meetings and records', array['meetings', 'minutes'], 'Placeholder chunk for meeting procedure and records. Replace with curated current regulation text during ingestion.');
