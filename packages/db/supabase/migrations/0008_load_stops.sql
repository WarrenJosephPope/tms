-- ============================================================
-- eParivahan — Load Stops (multiple pickup / delivery points)
-- Migration: 0008_load_stops.sql
-- ============================================================

CREATE TABLE load_stops (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id     UUID        NOT NULL REFERENCES loads (id) ON DELETE CASCADE,
  stop_type   TEXT        NOT NULL CHECK (stop_type IN ('pickup', 'delivery')),
  stop_order  SMALLINT    NOT NULL DEFAULT 0,  -- 0-based order within same stop_type
  address     TEXT        NOT NULL,
  city        TEXT        NOT NULL,
  state       TEXT,
  pincode     TEXT,
  lat         NUMERIC(10, 7),
  lng         NUMERIC(10, 7),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_load_stops_load_id ON load_stops (load_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE load_stops ENABLE ROW LEVEL SECURITY;

-- Shippers: read their own company's stops
CREATE POLICY "load_stops: shipper read own" ON load_stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM loads l
      WHERE l.id = load_stops.load_id
        AND l.shipper_company_id = auth_company_id()
    )
  );

-- Shippers: insert stops for their own loads (account_owner / operations_manager only)
CREATE POLICY "load_stops: shipper insert" ON load_stops
  FOR INSERT WITH CHECK (
    auth_user_type() = 'shipper'
    AND auth_shipper_role() IN ('account_owner', 'operations_manager')
    AND EXISTS (
      SELECT 1 FROM loads l
      WHERE l.id = load_stops.load_id
        AND l.shipper_company_id = auth_company_id()
    )
  );

-- Shippers: update stops for their own loads
CREATE POLICY "load_stops: shipper update" ON load_stops
  FOR UPDATE USING (
    auth_user_type() = 'shipper'
    AND auth_shipper_role() IN ('account_owner', 'operations_manager')
    AND EXISTS (
      SELECT 1 FROM loads l
      WHERE l.id = load_stops.load_id
        AND l.shipper_company_id = auth_company_id()
    )
  );

-- Shippers: delete stops for their own loads
CREATE POLICY "load_stops: shipper delete" ON load_stops
  FOR DELETE USING (
    auth_user_type() = 'shipper'
    AND auth_shipper_role() IN ('account_owner', 'operations_manager')
    AND EXISTS (
      SELECT 1 FROM loads l
      WHERE l.id = load_stops.load_id
        AND l.shipper_company_id = auth_company_id()
    )
  );

-- Transporters: read stops for open loads (marketplace) or loads they have active bids on
CREATE POLICY "load_stops: transporter read" ON load_stops
  FOR SELECT USING (
    auth_user_type() = 'transporter'
    AND EXISTS (
      SELECT 1 FROM loads l
      WHERE l.id = load_stops.load_id
        AND (
          l.status = 'open'
          OR EXISTS (
            SELECT 1 FROM bids b
            WHERE b.load_id = l.id
              AND b.transporter_company_id = auth_company_id()
              AND b.status NOT IN ('withdrawn', 'lost')
          )
        )
    )
  );

-- Drivers: read stops for their assigned trips
CREATE POLICY "load_stops: driver read" ON load_stops
  FOR SELECT USING (
    auth_user_type() = 'transporter'
    AND EXISTS (
      SELECT 1 FROM loads l
      JOIN trips t ON t.load_id = l.id
      JOIN drivers d ON d.id = t.driver_id AND d.user_profile_id = auth.uid()
      WHERE l.id = load_stops.load_id
    )
  );

-- Admins: full access
CREATE POLICY "load_stops: admin all" ON load_stops
  FOR ALL USING (auth_user_type() = 'admin');
