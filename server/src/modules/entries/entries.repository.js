export function makeEntryRepo(db) {
  return {
    list_for_ledger({ ledger_id, user_id }) {
      return db
        .prepare(`
          SELECT
            e.*,
            l.name as ledger_name,
            l.type as ledger_type,
            l.color as ledger_color,
            c.name as category_name,
            c.color as category_color
          FROM entries e
          JOIN ledgers l ON l.id = e.ledger_id AND l.user_id = e.user_id
          LEFT JOIN ledger_categories c ON c.id = e.category_id AND c.user_id = e.user_id
          WHERE e.ledger_id = ? AND e.user_id = ?
          ORDER BY e.date DESC, e.created_at DESC
        `)
        .all(ledger_id, user_id)
    },
    list({ user_id }) {
      return db
        .prepare(`
          SELECT
            e.*,
            l.name as ledger_name,
            l.type as ledger_type,
            l.color as ledger_color,
            c.name as category_name,
            c.color as category_color
          FROM entries e
          JOIN ledgers l ON l.id = e.ledger_id AND l.user_id = e.user_id
          LEFT JOIN ledger_categories c ON c.id = e.category_id AND c.user_id = e.user_id
          WHERE e.user_id = ?
          ORDER BY e.date DESC, e.created_at DESC
        `)
        .all(user_id)
    },
    find_by_id({ entry_id, user_id }) {
      return db.prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?').get(entry_id, user_id)
    },
    find_with_details({ entry_id, user_id }) {
      return db
        .prepare(`
          SELECT
            e.*,
            l.name as ledger_name,
            l.type as ledger_type,
            l.color as ledger_color,
            c.name as category_name,
            c.color as category_color
          FROM entries e
          JOIN ledgers l ON l.id = e.ledger_id AND l.user_id = e.user_id
          LEFT JOIN ledger_categories c ON c.id = e.category_id AND c.user_id = e.user_id
          WHERE e.id = ? AND e.user_id = ?
        `)
        .get(entry_id, user_id)
    },
    create({ ledger_id, category_id, wallet_id, user_id, amount, currency, date, note }) {
      return db
        .prepare('INSERT INTO entries (ledger_id, category_id, user_id, wallet_id, amount, currency, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(ledger_id, category_id, user_id, wallet_id, amount, currency, date, note)
    },
    delete_by_id({ entry_id, user_id }) {
      return db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?').run(entry_id, user_id)
    }
  }
}
