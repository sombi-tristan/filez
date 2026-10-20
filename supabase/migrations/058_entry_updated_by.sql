-- ============================================
-- 058: Who last changed an entry
-- ============================================
-- The Notifications screen is gone; who did what is shown under each entry instead. An entry
-- already says who added it (created_by) and when it last changed (updated_at). updated_by
-- says who: set by every edit and every delete (a soft delete, deleted_at) in
-- app/api/entries/*. Existing entries keep it empty until their next change. Removing a user
-- keeps the entry and drops the name, as created_by on imprest_entries does.

ALTER TABLE daily_sales_entries
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE product_receipt_entries
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lodgement_entries
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lube_sales_entries
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lube_stock_entries
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE customer_payment_entries
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Not consumption_entries: the live database has no such table (migration 024 never reached
-- it) and nothing uses it now (lib/consumptionCalculations.js).

ALTER TABLE imprest_entries
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;
