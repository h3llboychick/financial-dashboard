export function makeCategoryRepo(db) {
  return {
    list_for_ledger({ user_id, ledger_id }) {
      return db
        .prepare('SELECT * FROM ledger_categories WHERE user_id = ? AND ledger_id = ? ORDER BY name ASC')
        .all(user_id, ledger_id)
    },
    list({ user_id }) {
      return db
        .prepare('SELECT * FROM ledger_categories WHERE user_id = ? ORDER BY name ASC')
        .all(user_id)
    },
    find_by_id({ user_id, category_id }) {
      return db.prepare('SELECT * FROM ledger_categories WHERE id = ? AND user_id = ?').get(category_id, user_id)
    },
    create({ user_id, ledger_id, name, color }) {
      return db
        .prepare('INSERT INTO ledger_categories (user_id, ledger_id, name, color) VALUES (?, ?, ?, ?)')
        .run(user_id, ledger_id, name, color)
    },
    count_entries({ user_id, category_id }) {
      return db
        .prepare('SELECT COUNT(*) as count FROM entries WHERE category_id = ? AND user_id = ?')
        .get(category_id, user_id)
    },
    delete_by_id({ user_id, category_id }) {
      return db.prepare('DELETE FROM ledger_categories WHERE id = ? AND user_id = ?').run(category_id, user_id)
    }
  }
}
