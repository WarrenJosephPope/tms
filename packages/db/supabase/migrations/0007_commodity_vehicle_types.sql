-- ============================================================
-- Tracking Management System — Commodity Types & Vehicle Type Refs
-- Migration: 0007_commodity_vehicle_types.sql
--
-- Replaces hard-coded enums/arrays in the UI with DB-managed
-- lookup tables. Admin creates/activates types globally; per-company
-- allotment tables control which types each company can use.
-- Default behaviour: if a company has NO allotments, it sees all
-- active types (allow-all default).
-- ============================================================

-- ============================================================
-- CLEANUP (idempotent re-run guard)
-- ============================================================
DROP TABLE IF EXISTS company_vehicle_types;
DROP TABLE IF EXISTS company_commodity_types;
DROP TABLE IF EXISTS vehicle_type_refs;
DROP TABLE IF EXISTS commodity_types;

-- ============================================================
-- COMMODITY TYPES  (admin-managed master list)
-- ============================================================
CREATE TABLE commodity_types (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT        NOT NULL UNIQUE,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_commodity_types_updated_at
  BEFORE UPDATE ON commodity_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- VEHICLE TYPE REFS
-- Keys must match the existing vehicle_type enum so that
-- loads.vehicle_type_req (still an enum column) stays valid.
-- Admins can update labels or toggle active; they cannot add new
-- keys without a corresponding enum migration.
-- ============================================================
CREATE TABLE vehicle_type_refs (
  key        TEXT        PRIMARY KEY,  -- matches vehicle_type enum value
  label      TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_vehicle_type_refs_updated_at
  BEFORE UPDATE ON vehicle_type_refs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed from existing enum
INSERT INTO vehicle_type_refs (key, label) VALUES
  ('open_trailer',     'Open Trailer'),
  ('closed_container', 'Closed Container'),
  ('flatbed',          'Flatbed'),
  ('tanker',           'Tanker'),
  ('refrigerated',     'Refrigerated'),
  ('mini_truck',       'Mini Truck'),
  ('pickup',           'Pickup');

-- ============================================================
-- PER-COMPANY ALLOTMENTS
-- When the junction table has NO rows for a company, the API
-- falls back to returning all active types (allow-all default).
-- ============================================================
CREATE TABLE company_commodity_types (
  company_id        UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  commodity_type_id UUID NOT NULL REFERENCES commodity_types (id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, commodity_type_id)
);

CREATE INDEX idx_cct_company_id ON company_commodity_types (company_id);

CREATE TABLE company_vehicle_types (
  company_id       UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  vehicle_type_key TEXT NOT NULL REFERENCES vehicle_type_refs (key) ON DELETE CASCADE,
  PRIMARY KEY (company_id, vehicle_type_key)
);

CREATE INDEX idx_cvt_company_id ON company_vehicle_types (company_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE commodity_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_type_refs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_commodity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_vehicle_types   ENABLE ROW LEVEL SECURITY;

-- commodity_types: any authenticated user can read active entries;
-- only admins can mutate.
CREATE POLICY "commodity_types: authenticated read active"
  ON commodity_types FOR SELECT
  USING (is_active = TRUE OR auth_user_type() = 'admin');

CREATE POLICY "commodity_types: admin all"
  ON commodity_types FOR ALL
  USING (auth_user_type() = 'admin')
  WITH CHECK (auth_user_type() = 'admin');

-- vehicle_type_refs: same pattern
CREATE POLICY "vehicle_type_refs: authenticated read active"
  ON vehicle_type_refs FOR SELECT
  USING (is_active = TRUE OR auth_user_type() = 'admin');

CREATE POLICY "vehicle_type_refs: admin all"
  ON vehicle_type_refs FOR ALL
  USING (auth_user_type() = 'admin')
  WITH CHECK (auth_user_type() = 'admin');

-- company_commodity_types: companies can read their own allotments;
-- admins can read and write all.
CREATE POLICY "company_commodity_types: own company read"
  ON company_commodity_types FOR SELECT
  USING (company_id = auth_company_id() OR auth_user_type() = 'admin');

CREATE POLICY "company_commodity_types: admin all"
  ON company_commodity_types FOR ALL
  USING (auth_user_type() = 'admin')
  WITH CHECK (auth_user_type() = 'admin');

-- company_vehicle_types: same as above
CREATE POLICY "company_vehicle_types: own company read"
  ON company_vehicle_types FOR SELECT
  USING (company_id = auth_company_id() OR auth_user_type() = 'admin');

CREATE POLICY "company_vehicle_types: admin all"
  ON company_vehicle_types FOR ALL
  USING (auth_user_type() = 'admin')
  WITH CHECK (auth_user_type() = 'admin');
