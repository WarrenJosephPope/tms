-- ============================================================
-- Blind-phase bidding: bid_start_time on loads
-- Migration: 0010_bid_start_time.sql
--
-- Adds bid_start_time (TIMESTAMPTZ, nullable) to loads.
-- NULL  → bidding is immediately visible (existing behaviour).
-- SET   → sealed/blind phase until that timestamp; only after it
--         does the shipper see who bid and do transporters see their rank.
--
-- Changes:
--   1. Add bid_start_time column to loads
--   2. Add auction_started_for_load() helper for RLS
--   3. Tighten "bids: shipper read own loads" RLS to gate on bid_start_time
--   4. Add get_load_active_bid_count() for shipper blind-phase display
--   5. Add get_my_bid_position() for transporter rank tracking
--   6. Replace place_bid_atomic() to support blind-phase upsert semantics
-- ============================================================

-- ── 1. Schema change ─────────────────────────────────────────────────────────
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS bid_start_time TIMESTAMPTZ NULL;

-- ── 2. Helper: has the auction reveal window opened for this load? ────────────
--      Returns TRUE when bid_start_time IS NULL (immediate) or has passed.
CREATE OR REPLACE FUNCTION public.auction_started_for_load(p_load_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM loads
    WHERE id = p_load_id
      AND (bid_start_time IS NULL OR bid_start_time <= NOW())
  )
$$;

-- ── 3. Update shipper bids RLS policy to gate on bid_start_time ───────────────
--      (replaces the policy created/updated in 0009)
DROP POLICY IF EXISTS "bids: shipper read own loads" ON public.bids;

CREATE POLICY "bids: shipper read own loads" ON public.bids
  FOR SELECT USING (
    auth_user_type() = 'shipper'
    AND load_belongs_to_auth_shipper(bids.load_id)
    AND auction_started_for_load(bids.load_id)
  );

-- ── 4. Active bid count for a load (admin-level, called via API with auth guard)
CREATE OR REPLACE FUNCTION public.get_load_active_bid_count(p_load_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COUNT(*)::INTEGER
  FROM bids
  WHERE load_id = p_load_id
    AND status = 'active'
$$;

-- ── 5. Transporter's own position among all active bids on a load ─────────────
--      Returns one row: the calling transporter's best (lowest-amount) active bid
--      plus its RANK() and the total active bid count.
--      Returns no rows if the transporter has no active bid.
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
  WITH all_active AS (
    SELECT
      b.id,
      b.transporter_company_id,
      b.amount,
      RANK() OVER (ORDER BY b.amount ASC) AS pos,
      COUNT(*) OVER ()                    AS total
    FROM bids b
    WHERE b.load_id = p_load_id
      AND b.status  = 'active'
  )
  SELECT a.id, a.amount, a.pos, a.total
  FROM   all_active a
  WHERE  a.transporter_company_id = v_company_id
  ORDER  BY a.pos ASC
  LIMIT  1;
END;
$$;

-- ── 6. Replace place_bid_atomic to handle blind vs open phase ─────────────────
--
-- BLIND phase  (bid_start_time IS NOT NULL AND NOW() < bid_start_time):
--   • Amount must be > 0 and < opening_price
--   • Upsert: UPDATE existing active bid for this transporter, or INSERT new one
--   • No inter-transporter decrement enforced (sealed bids)
--
-- OPEN phase (bid_start_time IS NULL OR NOW() >= bid_start_time):
--   • Amount must beat the current lowest active bid by at least min_bid_decrement_inr
--   • INSERT new bid (existing behaviour)
CREATE OR REPLACE FUNCTION public.place_bid_atomic(
  p_load_id                UUID,
  p_transporter_company_id UUID,
  p_bidder_id              UUID,
  p_amount                 NUMERIC,
  p_eta_days               SMALLINT,
  p_notes                  TEXT
)
RETURNS bids LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_load              loads%ROWTYPE;
  v_current_min       NUMERIC;
  v_new_bid           bids%ROWTYPE;
  v_min_decrement_inr NUMERIC;
  v_in_blind_phase    BOOLEAN;
BEGIN
  -- Lock the load row for the duration of this transaction
  SELECT * INTO v_load FROM loads WHERE id = p_load_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load not found: %', p_load_id;
  END IF;

  IF v_load.status <> 'open' THEN
    RAISE EXCEPTION 'Load is not open for bidding. Status: %', v_load.status;
  END IF;

  IF NOW() > v_load.auction_end_time THEN
    RAISE EXCEPTION 'Auction has ended for load %', p_load_id;
  END IF;

  IF v_load.shipper_company_id = p_transporter_company_id THEN
    RAISE EXCEPTION 'Shipper cannot bid on their own load';
  END IF;

  -- Determine which phase we are in
  v_in_blind_phase := (
    v_load.bid_start_time IS NOT NULL
    AND NOW() < v_load.bid_start_time
  );

  IF v_in_blind_phase THEN
    -- ── BLIND PHASE ─────────────────────────────────────────────────────────
    IF p_amount <= 0 THEN
      RAISE EXCEPTION 'Bid amount must be positive';
    END IF;

    IF p_amount >= v_load.opening_price THEN
      RAISE EXCEPTION 'Sealed bid must be lower than the opening price ₹%', v_load.opening_price;
    END IF;

    -- Try to update the transporter's existing active bid first
    UPDATE bids
       SET amount     = p_amount,
           eta_days   = p_eta_days,
           notes      = p_notes,
           bidder_id  = p_bidder_id,
           updated_at = NOW()
     WHERE load_id                = p_load_id
       AND transporter_company_id = p_transporter_company_id
       AND status                 = 'active'
    RETURNING * INTO v_new_bid;

    -- No existing bid → insert a fresh one
    IF NOT FOUND THEN
      INSERT INTO bids (load_id, transporter_company_id, bidder_id, amount, eta_days, notes, status)
        VALUES (p_load_id, p_transporter_company_id, p_bidder_id, p_amount, p_eta_days, p_notes, 'active')
      RETURNING * INTO v_new_bid;
    END IF;

  ELSE
    -- ── OPEN PHASE ──────────────────────────────────────────────────────────
    -- New bid must beat the current lowest by at least min_bid_decrement_inr
    SELECT COALESCE(MIN(amount), v_load.opening_price)
      INTO v_current_min
      FROM bids
     WHERE load_id = p_load_id AND status = 'active';

    SELECT value::NUMERIC INTO v_min_decrement_inr
      FROM platform_config WHERE key = 'min_bid_decrement_inr';

    IF p_amount > (v_current_min - v_min_decrement_inr) THEN
      RAISE EXCEPTION 'Bid amount ₹% must be at least ₹% less than current lowest bid ₹%',
        p_amount, v_min_decrement_inr, v_current_min;
    END IF;

    INSERT INTO bids (load_id, transporter_company_id, bidder_id, amount, eta_days, notes, status)
      VALUES (p_load_id, p_transporter_company_id, p_bidder_id, p_amount, p_eta_days, p_notes, 'active')
    RETURNING * INTO v_new_bid;

  END IF;

  RETURN v_new_bid;
END;
$$;
