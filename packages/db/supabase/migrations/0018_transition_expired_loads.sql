-- Transition loads whose auction has ended but whose status is still 'open'
-- to either 'under_review' (bids exist) or 'expired' (no bids).
-- Called from the client on the shipper loads / dashboard pages.

CREATE OR REPLACE FUNCTION public.transition_expired_loads(
  p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER          -- needed to check bids table across RLS boundary
SET search_path = public
AS $$
BEGIN
  -- open + expired + has at least one active bid → under_review
  UPDATE loads
  SET status = 'under_review'
  WHERE status = 'open'
    AND auction_end_time < now()
    AND (p_company_id IS NULL OR shipper_company_id = p_company_id)
    AND EXISTS (
      SELECT 1 FROM bids
      WHERE bids.load_id = loads.id
        AND bids.status = 'active'
    );

  -- open + expired + no active bids → expired
  UPDATE loads
  SET status = 'expired'
  WHERE status = 'open'
    AND auction_end_time < now()
    AND (p_company_id IS NULL OR shipper_company_id = p_company_id)
    AND NOT EXISTS (
      SELECT 1 FROM bids
      WHERE bids.load_id = loads.id
        AND bids.status = 'active'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_expired_loads(uuid) TO authenticated;
