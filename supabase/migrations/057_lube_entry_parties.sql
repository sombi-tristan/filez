-- ============================================
-- 057: Who a lube entry was with, and a receipt's paperwork
-- ============================================
-- A lube sale can be on an account (customer_id): its amount (unit_sold x price) then counts
-- in that account's balance, as a credit sale does. A lube receipt (a lube entry with only
-- units received) names its supplier, also an account (supplier_id), its invoice or waybill
-- number (invoice_no) and what each unit cost (unit_cost). All four are optional, so every
-- existing entry stays as it is. Removing an account keeps the entry and drops the link.

ALTER TABLE lube_sales_entries
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES station_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES station_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_no text,
  ADD COLUMN IF NOT EXISTS unit_cost numeric;

CREATE INDEX IF NOT EXISTS idx_lube_sales_customer ON lube_sales_entries(customer_id);
