-- Legacy Schema Migration
-- Maps existing tables (businesses, users) to Rust schema (core_business, auth_user)

-- Create auth_user table
CREATE TABLE IF NOT EXISTS auth_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    password TEXT NOT NULL,
    last_login TEXT,
    is_superuser INTEGER NOT NULL DEFAULT 0,
    username TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL UNIQUE,
    is_staff INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    date_joined TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy users to auth_user (if businesses table exists)
INSERT INTO auth_user (id, email, password, username, first_name, is_active, is_staff, is_superuser, date_joined)
SELECT 
    id, 
    email, 
    password_hash, 
    email, -- username maps to email
    COALESCE(name, ''), -- first_name maps to name
    is_active, 
    is_admin, 
    is_admin, 
    created_at
FROM users
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='users')
AND NOT EXISTS (SELECT 1 FROM auth_user WHERE auth_user.id = users.id);

-- Create core_business table
CREATE TABLE IF NOT EXISTS core_business (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    currency TEXT NOT NULL DEFAULT 'CAD',
    owner_user_id INTEGER,
    owner_id INTEGER, -- Redundant column to satisfy inconsistent code
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (owner_user_id) REFERENCES auth_user(id)
);

-- Copy businesses to core_business
INSERT INTO core_business (id, name, currency, owner_user_id, owner_id)
SELECT 
    id, 
    name, 
    currency, 
    owner_user_id,
    owner_user_id -- Populate both columns
FROM businesses
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='businesses')
AND NOT EXISTS (SELECT 1 FROM core_business WHERE core_business.id = businesses.id);

-- Create core_customer table
CREATE TABLE IF NOT EXISTS core_customer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES core_business(id)
);

-- Copy customers
INSERT INTO core_customer (id, business_id, name, email, phone, is_active, created_at)
SELECT 
    id, 
    business_id, 
    name, 
    email, 
    phone, 
    is_active, 
    created_at
FROM customers
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='customers')
AND NOT EXISTS (SELECT 1 FROM core_customer WHERE core_customer.id = customers.id);

-- Ensure core_item exists (redundant with next migration but good for safety)
-- Next migration will handle it, but we need core_business for it to succeed.
