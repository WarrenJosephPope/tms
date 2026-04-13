-- ============================================================
-- Tracking Management System — Row Level Security Policies
-- Migration: 0002_rls_policies.sql
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE loads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids               ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips              ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_pings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_config    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- (called inside policies; SECURITY DEFINER avoids recursion)
-- ============================================================

-- Returns the company_id of the calling auth user
CREATE OR REPLACE FUNCTION auth_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid()
$$;

-- Returns the user_type of the calling auth user
CREATE OR REPLACE FUNCTION auth_user_type()
RETURNS user_type LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT user_type FROM user_profiles WHERE id = auth.uid()
$$;

-- Returns the admin_role of the calling auth user (NULL if not admin)
CREATE OR REPLACE FUNCTION auth_admin_role()
RETURNS admin_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT admin_role FROM user_profiles WHERE id = auth.uid()
$$;

-- Returns the transporter_role of the calling auth user
CREATE OR REPLACE FUNCTION auth_transporter_role()
RETURNS transporter_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT transporter_role FROM user_profiles WHERE id = auth.uid()
$$;

-- Returns the shipper_role of the calling auth user
CREATE OR REPLACE FUNCTION auth_shipper_role()
RETURNS shipper_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT shipper_role FROM user_profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- COMPANIES
-- ============================================================

-- Users can read their own company
CREATE POLICY "companies: read own" ON companies
  FOR SELECT USING (id = auth_company_id());

-- Admins can read all companies
CREATE POLICY "companies: admin read all" ON companies
  FOR SELECT USING (auth_user_type() = 'admin');

-- Admins can update companies (KYC approval, activation)
CREATE POLICY "companies: admin update" ON companies
  FOR UPDATE USING (auth_user_type() = 'admin');

-- Account owners can update their own company profile
CREATE POLICY "companies: owner update own" ON companies
  FOR UPDATE USING (
    id = auth_company_id()
    AND (
      (auth_user_type() = 'shipper'     AND auth_shipper_role()     = 'account_owner') OR
      (auth_user_type() = 'transporter' AND auth_transporter_role() = 'account_owner')
    )
  );

-- Insert: handled by Edge Function during signup (service role), but allow here for admin creation
CREATE POLICY "companies: admin insert" ON companies
  FOR INSERT WITH CHECK (auth_user_type() = 'admin');

-- ============================================================
-- USER PROFILES
-- ============================================================

-- Users can read profiles in their own company
CREATE POLICY "user_profiles: read own company" ON user_profiles
  FOR SELECT USING (company_id = auth_company_id());

-- Users can read their own profile
CREATE POLICY "user_profiles: read own" ON user_profiles
  FOR SELECT USING (id = auth.uid());

-- Admins can read all user profiles
CREATE POLICY "user_profiles: admin read all" ON user_profiles
  FOR SELECT USING (auth_user_type() = 'admin');

-- Users can update their own profile (name, avatar)
CREATE POLICY "user_profiles: update own" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Account owners can update users in their company
CREATE POLICY "user_profiles: owner update team" ON user_profiles
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND (
      (auth_user_type() = 'shipper'     AND auth_shipper_role()     = 'account_owner') OR
      (auth_user_type() = 'transporter' AND auth_transporter_role() = 'account_owner')
    )
  );

-- Admins can update any user profile
CREATE POLICY "user_profiles: admin update" ON user_profiles
  FOR UPDATE USING (auth_user_type() = 'admin');

-- ============================================================
-- DOCUMENTS
-- ============================================================

-- Companies can read their own documents
CREATE POLICY "documents: read own company" ON documents
  FOR SELECT USING (company_id = auth_company_id());

-- Companies can insert documents for themselves
CREATE POLICY "documents: insert own company" ON documents
  FOR INSERT WITH CHECK (company_id = auth_company_id());

-- Admins can read all documents
CREATE POLICY "documents: admin read all" ON documents
  FOR SELECT USING (auth_user_type() = 'admin');

-- Admins can update documents (review/approve)
CREATE POLICY "documents: admin update" ON documents
  FOR UPDATE USING (auth_user_type() = 'admin');

-- ============================================================
-- VEHICLES
-- ============================================================

-- Transporters can read/write their own company vehicles
CREATE POLICY "vehicles: transporter company" ON vehicles
  FOR ALL USING (
    company_id = auth_company_id()
    AND auth_user_type() = 'transporter'
  );

-- Admins can read all vehicles
CREATE POLICY "vehicles: admin read all" ON vehicles
  FOR SELECT USING (auth_user_type() = 'admin');

-- ============================================================
-- DRIVERS
-- ============================================================

-- Transporters can read/write their own company drivers
CREATE POLICY "drivers: transporter company" ON drivers
  FOR ALL USING (
    company_id = auth_company_id()
    AND auth_user_type() = 'transporter'
  );

-- Admins can read all drivers
CREATE POLICY "drivers: admin read all" ON drivers
  FOR SELECT USING (auth_user_type() = 'admin');

-- ============================================================
-- LOADS
-- ============================================================

-- Shippers can read/write their own company's loads
CREATE POLICY "loads: shipper read own" ON loads
  FOR SELECT USING (shipper_company_id = auth_company_id());

-- Shippers: only account_owner and operations_manager can post/edit loads
CREATE POLICY "loads: shipper insert" ON loads
  FOR INSERT WITH CHECK (
    shipper_company_id = auth_company_id()
    AND auth_user_type() = 'shipper'
    AND auth_shipper_role() IN ('account_owner', 'operations_manager')
  );

CREATE POLICY "loads: shipper update" ON loads
  FOR UPDATE USING (
    shipper_company_id = auth_company_id()
    AND auth_user_type() = 'shipper'
    AND auth_shipper_role() IN ('account_owner', 'operations_manager')
  );

-- Transporters can read all OPEN loads (the marketplace)
CREATE POLICY "loads: transporter read open" ON loads
  FOR SELECT USING (
    auth_user_type() = 'transporter'
    AND status IN ('open', 'under_review')
  );

-- Transporters can read loads they have an active bid on
CREATE POLICY "loads: transporter read bid loads" ON loads
  FOR SELECT USING (
    auth_user_type() = 'transporter'
    AND EXISTS (
      SELECT 1 FROM bids
      WHERE bids.load_id = loads.id
        AND bids.transporter_company_id = auth_company_id()
    )
  );

-- Admins can read/update all loads
CREATE POLICY "loads: admin all" ON loads
  FOR ALL USING (auth_user_type() = 'admin');

-- ============================================================
-- BIDS
-- ============================================================

-- Transporters can read their own company's bids
CREATE POLICY "bids: transporter read own" ON bids
  FOR SELECT USING (transporter_company_id = auth_company_id());

-- Transporters (fleet_manager or account_owner) can insert bids
CREATE POLICY "bids: transporter insert" ON bids
  FOR INSERT WITH CHECK (
    transporter_company_id = auth_company_id()
    AND auth_user_type() = 'transporter'
    AND auth_transporter_role() IN ('account_owner', 'fleet_manager')
  );

-- Transporters can update/withdraw their own bids
CREATE POLICY "bids: transporter update own" ON bids
  FOR UPDATE USING (
    transporter_company_id = auth_company_id()
    AND auth_user_type() = 'transporter'
  );

-- Shippers can read all bids on their own loads
CREATE POLICY "bids: shipper read own loads" ON bids
  FOR SELECT USING (
    auth_user_type() = 'shipper'
    AND EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = bids.load_id
        AND loads.shipper_company_id = auth_company_id()
    )
  );

-- Admins can read all bids
CREATE POLICY "bids: admin read all" ON bids
  FOR SELECT USING (auth_user_type() = 'admin');

-- ============================================================
-- TRIPS
-- ============================================================

-- Shippers can read trips belonging to their company
CREATE POLICY "trips: shipper read own" ON trips
  FOR SELECT USING (shipper_company_id = auth_company_id());

-- Transporters can read trips belonging to their company
CREATE POLICY "trips: transporter read own" ON trips
  FOR SELECT USING (transporter_company_id = auth_company_id());

-- Drivers can read their own assigned trips
CREATE POLICY "trips: driver read assigned" ON trips
  FOR SELECT USING (
    auth_user_type() = 'transporter'
    AND auth_transporter_role() = 'driver'
    AND driver_id IN (
      SELECT id FROM drivers WHERE user_profile_id = auth.uid()
    )
  );

-- Transporters (account_owner / fleet_manager) can update trips (assign vehicle/driver)
CREATE POLICY "trips: transporter update own" ON trips
  FOR UPDATE USING (
    transporter_company_id = auth_company_id()
    AND auth_user_type() = 'transporter'
    AND auth_transporter_role() IN ('account_owner', 'fleet_manager')
  );

-- Admins can read/update all trips
CREATE POLICY "trips: admin all" ON trips
  FOR ALL USING (auth_user_type() = 'admin');

-- ============================================================
-- LOCATION PINGS
-- ============================================================

-- Shippers can read pings for their trips
CREATE POLICY "location_pings: shipper read" ON location_pings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = location_pings.trip_id
        AND trips.shipper_company_id = auth_company_id()
    )
  );

-- Transporters can read pings for their trips
CREATE POLICY "location_pings: transporter read" ON location_pings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = location_pings.trip_id
        AND trips.transporter_company_id = auth_company_id()
    )
  );

-- Drivers can insert pings for their trip (via Edge Function with service role in prod)
CREATE POLICY "location_pings: driver insert" ON location_pings
  FOR INSERT WITH CHECK (
    auth_user_type() = 'transporter'
    AND auth_transporter_role() = 'driver'
    AND EXISTS (
      SELECT 1 FROM trips t
      JOIN drivers d ON d.id = t.driver_id
      WHERE t.id = location_pings.trip_id
        AND d.user_profile_id = auth.uid()
    )
  );

-- Admins can read all
CREATE POLICY "location_pings: admin read all" ON location_pings
  FOR SELECT USING (auth_user_type() = 'admin');

-- ============================================================
-- GEOFENCE EVENTS
-- ============================================================

CREATE POLICY "geofence_events: parties read" ON geofence_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = geofence_events.trip_id
        AND (
          trips.shipper_company_id     = auth_company_id() OR
          trips.transporter_company_id = auth_company_id()
        )
    )
  );

CREATE POLICY "geofence_events: admin read all" ON geofence_events
  FOR SELECT USING (auth_user_type() = 'admin');

-- ============================================================
-- MESSAGES (in-app chat per load)
-- ============================================================

-- Parties involved in the load can read messages
CREATE POLICY "messages: parties read" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM loads l
      WHERE l.id = messages.load_id
        AND (
          l.shipper_company_id = auth_company_id()
          OR EXISTS (
            SELECT 1 FROM bids b
            WHERE b.load_id = l.id
              AND b.transporter_company_id = auth_company_id()
          )
        )
    )
  );

-- Parties can send messages on loads they are involved in
CREATE POLICY "messages: parties insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM loads l
      WHERE l.id = messages.load_id
        AND (
          l.shipper_company_id = auth_company_id()
          OR EXISTS (
            SELECT 1 FROM bids b
            WHERE b.load_id = l.id
              AND b.transporter_company_id = auth_company_id()
          )
        )
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

-- Users can only read their own notifications
CREATE POLICY "notifications: read own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "notifications: update own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- PLATFORM CONFIG
-- ============================================================

-- Admins can read and update config
CREATE POLICY "platform_config: admin all" ON platform_config
  FOR ALL USING (auth_user_type() = 'admin');

-- All authenticated users can read config (needed for min_decrement etc on the bid form)
CREATE POLICY "platform_config: authenticated read" ON platform_config
  FOR SELECT USING (auth.role() = 'authenticated');
