-- Dashboard and list-route performance indexes.
-- These target the legacy core_* tables when that schema is present.

CREATE INDEX IF NOT EXISTS idx_core_invoice_business_status_issue_date
ON core_invoice (business_id, status, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_core_expense_business_status_date
ON core_expense (business_id, status, date DESC);

CREATE INDEX IF NOT EXISTS idx_core_customer_business_name
ON core_customer (business_id, name);

CREATE INDEX IF NOT EXISTS idx_core_supplier_business_name
ON core_supplier (business_id, name);

CREATE INDEX IF NOT EXISTS idx_core_bankaccount_business_active_name
ON core_bankaccount (business_id, is_active, name);

CREATE INDEX IF NOT EXISTS idx_core_banktransaction_account_date_id
ON core_banktransaction (bank_account_id, date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_core_business_owner_deleted
ON core_business (owner_user_id, is_deleted);
