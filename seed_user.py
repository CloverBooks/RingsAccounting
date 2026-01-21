import sqlite3
import hashlib
import base64
import os

DB_PATH = "legacy/db/db.sqlite3"

def make_password(password, salt="somesalt", iterations=260000):
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    hash_b64 = base64.b64encode(dk).decode("ascii")
    return f"pbkdf2_sha256${iterations}${salt}${hash_b64}"

def seed():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 0. Create Tables (Legacy Schema)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS auth_user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            password VARCHAR(128) NOT NULL,
            last_login DATETIME,
            is_superuser BOOLEAN NOT NULL,
            username VARCHAR(150) NOT NULL UNIQUE,
            first_name VARCHAR(150) NOT NULL,
            last_name VARCHAR(150) NOT NULL,
            email VARCHAR(254) NOT NULL,
            is_staff BOOLEAN NOT NULL,
            is_active BOOLEAN NOT NULL,
            date_joined DATETIME NOT NULL
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS core_business (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            owner_user_id INTEGER NOT NULL REFERENCES auth_user(id),
            is_deleted BOOLEAN NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS core_expensecategory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id INTEGER NOT NULL REFERENCES core_business(id),
            name VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        );
    """)

    # 1. Ensure User
    email = "demo@example.com"
    password = "password123"
    password_hash = make_password(password)
    
    print(f"Creating user {email}...")
    cursor.execute("SELECT id FROM auth_user WHERE email = ?", (email,))
    row = cursor.fetchone()
    
    if row:
        user_id = row[0]
        print(f"User exists with ID {user_id}")
    else:
        cursor.execute("""
            INSERT INTO auth_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined)
            VALUES (?, NULL, 0, ?, 'Demo', 'User', ?, 0, 1, datetime('now'))
        """, (password_hash, email, email))
        user_id = cursor.lastrowid
        print(f"Created user with ID {user_id}")

    # 2. Check Business Schema (owner_id vs owner_user_id)
    # The rust code referenced both, let's see what exists
    cursor.execute("PRAGMA table_info(core_business)")
    columns = [info[1] for info in cursor.fetchall()]
    print(f"core_business columns: {columns}")
    
    owner_col = "owner_user_id" if "owner_user_id" in columns else "owner_id"
    
    # 3. Ensure Business
    business_name = "Demo Corp"
    print(f"Creating business {business_name}...")
    
    cursor.execute(f"SELECT id FROM core_business WHERE {owner_col} = ?", (user_id,))
    row = cursor.fetchone()
    
    if row:
        business_id = row[0]
        print(f"Business exists with ID {business_id}")
    else:
        cursor.execute(f"""
            INSERT INTO core_business (name, {owner_col}, is_deleted, created_at, updated_at)
            VALUES (?, ?, 0, datetime('now'), datetime('now'))
        """, (business_name, user_id))
        business_id = cursor.lastrowid
        print(f"Created business with ID {business_id}")

    # 4. Expense Categories
    categories = ["Rent/Office", "Software", "Travel", "Marketing", "Utilities"]
    for name in categories:
        cursor.execute("SELECT id FROM core_expensecategory WHERE business_id = ? AND name = ?", (business_id, name))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO core_expensecategory (business_id, name, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))", (business_id, name))
            print(f"Added category: {name}")

    conn.commit()
    conn.close()
    print("Seeding complete.")

if __name__ == "__main__":
    seed()
