-- Target project ref: lewzqavgvltzwfeypvam
-- Records already-applied hardening: prevent direct anon/authenticated execution of trigger-oriented function public.handle_new_user().

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid,
           n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_new_user'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated;',
      fn.schema_name,
      fn.function_name,
      fn.args
    );
  END LOOP;
END $$;
