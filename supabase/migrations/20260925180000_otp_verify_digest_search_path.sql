-- pgcrypto (digest) lives in extensions on hosted Supabase.
-- verify_booking_otp / verify_member_otp were pinned to public only in
-- 20260910180000_member_contact_otp, so digest() raised and edge functions
-- returned the generic "OTP verification failed" for every code.

alter function public.verify_booking_otp(text, text, uuid)
  set search_path to 'public', 'extensions';

alter function public.verify_member_otp(uuid, text, text)
  set search_path to 'public', 'extensions';
