alter table public.ai_outputs
  add column if not exists status text not null default 'completed',
  add column if not exists duration_ms integer,
  add column if not exists input_record_count integer not null default 0,
  add column if not exists citation_count integer not null default 0,
  add column if not exists error_message text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_mode text not null default 'unknown';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_outputs_status_check'
      and conrelid = 'public.ai_outputs'::regclass
  ) then
    alter table public.ai_outputs
      add constraint ai_outputs_status_check
      check (status in ('completed', 'error'))
      not valid;
  end if;
end $$;

alter table public.ai_outputs
  validate constraint ai_outputs_status_check;
