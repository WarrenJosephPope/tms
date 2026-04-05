-- ============================================================
-- eParivahan — Supabase Edge Function triggers + Realtime config
-- Migration: 0003_functions_and_realtime.sql
-- ============================================================

-- ============================================================
-- ATOMIC BID VALIDATION FUNCTION
-- Called by the place_bid Edge Function (service role) to ensure
-- the new bid is lower than the current minimum without a race condition.
-- ============================================================

CREATE OR REPLACE FUNCTION place_bid_atomic(
  p_load_id             UUID,
  p_transporter_company_id UUID,
  p_bidder_id           UUID,
  p_amount              NUMERIC,
  p_eta_days            SMALLINT,
  p_notes               TEXT
)
RETURNS bids LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_load             loads%ROWTYPE;
  v_current_min      NUMERIC;
  v_new_bid          bids%ROWTYPE;
  v_min_decrement_inr NUMERIC;
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

  -- Transporter cannot bid on their own loads (edge case)
  IF v_load.shipper_company_id = p_transporter_company_id THEN
    RAISE EXCEPTION 'Shipper cannot bid on their own load';
  END IF;

  -- Get current minimum bid amount (or opening price if no bids yet)
  SELECT COALESCE(MIN(amount), v_load.opening_price)
    INTO v_current_min
    FROM bids
   WHERE load_id = p_load_id AND status = 'active';

  -- Get min decrement from platform config
  SELECT value::NUMERIC INTO v_min_decrement_inr
    FROM platform_config WHERE key = 'min_bid_decrement_inr';

  -- New bid must be strictly lower than current minimum by at least the decrement
  IF p_amount > (v_current_min - v_min_decrement_inr) THEN
    RAISE EXCEPTION 'Bid amount ₹% must be at least ₹% less than current lowest bid ₹%',
      p_amount, v_min_decrement_inr, v_current_min;
  END IF;

  -- Insert the new bid
  INSERT INTO bids (load_id, transporter_company_id, bidder_id, amount, eta_days, notes, status)
    VALUES (p_load_id, p_transporter_company_id, p_bidder_id, p_amount, p_eta_days, p_notes, 'active')
  RETURNING * INTO v_new_bid;

  RETURN v_new_bid;
END;
$$;

-- ============================================================
-- AWARD LOAD TO BID (called by accept_bid Edge Function)
-- ============================================================

CREATE OR REPLACE FUNCTION award_load_to_bid(
  p_load_id UUID,
  p_bid_id  UUID,
  p_shipper_user_id UUID
)
RETURNS trips LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_load   loads%ROWTYPE;
  v_bid    bids%ROWTYPE;
  v_trip   trips%ROWTYPE;
BEGIN
  SELECT * INTO v_load FROM loads WHERE id = p_load_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Load not found'; END IF;
  IF v_load.status NOT IN ('open', 'under_review') THEN
    RAISE EXCEPTION 'Load cannot be awarded in status: %', v_load.status;
  END IF;

  SELECT * INTO v_bid FROM bids WHERE id = p_bid_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;
  IF v_bid.load_id <> p_load_id THEN RAISE EXCEPTION 'Bid does not belong to this load'; END IF;
  IF v_bid.status <> 'active' THEN RAISE EXCEPTION 'Bid is not active'; END IF;

  -- Mark winning bid
  UPDATE bids SET status = 'won' WHERE id = p_bid_id;

  -- Mark all other bids as lost
  UPDATE bids SET status = 'lost'
   WHERE load_id = p_load_id AND id <> p_bid_id AND status = 'active';

  -- Update load: set awarded_bid_id and status
  UPDATE loads
     SET status = 'awarded',
         awarded_bid_id = p_bid_id
   WHERE id = p_load_id;

  -- Create trip record
  INSERT INTO trips (
    load_id, bid_id, shipper_company_id, transporter_company_id, agreed_amount, status
  ) VALUES (
    p_load_id, p_bid_id, v_load.shipper_company_id, v_bid.transporter_company_id, v_bid.amount, 'pending'
  ) RETURNING * INTO v_trip;

  RETURN v_trip;
END;
$$;

-- ============================================================
-- FUNCTION: get_latest_ping_per_active_trip
-- Used by the shipper's tracking overview
-- ============================================================

CREATE OR REPLACE FUNCTION get_latest_pings_for_company(p_company_id UUID)
RETURNS TABLE (
  trip_id       UUID,
  latitude      NUMERIC,
  longitude     NUMERIC,
  speed_kmph    NUMERIC,
  recorded_at   TIMESTAMPTZ,
  tracking_mode tracking_mode
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT ON (lp.trip_id)
    lp.trip_id, lp.latitude, lp.longitude, lp.speed_kmph, lp.recorded_at, lp.tracking_mode
  FROM location_pings lp
  JOIN trips t ON t.id = lp.trip_id
  WHERE
    (t.shipper_company_id = p_company_id OR t.transporter_company_id = p_company_id)
    AND t.status = 'in_transit'
  ORDER BY lp.trip_id, lp.recorded_at DESC;
$$;

-- ============================================================
-- ENABLE REALTIME on key tables
-- (broadcast changes to subscribed clients via Supabase Realtime)
-- ============================================================

-- Bids: transporters & shippers watch live bid updates per load_id
ALTER PUBLICATION supabase_realtime ADD TABLE bids;

-- Location pings: shippers watch live truck position
ALTER PUBLICATION supabase_realtime ADD TABLE location_pings;

-- Notifications: users watch their own notification feed
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Loads: transporters watch for status changes
ALTER PUBLICATION supabase_realtime ADD TABLE loads;

-- Messages: per-load chat
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
