export function makeLedgerRepo(db) {
  return {
      list({ user_id }) {
        return db
          .prepare(`
            SELECT * FROM ledgers
            WHERE user_id = ?
            ORDER BY is_default DESC,
              CASE type WHEN 'income' THEN 1 WHEN 'expense' THEN 2 WHEN 'investment' THEN 3 ELSE 4 END,
              name ASC
          `)
          .all(user_id)
      },
      find_by_id({ user_id, ledger_id }) {
        return db.prepare('SELECT * FROM ledgers WHERE id = ? AND user_id = ?').get(ledger_id, user_id)
      },
      find_default({ user_id, name = 'Spending' }) {
        return db.prepare('SELECT * FROM ledgers WHERE user_id = ? AND name = ?').get(user_id, name)
      },
      create({ user_id, name, type, color }) {
        return db
          .prepare('INSERT INTO ledgers (user_id, name, type, color) VALUES (?, ?, ?, ?)')
          .run(user_id, name, type, color)
      },
      count_entries({ user_id, ledger_id }) {
        return db
          .prepare('SELECT COUNT(*) as count FROM entries WHERE ledger_id = ? AND user_id = ?')
          .get(ledger_id, user_id)
      },
      delete_by_id({ user_id, ledger_id }) {
        db.prepare('DELETE FROM ledger_categories WHERE ledger_id = ? AND user_id = ?').run(ledger_id, user_id)
        return db.prepare('DELETE FROM ledgers WHERE id = ? AND user_id = ?').run(ledger_id, user_id)
      }
  }
}
