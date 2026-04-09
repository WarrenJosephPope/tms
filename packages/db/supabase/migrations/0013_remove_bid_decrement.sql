-- ============================================================
-- Remove minimum bid decrement restriction
--
-- Previously, a bid in the open phase had to be at least
-- min_bid_decrement_inr (₹100) lower than the current lowest bid.
-- This migration drops that check so any amount below the current
-- lowest (or below the opening price if no bids exist yet) is valid.
-- ============================================================

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
  v_load           loads%ROWTYPE;
  v_current_min    NUMERIC;
  v_new_bid        bids%ROWTYPE;
  v_in_blind_phase BOOLEAN;
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

  -- Determine phase
  v_in_blind_phase := (
    v_load.bid_start_time IS NOT NULL
    AND NOW() < v_load.bid_start_time
  );

  IF v_in_blind_phase THEN
    -- ── BLIND PHASE ────────────────────────────────────────────────────────
    IF p_amount <= 0 THEN
      RAISE EXCEPTION 'Bid amount must be positive';
    END IF;
    IF p_amount >= v_load.opening_price THEN
      RAISE EXCEPTION 'Sealed bid must be lower than the opening price ₹%', v_load.opening_price;
    END IF;

    -- Upsert: update existing active bid or insert new one
    UPDATE bids
       SET amount    = p_amount,
           eta_days  = p_eta_days,
           notes     = p_notes,
           bidder_id = p_bidder_id,
           updated_at = NOW()
     WHERE load_id                = p_load_id
       AND transporter_company_id = p_transporter_company_id
       AND status                 = 'active'
    RETURNING * INTO v_new_bid;

    IF NOT FOUND THEN
      INSERT INTO bids (load_id, transporter_company_id, bidder_id, amount, eta_days, notes, status)
        VALUES (p_load_id, p_transporter_company_id, p_bidder_id, p_amount, p_eta_days, p_notes, 'active')
      RETURNING * INTO v_new_bid;
    END IF;

  ELSE
    -- ── OPEN PHASE ─────────────────────────────────────────────────────────
    -- Bid must simply be lower than the current lowest (or opening price if no bids yet).
    -- No minimum decrement is required.
    SELECT COALESCE(MIN(amount), v_load.opening_price)
      INTO v_current_min
      FROM bids
     WHERE load_id = p_load_id AND status = 'active';

    IF p_amount >= v_current_min THEN
      RAISE EXCEPTION 'Bid amount ₹% must be lower than the current lowest bid ₹%',
        p_amount, v_current_min;
    END IF;

    INSERT INTO bids (load_id, transporter_company_id, bidder_id, amount, eta_days, notes, status)
      VALUES (p_load_id, p_transporter_company_id, p_bidder_id, p_amount, p_eta_days, p_notes, 'active')
    RETURNING * INTO v_new_bid;

    -- ── Auto-extension ──────────────────────────────────────────────────────
    IF v_load.extension_trigger_minutes IS NOT NULL
       AND v_load.extension_trigger_minutes > 0
       AND v_load.extension_max_count > 0
       AND v_load.extension_count < v_load.extension_max_count
       AND NOW() > (v_load.auction_end_time - (v_load.extension_trigger_minutes * INTERVAL '1 minute'))
    THEN
      UPDATE loads
         SET auction_end_time = auction_end_time + (v_load.extension_add_minutes * INTERVAL '1 minute'),
             extension_count  = extension_count + 1
       WHERE id = p_load_id;
    END IF;

  END IF;

  RETURN v_new_bid;
END;
$$;
