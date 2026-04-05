-- ============================================================
-- eParivahan — Dev OTP Logging
-- Migration: 0004_dev_otp_logging.sql
--
-- Stores OTPs in a table so they can be read during development
-- without an SMS provider configured.
--
-- TODO: Remove this migration (or drop the table/function in a
--       subsequent migration) when MSG91 is integrated.
-- ============================================================

-- Table to capture OTPs written by the GoTrue send_sms hook.
CREATE TABLE IF NOT EXISTS public.otp_logs (
  id         bigserial    PRIMARY KEY,
  phone      text         NOT NULL,
  otp        text         NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_logs ENABLE ROW LEVEL SECURITY;

-- Only supabase_auth_admin (GoTrue) may insert; only service_role may read.
GRANT INSERT                      ON TABLE    public.otp_logs           TO supabase_auth_admin;
GRANT SELECT                      ON TABLE    public.otp_logs           TO service_role;
GRANT USAGE, SELECT               ON SEQUENCE public.otp_logs_id_seq    TO supabase_auth_admin;

-- Hook function called by GoTrue instead of sending a real SMS.
CREATE OR REPLACE FUNCTION public.send_sms_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.otp_logs (phone, otp)
  VALUES (
    event -> 'user' ->> 'phone',
    event -> 'sms'  ->> 'otp'
  );
  RETURN '{}'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_sms_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.send_sms_hook FROM PUBLIC, anon, authenticated;
