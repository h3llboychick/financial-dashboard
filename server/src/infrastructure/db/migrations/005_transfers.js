export function up({ context: db }) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            from_wallet_id INTEGER NOT NULL,
            to_wallet_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            date TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            CHECK (from_wallet_id <> to_wallet_id),
            FOREIGN KEY (from_wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
            FOREIGN KEY (to_wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_transfers_wallets
            ON transfers(user_id, from_wallet_id, to_wallet_id);
    `)
}

export function down({ context: db }) {
    db.exec(`
        DROP INDEX IF EXISTS idx_transfers_wallets;
        DROP TABLE IF EXISTS transfers;
    `)
}
