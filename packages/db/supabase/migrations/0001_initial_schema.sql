-- ============================================================
-- eParivahan — Initial Schema
-- Migration: 0001_initial_schema.sql
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- for geospatial queries on location pings

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_type AS ENUM ('shipper', 'transporter', 'admin');

CREATE TYPE shipper_role AS ENUM ('account_owner', 'operations_manager', 'viewer');

CREATE TYPE transporter_role AS ENUM ('account_owner', 'fleet_manager', 'driver');

CREATE TYPE admin_role AS ENUM ('super_admin', 'support_agent', 'finance_manager');

CREATE TYPE load_status AS ENUM (
  'draft',
  'open',           -- accepting bids
  'under_review',   -- shipper is reviewing bids
  'awarded',        -- bid accepted, pending assignment
  'assigned',       -- vehicle & driver assigned
  'in_transit',
  'delivered',
  'cancelled',
  'expired'
);

CREATE TYPE bid_status AS ENUM (
  'active',
  'withdrawn',
  'won',
  'lost',
  'countered'
);

CREATE TYPE vehicle_type AS ENUM (
  'open_trailer',
  'closed_container',
  'flatbed',
  'tanker',
  'refrigerated',
  'mini_truck',
  'pickup'
);

CREATE TYPE load_type AS ENUM ('FTL', 'LTL');

CREATE TYPE trip_status AS ENUM (
  'pending',
  'in_transit',
  'completed',
  'cancelled'
);

CREATE TYPE tracking_mode AS ENUM ('GPS_APP', 'NETWORK_APP', 'GPS_DEVICE');

CREATE TYPE document_type AS ENUM (
  'vehicle_rc',
  'vehicle_permit',
  'vehicle_insurance',
  'vehicle_fitness',
  'vehicle_puc',
  'driver_license',
  'driver_aadhaar',
  'driver_pan',
  'company_gst',
  'company_pan'
);

CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE notification_channel AS ENUM ('in_app', 'sms', 'push', 'whatsapp');

-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE companies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  user_type     user_type NOT NULL,
  gstin         TEXT,
  pan           TEXT,
  phone         TEXT NOT NULL,
  email         TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city          TEXT,
  state         TEXT,
  pincode       TEXT,
  kyc_status    kyc_status NOT NULL DEFAULT 'pending',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_user_type ON companies (user_type);
CREATE INDEX idx_companies_kyc_status ON companies (kyc_status);

-- ============================================================
-- USER PROFILES
-- (extends Supabase auth.users)
-- ============================================================

CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT,
  user_type     user_type NOT NULL,
  shipper_role  shipper_role,
  transporter_role transporter_role,
  admin_role    admin_role,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- exactly one role column must be set depending on user_type
  CONSTRAINT chk_roles CHECK (
    (user_type = 'shipper'     AND shipper_role     IS NOT NULL AND transporter_role IS NULL AND admin_role IS NULL) OR
    (user_type = 'transporter' AND transporter_role IS NOT NULL AND shipper_role     IS NULL AND admin_role IS NULL) OR
    (user_type = 'admin'       AND admin_role       IS NOT NULL AND shipper_role     IS NULL AND transporter_role IS NULL)
  )
);

CREATE INDEX idx_user_profiles_company_id ON user_profiles (company_id);
CREATE INDEX idx_user_profiles_user_type ON user_profiles (user_type);

-- ============================================================
-- DOCUMENTS (KYC, vehicle, driver docs)
-- ============================================================

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  entity_id       UUID,                  -- vehicle_id or driver_id or company_id
  entity_type     TEXT,                  -- 'vehicle' | 'driver' | 'company'
  document_type   document_type NOT NULL,
  file_url        TEXT NOT NULL,         -- Supabase Storage URL
  file_name       TEXT,
  issuing_authority TEXT,
  document_number TEXT,
  issue_date      DATE,
  expiry_date     DATE,
  kyc_status      kyc_status NOT NULL DEFAULT 'pending',
  reviewer_id     UUID REFERENCES user_profiles (id),
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_company_id ON documents (company_id);
CREATE INDEX idx_documents_entity_id ON documents (entity_id);
CREATE INDEX idx_documents_expiry_date ON documents (expiry_date);
CREATE INDEX idx_documents_kyc_status ON documents (kyc_status);

-- ============================================================
-- VEHICLES
-- ============================================================

CREATE TABLE vehicles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  registration_no TEXT NOT NULL,
  vehicle_type    vehicle_type NOT NULL,
  make            TEXT,
  model           TEXT,
  year            INTEGER,
  capacity_tonnes NUMERIC(6,2),
  capacity_cubic_ft NUMERIC(8,2),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_vehicles_reg_no ON vehicles (registration_no);
CREATE INDEX idx_vehicles_company_id ON vehicles (company_id);

-- ============================================================
-- DRIVERS
-- (drivers are Supabase auth users with transporter_role = 'driver'
--  but we keep a separate denormalised table for trip assignment lookups)
-- ============================================================

CREATE TABLE drivers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_profile_id UUID REFERENCES user_profiles (id) ON DELETE SET NULL,
  company_id      UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL,
  license_no      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drivers_company_id ON drivers (company_id);
CREATE INDEX idx_drivers_phone ON drivers (phone);

-- ============================================================
-- LOADS (freight postings)
-- ============================================================

CREATE TABLE loads (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipper_company_id  UUID NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  posted_by           UUID NOT NULL REFERENCES user_profiles (id),
  load_type           load_type NOT NULL DEFAULT 'FTL',
  commodity           TEXT NOT NULL,
  weight_tonnes       NUMERIC(8,3),
  volume_cubic_ft     NUMERIC(10,2),
  vehicle_type_req    vehicle_type NOT NULL,
  -- origin
  origin_address      TEXT NOT NULL,
  origin_city         TEXT NOT NULL,
  origin_state        TEXT NOT NULL,
  origin_pincode      TEXT,
  origin_lat          NUMERIC(10,7),
  origin_lng          NUMERIC(10,7),
  -- destination
  dest_address        TEXT NOT NULL,
  dest_city           TEXT NOT NULL,
  dest_state          TEXT NOT NULL,
  dest_pincode        TEXT,
  dest_lat            NUMERIC(10,7),
  dest_lng            NUMERIC(10,7),
  -- timing
  pickup_date         DATE NOT NULL,
  pickup_window_start TIME,
  pickup_window_end   TIME,
  -- auction
  opening_price       NUMERIC(12,2) NOT NULL,         -- budget ceiling visible to bidders
  reserve_price       NUMERIC(12,2),                  -- hidden minimum shipper will accept
  min_decrement       NUMERIC(10,2) NOT NULL DEFAULT 100,
  auction_end_time    TIMESTAMPTZ NOT NULL,
  auto_accept_lowest  BOOLEAN NOT NULL DEFAULT FALSE,
  -- state
  status              load_status NOT NULL DEFAULT 'draft',
  awarded_bid_id      UUID,                            -- FK added after bids table
  notes               TEXT,
  special_instructions TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loads_shipper_company_id ON loads (shipper_company_id);
CREATE INDEX idx_loads_status ON loads (status);
CREATE INDEX idx_loads_auction_end_time ON loads (auction_end_time);
CREATE INDEX idx_loads_vehicle_type_req ON loads (vehicle_type_req);
CREATE INDEX idx_loads_pickup_date ON loads (pickup_date);
CREATE INDEX idx_loads_origin_city ON loads (origin_city);
CREATE INDEX idx_loads_dest_city ON loads (dest_city);

-- ============================================================
-- BIDS
-- ============================================================

CREATE TABLE bids (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id             UUID NOT NULL REFERENCES loads (id) ON DELETE CASCADE,
  transporter_company_id UUID NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  bidder_id           UUID NOT NULL REFERENCES user_profiles (id),
  amount              NUMERIC(12,2) NOT NULL,
  eta_days            SMALLINT,               -- estimated transit days
  notes               TEXT,
  status              bid_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bids_load_id ON bids (load_id);
CREATE INDEX idx_bids_transporter_company_id ON bids (transporter_company_id);
CREATE INDEX idx_bids_status ON bids (status);
CREATE INDEX idx_bids_amount ON bids (load_id, amount ASC);  -- for lowest bid lookup

-- Back-ref FK from loads → bids
ALTER TABLE loads
  ADD CONSTRAINT fk_loads_awarded_bid
  FOREIGN KEY (awarded_bid_id) REFERENCES bids (id);

-- ============================================================
-- TRIPS
-- ============================================================

CREATE TABLE trips (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id                 UUID NOT NULL REFERENCES loads (id) ON DELETE RESTRICT,
  bid_id                  UUID NOT NULL REFERENCES bids (id) ON DELETE RESTRICT,
  shipper_company_id      UUID NOT NULL REFERENCES companies (id),
  transporter_company_id  UUID NOT NULL REFERENCES companies (id),
  vehicle_id              UUID REFERENCES vehicles (id),
  driver_id               UUID REFERENCES drivers (id),
  tracking_mode           tracking_mode NOT NULL DEFAULT 'GPS_APP',
  status                  trip_status NOT NULL DEFAULT 'pending',
  -- timestamps
  scheduled_pickup_at     TIMESTAMPTZ,
  actual_pickup_at        TIMESTAMPTZ,
  estimated_delivery_at   TIMESTAMPTZ,
  actual_delivery_at      TIMESTAMPTZ,
  -- pickup proof
  pickup_photo_urls       TEXT[],
  pickup_confirmed_by     UUID REFERENCES user_profiles (id),
  -- delivery proof (ePOD)
  epod_photo_urls         TEXT[],
  epod_signature_url      TEXT,
  epod_confirmed_by       UUID REFERENCES user_profiles (id),
  epod_notes              TEXT,
  -- financials
  agreed_amount           NUMERIC(12,2) NOT NULL,
  platform_fee            NUMERIC(10,2) DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trips_load_id ON trips (load_id);
CREATE INDEX idx_trips_shipper_company_id ON trips (shipper_company_id);
CREATE INDEX idx_trips_transporter_company_id ON trips (transporter_company_id);
CREATE INDEX idx_trips_driver_id ON trips (driver_id);
CREATE INDEX idx_trips_status ON trips (status);

-- ============================================================
-- LOCATION PINGS
-- (all tracking modes write here)
-- ============================================================

CREATE TABLE location_pings (
  id            BIGSERIAL PRIMARY KEY,
  trip_id       UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  driver_id     UUID REFERENCES drivers (id),
  tracking_mode tracking_mode NOT NULL DEFAULT 'GPS_APP',
  latitude      NUMERIC(10,7) NOT NULL,
  longitude     NUMERIC(10,7) NOT NULL,
  speed_kmph    NUMERIC(6,2),
  accuracy_m    NUMERIC(8,2),
  heading_deg   NUMERIC(5,2),
  altitude_m    NUMERIC(8,2),
  is_moving     BOOLEAN,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index: only keep last 30 days in hot index for active trips
CREATE INDEX idx_location_pings_trip_id ON location_pings (trip_id, recorded_at DESC);
CREATE INDEX idx_location_pings_recent ON location_pings (recorded_at DESC)
  WHERE recorded_at > NOW() - INTERVAL '30 days';

-- ============================================================
-- GEOFENCE EVENTS
-- ============================================================

CREATE TABLE geofence_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id     UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,   -- 'pickup_arrival' | 'pickup_departure' | 'delivery_arrival' | 'deviation' | 'stoppage'
  latitude    NUMERIC(10,7),
  longitude   NUMERIC(10,7),
  notes       TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geofence_events_trip_id ON geofence_events (trip_id);

-- ============================================================
-- IN-APP CHAT (per load)
-- ============================================================

CREATE TABLE messages (
  id          BIGSERIAL PRIMARY KEY,
  load_id     UUID NOT NULL REFERENCES loads (id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES user_profiles (id),
  body        TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_load_id ON messages (load_id, sent_at ASC);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES user_profiles (id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  channel     notification_channel NOT NULL DEFAULT 'in_app',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB,             -- e.g. { load_id, trip_id, bid_id }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id, is_read, created_at DESC);

-- ============================================================
-- PLATFORM CONFIG (admin-managed settings)
-- ============================================================

CREATE TABLE platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES user_profiles (id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default config values
INSERT INTO platform_config (key, value, description) VALUES
  ('min_bid_decrement_inr',    '100',  'Minimum absolute bid decrement in INR'),
  ('min_bid_decrement_pct',    '0.5',  'Minimum percentage bid decrement'),
  ('platform_fee_pct',         '1.0',  'Platform fee percentage on load value (Growth+ plans)'),
  ('default_auction_hours',    '24',   'Default auction duration in hours'),
  ('location_ping_interval_s', '45',   'Driver app location ping interval in seconds');

-- ============================================================
-- UPDATED_AT TRIGGER (reusable)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_updated_at          BEFORE UPDATE ON companies          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_profiles_updated_at      BEFORE UPDATE ON user_profiles      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicles_updated_at           BEFORE UPDATE ON vehicles           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_drivers_updated_at            BEFORE UPDATE ON drivers            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_loads_updated_at              BEFORE UPDATE ON loads              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bids_updated_at               BEFORE UPDATE ON bids               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_trips_updated_at              BEFORE UPDATE ON trips              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_documents_updated_at          BEFORE UPDATE ON documents          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
