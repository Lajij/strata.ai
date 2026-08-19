-- Grant service_role necessary table privileges for PostgREST access.
-- PostgREST as service_role bypasses RLS but still requires GRANT on tables.
-- The initial migration granted DML only to authenticated; this adds service_role.

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Ensure future tables also grant to service_role
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
