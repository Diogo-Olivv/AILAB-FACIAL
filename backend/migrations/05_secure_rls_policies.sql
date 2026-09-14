-- Migration 05: Secure RLS Policies
-- Replaces overly-permissive authenticated policies with tutor-only equivalents.
-- Execute manually in Supabase SQL Editor BEFORE deploying backend changes.
--
-- INVARIANT: After this migration any Supabase authenticated user who does NOT
-- have app_metadata->>'role' = 'tutor' will be denied INSERT/UPDATE/DELETE on
-- profiles and sessions through the RLS layer. The service_role key (backend) is
-- unaffected — service_role bypasses RLS entirely.

-- ─── 1. Drop vulnerable policies ─────────────────────────────────────────────

DROP POLICY IF EXISTS authenticated_update_profiles  ON public.profiles;
DROP POLICY IF EXISTS authenticated_manage_sessions  ON public.sessions;

-- ─── 2. Tutor-only write access on profiles ──────────────────────────────────
-- Only allows INSERT/UPDATE/DELETE when the caller's JWT contains
-- app_metadata->>'role' = 'tutor'.  SELECT is NOT granted here — reads still
-- go through service_role on the backend; anonymous or authenticated SELECTs
-- on profiles are denied (fail-closed).

CREATE POLICY tutor_write_profiles
    ON public.profiles
    FOR ALL
    USING      ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'tutor' )
    WITH CHECK ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'tutor' );

-- ─── 3. Tutor-only write access on sessions ──────────────────────────────────
-- Replaces the wildcard FOR ALL USING (true) policy that allowed any
-- authenticated user to mutate any presence record.

CREATE POLICY tutor_write_sessions
    ON public.sessions
    FOR ALL
    USING      ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'tutor' )
    WITH CHECK ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'tutor' );

-- ─── 4. Verification query (run after applying migration) ─────────────────────
-- Expected: zero rows for the deleted policy names.
-- SELECT policyname, tablename FROM pg_policies
-- WHERE policyname IN ('authenticated_update_profiles', 'authenticated_manage_sessions');
