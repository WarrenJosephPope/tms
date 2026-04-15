-- Migration: Add module configuration to companies
-- Each company can have access to 'bidding', 'tracking', or both.
-- Defaults to both so existing companies are unaffected.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT ARRAY['bidding','tracking']::text[];

-- GIN index for fast array containment queries
CREATE INDEX IF NOT EXISTS idx_companies_modules
  ON companies USING GIN (modules);

-- Helper RPC: check if a company has a specific module enabled
CREATE OR REPLACE FUNCTION company_has_module(p_company_id uuid, p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_module = ANY(
    COALESCE(
      (SELECT modules FROM companies WHERE id = p_company_id),
      ARRAY['bidding','tracking']::text[]
    )
  );
$$;

GRANT EXECUTE ON FUNCTION company_has_module(uuid, text) TO authenticated;

COMMENT ON COLUMN companies.modules IS
  'Array of enabled product modules for this company. Valid values: ''bidding'', ''tracking''.';
