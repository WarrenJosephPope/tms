-- ============================================================
-- Human-readable load number
--
-- Adds a `load_number` column (auto-incrementing BIGINT) so every
-- load gets a unique, user-facing reference like #0000001.
-- ============================================================

ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS load_number BIGINT GENERATED ALWAYS AS IDENTITY;

-- Ensure uniqueness for lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_loads_load_number ON public.loads (load_number);
