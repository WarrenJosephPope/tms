-- ============================================================
-- Tracking Management System — Development Seed Data
-- seed.sql (run after migration for local development)
-- ============================================================

-- ============================================================
-- COMPANIES
-- ============================================================

INSERT INTO companies (id, name, user_type, gstin, phone, email, city, state, pincode, kyc_status, is_active)
VALUES
  -- Shippers
  ('11000000-0000-0000-0000-000000000001', 'Bharat Foods Pvt Ltd',       'shipper',     '27AABCF1234A1Z5', '+919876540001', 'logistics@bharatfoods.in',  'Mumbai',    'Maharashtra', '400001', 'approved', TRUE),
  ('11000000-0000-0000-0000-000000000002', 'Sunrise Pharma Ltd',         'shipper',     '29AADCS5678B1Z2', '+919876540002', 'supply@sunrisepharma.in',   'Bangalore', 'Karnataka',   '560001', 'approved', TRUE),
  -- Transporters
  ('22000000-0000-0000-0000-000000000001', 'Rajdhani Carriers Pvt Ltd',  'transporter', '06AABCR4321C1Z9', '+919876541001', 'ops@rajdhanicarriers.in',   'Delhi',     'Delhi',       '110001', 'approved', TRUE),
  ('22000000-0000-0000-0000-000000000002', 'Krishna Transport Co',       'transporter', '27AABCK8765D1Z3', '+919876541002', 'info@krishnatransport.in',  'Pune',      'Maharashtra', '411001', 'approved', TRUE),
  -- Admin
  ('33000000-0000-0000-0000-000000000001', 'Tracking Management System',        'admin',       NULL,              '+919876542001', 'admin@tracking_management_system.in',        'Mumbai',    'Maharashtra', '400001', 'approved', TRUE);

-- ============================================================
-- VEHICLES
-- ============================================================

INSERT INTO vehicles (id, company_id, registration_no, vehicle_type, make, model, year, capacity_tonnes)
VALUES
  (uuid_generate_v4(), '22000000-0000-0000-0000-000000000001', 'DL01CA1234', 'closed_container', 'Tata',  'LPT 1412',  2022, 14.00),
  (uuid_generate_v4(), '22000000-0000-0000-0000-000000000001', 'DL01CB5678', 'open_trailer',     'Ashok Leyland', '2518', 2021, 25.00),
  (uuid_generate_v4(), '22000000-0000-0000-0000-000000000002', 'MH12DE9012', 'closed_container', 'Eicher', 'Pro 6025',  2023, 18.00),
  (uuid_generate_v4(), '22000000-0000-0000-0000-000000000002', 'MH12DF3456', 'flatbed',          'Tata',   'LPK 2518',  2020, 22.00);

-- ============================================================
-- PLATFORM CONFIG (already seeded in migration, but ensure values)
-- ============================================================

INSERT INTO platform_config (key, value, description)
VALUES
  ('min_bid_decrement_inr',    '100',  'Minimum absolute bid decrement in INR'),
  ('min_bid_decrement_pct',    '0.5',  'Minimum percentage bid decrement'),
  ('platform_fee_pct',         '1.0',  'Platform fee percentage on load value'),
  ('default_auction_hours',    '24',   'Default auction duration in hours'),
  ('location_ping_interval_s', '45',   'Driver app location ping interval in seconds')
ON CONFLICT (key) DO NOTHING;
