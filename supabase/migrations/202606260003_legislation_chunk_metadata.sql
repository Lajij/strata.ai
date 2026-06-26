alter table public.legislation_chunks
  add column if not exists metadata jsonb not null default '{}'::jsonb;
