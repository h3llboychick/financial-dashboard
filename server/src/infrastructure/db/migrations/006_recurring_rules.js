export function up({ context: db }) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS recurring_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            ledger_id INTEGER NOT NULL,
            wallet_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            note TEXT DEFAULT '',
            frequency TEXT NOT NULL DEFAULT 'monthly'
                CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
            interval_count INTEGER NOT NULL DEFAULT 1 CHECK(interval_count BETWEEN 1 AND 365),
            day_of_month INTEGER NOT NULL DEFAULT 1 CHECK(day_of_month BETWEEN 1 AND 31),
            last_day INTEGER NOT NULL DEFAULT 0 CHECK(last_day IN (0, 1)),
            weekday INTEGER CHECK(weekday IS NULL OR weekday BETWEEN 0 AND 6),
            month_of_year INTEGER CHECK(month_of_year IS NULL OR month_of_year BETWEEN 1 AND 12),
            start_date TEXT NOT NULL,
            end_date TEXT,
            active INTEGER NOT NULL DEFAULT 1,
            last_generated_on TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ledger_id) REFERENCES ledgers(id) ON DELETE CASCADE,
            FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES ledger_categories(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_recurring_rules_user
            ON recurring_rules(user_id, active, start_date);
    `)
}

export function down({ context: db }) {
    db.exec(`
        DROP INDEX IF EXISTS idx_recurring_rules_user;
        DROP TABLE IF EXISTS recurring_rules;
    `)
}
