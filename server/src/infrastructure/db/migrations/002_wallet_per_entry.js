export function up({ context: db }) {
    db.exec(`
        ALTER TABLE entries ADD COLUMN wallet_id INTEGER
        REFERENCES wallets(id)
        ON DELETE SET NULL;        
    `)
}

export function down({ context: db}) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS entries_new (
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
        INSERT INTO entries_new SELECT id, user_id, ledger_id, amount, currency, category, date, note, created_at FROM entries;
        DROP TABLE entries;
        ALTER TABLE entries_new RENAME TO entries;
    `)   
}