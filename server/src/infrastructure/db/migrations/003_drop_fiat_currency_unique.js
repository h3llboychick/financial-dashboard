export function up({ context: db }) {
    db.exec(`DROP INDEX IF EXISTS idx_wallets_one_fiat_per_currency;`);
}

export function down({ context: db }) {
    db.exec(`
        CREATE UNIQUE INDEX idx_wallets_one_fiat_per_currency
          ON wallets(user_id, currency)
          WHERE type = 'fiat';
    `);
}