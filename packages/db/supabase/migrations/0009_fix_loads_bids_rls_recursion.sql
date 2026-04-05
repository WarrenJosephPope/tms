-- ============================================================
-- Fix infinite recursion in loads <-> bids RLS policies
-- Migration: 0009_fix_loads_bids_rls_recursion.sql
--
-- The mutual EXISTS subqueries between these two policies caused
-- infinite recursion (PG error 42P17):
--   • "loads: transporter read bid loads"  queries bids
--   • "bids: shipper read own loads"       queries loads
--
-- Fix: wrap each cross-table check in a SECURITY DEFINER function
-- so the subquery executes without invoking the other table's RLS.
-- ============================================================

-- Helper: does the calling transporter company have any bid on this load?
CREATE OR REPLACE FUNCTION transporter_has_bid_on_load(p_load_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM bids
    WHERE bids.load_id = p_load_id
      AND bids.transporter_company_id = auth_company_id()
  )
$$;

-- Helper: does this load belong to the calling shipper's company?
CREATE OR REPLACE FUNCTION load_belongs_to_auth_shipper(p_load_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM loads
    WHERE loads.id = p_load_id
      AND loads.shipper_company_id = auth_company_id()
  )
$$;

-- -------------------------------------------------------
-- Recreate loads policy that referenced bids
-- -------------------------------------------------------
DROP POLICY IF EXISTS "loads: transporter read bid loads" ON loads;

CREATE POLICY "loads: transporter read bid loads" ON loads
  FOR SELECT USING (
    auth_user_type() = 'transporter'
    AND transporter_has_bid_on_load(loads.id)
  );

-- -------------------------------------------------------
-- Recreate bids policy that referenced loads
-- -------------------------------------------------------
DROP POLICY IF EXISTS "bids: shipper read own loads" ON bids;

CREATE POLICY "bids: shipper read own loads" ON bids
  FOR SELECT USING (
    auth_user_type() = 'shipper'
    AND load_belongs_to_auth_shipper(bids.load_id)
  );
