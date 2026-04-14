-- ============================================================
-- Tracking Management System — Clear OTP Logs Function
-- Migration: 0017_clear_otp_logs_fn.sql
--
-- Provides a SECURITY DEFINER RPC that authenticated users can
-- call after a successful OTP verification to delete all prior
-- OTP log entries for their phone number.
-- ============================================================

CREATE OR REPLACE FUNCTION public.clear_otp_logs(p_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_logs WHERE phone = p_phone;
END;
$$;

-- Allow authenticated users (post-login) to invoke this function.
GRANT EXECUTE ON FUNCTION public.clear_otp_logs(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_otp_logs(text) FROM PUBLIC, anon;
