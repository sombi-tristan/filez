-- 059_ago_reset_date.sql
-- The Summary report's AGO sheet (tap the date five times) lists each day's highest AGO price
-- times 3 litres from this date on. Reset sets it to the day it is pressed, for every phone.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ago_reset_date date;
