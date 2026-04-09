-- ============================================================
-- Company branches + per-branch auction settings
-- Migration: 0012_company_branches.sql
--
-- Changes:
--   1. company_branches table
--   2. branch_auction_settings table (overrides company_auction_settings per branch)
--   3. branch_id column on loads
--   4. RLS for both new tables
-- ============================================================

-- ── 1. Company branches ───────────────────────────────────────────────────────
CREATE TABLE public.company_branches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address_line1 TEXT,
  city          TEXT,
  state         TEXT,
  pincode       TEXT,
  lat           NUMERIC(10,7),
  lng           NUMERIC(10,7),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_branches_company_id ON public.company_branches (company_id);

CREATE TRIGGER trg_company_branches_updated_at
  BEFORE UPDATE ON public.company_branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. Branch-level auction settings ─────────────────────────────────────────
-- Lookup order: branch_auction_settings → company_auction_settings → hardcoded defaults.
-- All columns have the same meaning as company_auction_settings but are keyed by branch.
CREATE TABLE public.branch_auction_settings (
  branch_id                 UUID PRIMARY KEY REFERENCES company_branches(id) ON DELETE CASCADE,
  auction_duration_minutes  INTEGER NOT NULL DEFAULT 15 CHECK (auction_duration_minutes >= 1),
  sealed_phase_minutes      INTEGER NOT NULL DEFAULT 0  CHECK (sealed_phase_minutes >= 0),
  extension_trigger_minutes INTEGER NOT NULL DEFAULT 3  CHECK (extension_trigger_minutes >= 0),
  extension_add_minutes     INTEGER NOT NULL DEFAULT 5  CHECK (extension_add_minutes >= 1),
  extension_max_count       INTEGER NOT NULL DEFAULT 3  CHECK (extension_max_count >= 0),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_branch_auction_settings_updated_at
  BEFORE UPDATE ON public.branch_auction_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. branch_id on loads ─────────────────────────────────────────────────────
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES company_branches(id) ON DELETE SET NULL;

CREATE INDEX idx_loads_branch_id ON public.loads (branch_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.company_branches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_auction_settings ENABLE ROW LEVEL SECURITY;

-- ── company_branches ──────────────────────────────────────────────────────────
-- Any shipper/transporter in the company can read their branches
CREATE POLICY "branches: read own company" ON public.company_branches
  FOR SELECT USING (company_id = auth_company_id());

-- Only account_owner may create/update/delete branches
CREATE POLICY "branches: owner write" ON public.company_branches
  FOR ALL USING (
    company_id = auth_company_id()
    AND auth_user_type() = 'shipper'
    AND auth_shipper_role() = 'account_owner'
  );

CREATE POLICY "branches: admin all" ON public.company_branches
  FOR ALL USING (auth_user_type() = 'admin');

-- ── branch_auction_settings ───────────────────────────────────────────────────
-- Any shipper who belongs to the branch's parent company can read
CREATE POLICY "bas: shipper read own" ON public.branch_auction_settings
  FOR SELECT USING (
    auth_user_type() = 'shipper'
    AND EXISTS (
      SELECT 1 FROM company_branches cb
      WHERE cb.id = branch_id
        AND cb.company_id = auth_company_id()
    )
  );

-- Only account_owner may write
CREATE POLICY "bas: owner write" ON public.branch_auction_settings
  FOR ALL USING (
    auth_user_type() = 'shipper'
    AND auth_shipper_role() = 'account_owner'
    AND EXISTS (
      SELECT 1 FROM company_branches cb
      WHERE cb.id = branch_id
        AND cb.company_id = auth_company_id()
    )
  );

CREATE POLICY "bas: admin all" ON public.branch_auction_settings
  FOR ALL USING (auth_user_type() = 'admin');
