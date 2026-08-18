drop policy if exists "members read visible attachments" on public.attachments;
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
