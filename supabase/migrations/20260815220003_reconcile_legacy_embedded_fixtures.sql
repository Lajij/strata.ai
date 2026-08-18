-- The original alpha migration mixed schema DDL with a real-building-shaped row
-- and placeholder law content. Preserve that already-published migration byte
-- for history compatibility, then reconcile it forward without silently
-- deleting a workspace that may have acquired real or verification data.

do $reconcile$
declare
  legacy_committee_id constant uuid := '11111111-1111-1111-1111-111111111111';
  dependent_table record;
  has_dependent_rows boolean;
begin
  if exists (
    select 1
    from public.committees
    where id = legacy_committee_id
      and name = 'SP 6430 - 33 Malvern Avenue'
      and strata_plan = 'SP 6430'
      and jurisdiction = 'NSW Australia'
      and address = '33 Malvern Avenue, Manly NSW 2095'
  ) then
    for dependent_table in
      select namespace.nspname as schema_name, relation.relname as table_name
      from pg_catalog.pg_attribute attribute
      join pg_catalog.pg_class relation on relation.oid = attribute.attrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind in ('r', 'p')
        and attribute.attname = 'committee_id'
        and not attribute.attisdropped
    loop
      execute format(
        'select exists (select 1 from %I.%I where committee_id = $1)',
        dependent_table.schema_name,
        dependent_table.table_name
      )
      into has_dependent_rows
      using legacy_committee_id;

      if has_dependent_rows then
        raise exception using
          errcode = 'P0001',
          message = format(
            'Legacy SP 6430 row has dependent data in %I.%I; stop and reconcile it under the real-building human gate before applying this migration.',
            dependent_table.schema_name,
            dependent_table.table_name
          );
      end if;
    end loop;

    delete from public.committees
    where id = legacy_committee_id
      and name = 'SP 6430 - 33 Malvern Avenue'
      and strata_plan = 'SP 6430'
      and jurisdiction = 'NSW Australia'
      and address = '33 Malvern Avenue, Manly NSW 2095';
  end if;

  delete from public.legislation_chunks
  where (
    legislation_source_id = '22222222-2222-2222-2222-222222222221'
    and source = 'Strata Schemes Management Act 2015'
    and section = 'Owners corporation duties'
    and topic_tags = array['maintenance', 'common property']::text[]
    and body = 'Placeholder chunk for owners corporation duties. Replace with curated current legislation text during ingestion.'
  ) or (
    legislation_source_id = '22222222-2222-2222-2222-222222222221'
    and source = 'Strata Schemes Management Act 2015'
    and section = 'Levy interest and payment plans'
    and topic_tags = array['levies', 'arrears']::text[]
    and body = 'Placeholder chunk for levy interest and payment-plan decisions. Replace with curated current legislation text during ingestion.'
  ) or (
    legislation_source_id = '22222222-2222-2222-2222-222222222222'
    and source = 'Strata Schemes Management Regulation 2016'
    and section = 'Meetings and records'
    and topic_tags = array['meetings', 'minutes']::text[]
    and body = 'Placeholder chunk for meeting procedure and records. Replace with curated current regulation text during ingestion.'
  );

  delete from public.legislation_sources source
  where (
    (
      source.id = '22222222-2222-2222-2222-222222222221'
      and source.source = 'legislation.nsw.gov.au'
      and source.title = 'Strata Schemes Management Act 2015 No 50'
      and source.url = 'https://legislation.nsw.gov.au/view/html/inforce/current/act-2015-050'
      and source.version_label = 'current'
    ) or (
      source.id = '22222222-2222-2222-2222-222222222222'
      and source.source = 'legislation.nsw.gov.au'
      and source.title = 'Strata Schemes Management Regulation 2016'
      and source.url = 'https://legislation.nsw.gov.au/view/html/inforce/current/sl-2016-0501'
      and source.version_label = 'current'
    ) or (
      source.id = '22222222-2222-2222-2222-222222222223'
      and source.source = 'nsw.gov.au'
      and source.title = 'NSW Government strata guidance'
      and source.url = 'https://www.nsw.gov.au/housing-and-construction/strata'
      and source.version_label = 'last checked 2026-06-25'
    )
  )
    and not exists (
      select 1
      from public.legislation_chunks chunk
      where chunk.legislation_source_id = source.id
    );
end
$reconcile$;
