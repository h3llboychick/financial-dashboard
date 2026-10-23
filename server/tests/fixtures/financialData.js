import { up as initial } from '../../src/infrastructure/db/migrations/001_initial.js'
import { up as walletPerEntry } from '../../src/infrastructure/db/migrations/002_wallet_per_entry.js'
import { up as categoryId } from '../../src/infrastructure/db/migrations/004_category_id_instead_category_name_in_entry.js'

export function initializeFinancialData(db) {
  db.pragma('foreign_keys = ON')
  initial({ context: db })
  walletPerEntry({ context: db })
  categoryId({ context: db })
  resetFinancialData(db)
}

export function resetFinancialData(db) {
  db.exec(`
    DELETE FROM entries;
    DELETE FROM exchange_credentials;
    DELETE FROM ledger_categories;
    DELETE FROM wallets;
    DELETE FROM ledgers;
    INSERT INTO ledgers (id, user_id, name, type, color, is_default) VALUES
      (1, 1, 'Spending', 'expense', '#ef4444', 1),
      (2, 1, 'Earnings', 'income', '#22c55e', 0),
      (3, 2, 'Private ledger', 'expense', '#6b7280', 0),
      (4, 1, 'Unused', 'investment', '#3b82f6', 0);
    INSERT INTO wallets (id, user_id, name, currency, type, initial_balance, balance_anchor_entry_id) VALUES
      (1, 1, 'Main EUR', 'EUR', 'fiat', 100, 1),
      (2, 1, 'Kraken', 'USD', 'exchange', 0, 0),
      (3, 2, 'Private wallet', 'EUR', 'fiat', 0, 0),
      (4, 1, 'Unused wallet', 'GBP', 'fiat', 0, 0);
    INSERT INTO ledger_categories (id, user_id, ledger_id, name, color, is_default) VALUES
      (1, 1, 1, 'Food', '#f97316', 1),
      (2, 1, 2, 'Salary', '#22c55e', 0),
      (3, 2, 3, 'Private category', '#6b7280', 0),
      (4, 1, 4, 'Unused category', '#3b82f6', 0);
    INSERT INTO entries (id, user_id, ledger_id, wallet_id, category_id, amount, currency, date, note) VALUES
      (1, 1, 1, 1, 1, 25, 'EUR', '2026-08-01', 'Old note'),
      (2, 2, 3, 3, 3, 75, 'EUR', '2026-08-02', 'Private entry');
  `)
}

export function financialSnapshot(db) {
  return Object.fromEntries(['ledgers', 'wallets', 'ledger_categories', 'entries', 'exchange_credentials'].map(table => [
    table, db.prepare(`SELECT * FROM ${table} ORDER BY id`).all(),
  ]))
}
