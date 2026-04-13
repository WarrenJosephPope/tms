-- ============================================================
-- Tracking Management System — user_profiles INSERT policies
-- Migration: 0006_user_profiles_insert_policies.sql
-- ============================================================

-- A newly-signed-up user can create their own profile row (id must match their auth.uid)
CREATE POLICY "user_profiles: insert own" ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Account owners can add team members to their own company
CREATE POLICY "user_profiles: owner insert team" ON user_profiles
  FOR INSERT WITH CHECK (
    company_id = auth_company_id()
    AND (
      (auth_user_type() = 'shipper'     AND auth_shipper_role()     = 'account_owner') OR
      (auth_user_type() = 'transporter' AND auth_transporter_role() = 'account_owner')
    )
  );

-- Admins can insert any user profile
CREATE POLICY "user_profiles: admin insert" ON user_profiles
  FOR INSERT WITH CHECK (auth_user_type() = 'admin');
