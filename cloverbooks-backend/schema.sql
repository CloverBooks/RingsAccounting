CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    country TEXT NOT NULL CHECK (country IN ('CA', 'US')),
    fin TEXT,
    transit TEXT,
    account TEXT NOT NULL,
    aba_routing TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (country = 'CA' AND fin IS NOT NULL AND transit IS NOT NULL)
        OR (country = 'US' AND aba_routing IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    country TEXT NOT NULL CHECK (country IN ('CA', 'US')),
    fin TEXT,
    transit TEXT,
    account TEXT NOT NULL,
    aba_routing TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (country = 'CA' AND fin IS NOT NULL AND transit IS NOT NULL)
        OR (country = 'US' AND aba_routing IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL CHECK (currency IN ('CAD', 'USD')),
    due_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL CHECK (currency IN ('CAD', 'USD')),
    frequency TEXT NOT NULL CHECK (frequency IN ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
    next_due DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    mandate_type TEXT NOT NULL CHECK (mandate_type IN ('PAD', 'ACH')),
    signed_at TIMESTAMPTZ NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
    gateway_transaction_id TEXT NOT NULL,
    raw_response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (bill_id IS NOT NULL AND invoice_id IS NULL)
        OR (bill_id IS NULL AND invoice_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS bills_vendor_id_idx ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS mandates_customer_id_idx ON mandates(customer_id);
CREATE INDEX IF NOT EXISTS payments_bill_id_idx ON payments(bill_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON payments(invoice_id);
