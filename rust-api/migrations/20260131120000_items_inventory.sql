-- Items + Inventory Ledger schema (SQLite)

-- Create core_item table if it doesn't exist (fixing schema mismatch)
CREATE TABLE IF NOT EXISTS core_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    description TEXT,
    price REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    kind TEXT NOT NULL DEFAULT 'product',
    track_inventory INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_core_item_business ON core_item(business_id);


-- Inventory locations
CREATE TABLE IF NOT EXISTS inv_location (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(business_id, code)
);

-- Inventory balances (per item + location)
CREATE TABLE IF NOT EXISTS inv_balance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    qty_on_hand NUMERIC NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(business_id, item_id, location_id)
);

-- Inventory events (ledger)
CREATE TABLE IF NOT EXISTS inv_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    qty NUMERIC NOT NULL,
    unit_cost NUMERIC,
    memo TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inv_event_item_time
    ON inv_event (business_id, item_id, created_at DESC);

-- Seed a default location per business if none exists
INSERT INTO inv_location (business_id, name, code, is_active, created_at, updated_at)
SELECT b.id, 'Main Warehouse', 'MAIN', 1, datetime('now'), datetime('now')
FROM core_business b
WHERE NOT EXISTS (
    SELECT 1
    FROM inv_location l
    WHERE l.business_id = b.id
);
