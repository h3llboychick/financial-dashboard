export function up({ context: db }) {
    db.exec(`
        CREATE TABLE entries_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            ledger_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'EUR',
            category_id INTEGER,
            date TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
            FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES ledger_categories(id) ON DELETE SET NULL,
            UNIQUE(user_id, id)
        );

        INSERT INTO entries_new (id, user_id, ledger_id, amount, currency, category_id, date, note, created_at, wallet_id)
        SELECT
            e.id,
            e.user_id,
            e.ledger_id,
            e.amount,
            e.currency,
            (SELECT lc.id FROM ledger_categories lc WHERE lc.ledger_id = e.ledger_id AND lc.name = e.category),
            e.date,
            e.note,
            e.created_at,
            e.wallet_id
        FROM entries e;

        DROP TABLE entries;
        ALTER TABLE entries_new RENAME TO entries;
    `);
}

export function down({ context: db }) {
    db.exec(`
        CREATE TABLE entries_old (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            ledger_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'EUR',
            category TEXT NOT NULL DEFAULT '',
            date TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
            FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE,
            UNIQUE(user_id, id)
        );

        INSERT INTO entries_old (id, user_id, ledger_id, amount, currency, category, date, note, created_at, wallet_id)
        SELECT
            e.id,
            e.user_id,
            e.ledger_id,
            e.amount,
            e.currency,
            COALESCE((SELECT lc.name FROM ledger_categories lc WHERE lc.id = e.category_id), ''),
            e.date,
            e.note,
            e.created_at,
            e.wallet_id
        FROM entries e;

        DROP TABLE entries;
        ALTER TABLE entries_old RENAME TO entries;
    `);
}