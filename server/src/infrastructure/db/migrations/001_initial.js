export function up({ context: db }) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            UNIQUE(user_id, name)
        );
        CREATE TABLE IF NOT EXISTS ledgers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'investment')),
            color TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, name)
        );
        CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            currency TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('fiat', 'exchange')),
            initial_balance REAL NOT NULL DEFAULT 0,
            balance_anchor_entry_id INTEGER NOT NULL DEFAULT 0,
            balance_anchor_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, name)
        );
        CREATE TABLE IF NOT EXISTS exchange_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            wallet_id INTEGER NOT NULL,
            slug TEXT NOT NULL,
            encrypted_dek TEXT,
            encrypted_dek_iv TEXT,
            encrypted_dek_tag TEXT,
            credentials_ciphertext TEXT,
            credentials_iv TEXT,
            credentials_tag TEXT,
            encryption_version INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
            UNIQUE(user_id, wallet_id)
        );
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            ledger_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'EUR',
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE,
            UNIQUE(user_id, id)
        );
        CREATE TABLE IF NOT EXISTS ledger_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            ledger_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE,
            UNIQUE(user_id, ledger_id, name)
        );
        `)
}

export function down({ context: db}) {
    db.exec(`
        DROP TABLE IF EXISTS categories;
        DROP TABLE IF EXISTS wallets;
        DROP TABLE IF EXISTS ledgers;
        DROP TABLE IF EXISTS exchange_credentials;
        DROP TABLE IF EXISTS entries;
        DROP TABLE IF EXISTS ledger_categories;
    `)
}