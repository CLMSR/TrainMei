-- Security hardening: prevent direct PostgREST/RPC execution of SECURITY DEFINER
-- routines. Triggers continue to invoke their trigger functions; internal function
-- calls continue to execute under the owning role. Re-review any future client RPC
-- before granting EXECUTE to authenticated users.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT n.nspname, p.proname, oidvectortypes(p.proargtypes) AS argtypes
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      f.nspname, f.proname, f.argtypes
    );
  END LOOP;
END $$;
