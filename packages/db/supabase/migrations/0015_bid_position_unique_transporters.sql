-- ── 0015 · Bid position counts unique transporters, not raw bids ─────────────
--
-- Previously get_my_bid_position ranked every active bid row and counted
-- all rows, so one transporter with multiple historical bids (open phase)
-- could inflate both the rank and the total.
--
-- New behaviour:
--   1. Derive each transporter's *best* (lowest) active bid.
--   2. RANK() those one-per-company rows.
--   3. COUNT(*) those rows → total unique transporters who have bid.
--   4. Return the calling transporter's rank and that unique-transporter count.

CREATE OR REPLACE FUNCTION public.get_my_bid_position(p_load_id UUID)
RETURNS TABLE(bid_id UUID, amount NUMERIC, bid_position BIGINT, total_bids BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN QUERY
  WITH best_per_company AS (
    -- One row per transporter: their lowest active bid on this load
    SELECT DISTINCT ON (b.transporter_company_id)
      b.id,
      b.transporter_company_id,
      b.amount
    FROM bids b
    WHERE b.load_id = p_load_id
      AND b.status  = 'active'
    ORDER BY b.transporter_company_id, b.amount ASC
  ),
  ranked AS (
    SELECT
      bpc.id,
      bpc.transporter_company_id,
      bpc.amount,
      RANK() OVER (ORDER BY bpc.amount ASC) AS pos,
      COUNT(*) OVER ()                       AS total   -- unique transporter count
    FROM best_per_company bpc
  )
  SELECT r.id, r.amount, r.pos, r.total
  FROM   ranked r
  WHERE  r.transporter_company_id = v_company_id
  LIMIT  1;
END;
$$;
