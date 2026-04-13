-- ============================================================
-- Migration 0016: Grant RPC execute to authenticated users
-- and add get_load_bids_for_shipper helper for mobile.
-- ============================================================

-- Allow authenticated users to call these SECURITY DEFINER functions
-- directly (e.g. from the mobile app with only the anon key).
GRANT EXECUTE ON FUNCTION public.place_bid_atomic(UUID, UUID, UUID, NUMERIC, SMALLINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_load_to_bid(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_bid_position(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_load_active_bid_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auction_started_for_load(UUID) TO authenticated;

-- ── Helper for mobile shipper: bids with company names ────────────────────────
-- Shippers can't join to companies via RLS (they can only see their own company).
-- This SECURITY DEFINER function returns active bids with transporter name for
-- a load owned by the calling shipper.
CREATE OR REPLACE FUNCTION public.get_load_bids_for_shipper(p_load_id UUID)
RETURNS TABLE(
  bid_id        UUID,
  amount        NUMERIC,
  eta_days      SMALLINT,
  notes         TEXT,
  status        bid_status,
  company_name  TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
  FROM user_profiles WHERE id = auth.uid();

  -- Verify the load belongs to this shipper
  IF NOT EXISTS (
    SELECT 1 FROM loads
    WHERE id = p_load_id AND shipper_company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Load not found or access denied';
  END IF;

  -- Only return bids once the blind phase has ended
  IF NOT public.auction_started_for_load(p_load_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.amount,
    b.eta_days,
    b.notes,
    b.status,
    c.name,
    b.created_at
  FROM bids b
  JOIN companies c ON c.id = b.transporter_company_id
  WHERE b.load_id = p_load_id
    AND b.status = 'active'
  ORDER BY b.amount ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_load_bids_for_shipper(UUID) TO authenticated;
