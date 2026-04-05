-- ============================================================
-- eParivahan — Registration Requests
-- Migration: 0005_registration_requests.sql
--
-- Replaces the direct company/user_profile creation during
-- self-registration. New users submit a request; an admin
-- reviews and approves (actually creates company + profile)
-- or rejects it.
-- ============================================================

-- ============================================================
-- CLEANUP (idempotent re-run guard)
-- ============================================================

DROP TABLE IF EXISTS registration_requests;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP TYPE IF EXISTS registration_request_status;

-- ============================================================
-- ENUM
-- ============================================================

CREATE TYPE registration_request_status AS ENUM ('pending', 'approved', 'rejected');

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE registration_requests (
  id            UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type     user_type     NOT NULL CHECK (user_type IN ('shipper', 'transporter')),
  full_name     TEXT          NOT NULL,
  company_name  TEXT          NOT NULL,
  gstin         TEXT,
  phone         TEXT          NOT NULL,
  city          TEXT,
  state         TEXT,
  status        registration_request_status NOT NULL DEFAULT 'pending',
  reviewed_by   UUID          REFERENCES auth.users(id),
  review_notes  TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- One request per auth user (prevent duplicate submissions)
  UNIQUE (user_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_registration_requests_updated_at
  BEFORE UPDATE ON registration_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own request
CREATE POLICY "registration_requests: insert own" ON registration_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Authenticated users can read their own request (no profile needed)
CREATE POLICY "registration_requests: read own" ON registration_requests
  FOR SELECT USING (user_id = auth.uid());

-- Admins can read all requests
CREATE POLICY "registration_requests: admin read all" ON registration_requests
  FOR SELECT USING (auth_user_type() = 'admin');

-- Admins can update requests (approve / reject)
CREATE POLICY "registration_requests: admin update" ON registration_requests
  FOR UPDATE USING (auth_user_type() = 'admin');

-- INSERT and admin-side approval DML are performed via service role
-- (createAdminClient) so no INSERT/DELETE policies are needed.
