drop extension if exists "pg_net";

create type "public"."odin_support_ticket_category" as enum ('bug', 'account', 'transaction', 'budget', 'forecast', 'anomaly', 'privacy', 'general');

create type "public"."odin_support_ticket_event_action" as enum ('created', 'commented', 'status_changed', 'attachment_added', 'closed', 'reopened');

create type "public"."odin_support_ticket_status" as enum ('open', 'in_review', 'waiting_for_user', 'resolved', 'closed');

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;


  create policy "support_ticket_attachments_storage_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'support-ticket-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "support_ticket_attachments_storage_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'support-ticket-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "support_ticket_attachments_storage_select"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'support-ticket-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "support_ticket_attachments_storage_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'support-ticket-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
with check (((bucket_id = 'support-ticket-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



