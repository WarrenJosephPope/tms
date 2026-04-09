-- ============================================================
-- Company auction settings + load auto-extension support
-- Migration: 0011_company_auction_settings.sql
--
-- Changes:
--   1. company_auction_settings table (per-company defaults)
--   2. Extension tracking columns on loads
--   3. platform_config: add default_auction_minutes key
--   4. RLS for company_auction_settings
--   5. Replace place_bid_atomic with full version including auto-extension
-- ============================================================

-- ── 1. Company-level auction defaults ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_auction_settings (
  company_id                UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  -- Auction timing
  auction_duration_minutes  INTEGER NOT NULL DEFAULT 15 CHECK (auction_duration_minutes >= 1),
  -- Sealed/blind phase: 0 = no sealed phase (bids visible immediately)
  sealed_phase_minutes      INTEGER NOT NULL DEFAULT 0  CHECK (sealed_phase_minutes >= 0),
  -- Auto-extension: if a bid lands in the last X min, extend by Y min, up to Z times
  -- Set extension_max_count = 0 to disable auto-extension entirely
  extension_trigger_minutes INTEGER NOT NULL DEFAULT 3  CHECK (extension_trigger_minutes >= 0),
  extension_add_minutes     INTEGER NOT NULL DEFAULT 5  CHECK (extension_add_minutes >= 1),
  extension_max_count       INTEGER NOT NULL DEFAULT 3  CHECK (extension_max_count >= 0),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_company_auction_settings_updated_at
  BEFORE UPDATE ON public.company_auction_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. Extension tracking columns on loads ───────────────────────────────────
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS extension_trigger_minutes INTEGER,         -- NULL = no extension
  ADD COLUMN IF NOT EXISTS extension_add_minutes     INTEGER,
  ADD COLUMN IF NOT EXISTS extension_max_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extension_count           INTEGER NOT NULL DEFAULT 0;

-- ── 3. Platform config ────────────────────────────────────────────────────────
INSERT INTO platform_config (key, value, description)
VALUES ('default_auction_minutes', '15', 'Default auction duration in minutes')
ON CONFLICT (key) DO NOTHING;

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.company_auction_settings ENABLE ROW LEVEL SECURITY;

-- Any shipper in the company can read (ops managers also post loads)
CREATE POLICY "cas: shipper read own" ON public.company_auction_settings
  FOR SELECT USING (
    company_id = auth_company_id()
    AND auth_user_type() = 'shipper'
  );

-- Only account_owner may write
CREATE POLICY "cas: shipper owner write" ON public.company_auction_settings
  FOR ALL USING (
    company_id = auth_company_id()
    AND auth_user_type() = 'shipper'
    AND auth_shipper_role() = 'account_owner'
  );

CREATE POLICY "cas: admin all" ON public.company_auction_settings
  FOR ALL USING (auth_user_type() = 'admin');

-- ── 5. Replace place_bid_atomic with extension logic ─────────────────────────
--
-- Phases:
--   BLIND  (bid_start_time IS NOT NULL AND NOW() < bid_start_time):
--     • Upsert: one active bid per transporter, amount < opening_price.
--     • No cross-transporter ranking enforced.
--
--   OPEN   (bid_start_time IS NULL OR NOW() >= bid_start_time):
--     • New bid must beat lowest by at least min_bid_decrement_inr.
--     • After insert, check if auto-extension criteria are met and apply.
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
    -- New bid must beat current lowest by at least min_bid_decrement_inr
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

    -- ── Auto-extension ──────────────────────────────────────────────────────
    -- Extend if: extension is configured AND we still have extensions left
    -- AND the bid was placed within the trigger window before the current end time.
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
