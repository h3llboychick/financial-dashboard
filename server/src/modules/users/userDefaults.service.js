import { DEFAULT_LEDGERS, DEFAULT_CATEGORIES } from '../../shared/constants.js'

function seedCategoriesForLedger(db, user_id, ledger) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO ledger_categories (user_id, ledger_id, name, color, is_default)
    VALUES (?, ?, ?, ?, ?)
  `)
  for (const [name, color] of DEFAULT_CATEGORIES[ledger.type] || DEFAULT_CATEGORIES.expense) {
    insert.run(user_id, ledger.id, name, color, ledger.is_default ? 1 : 0)
  }
}

export function makeUserDefaultsService(db) {
  return {
    ensureUserDefaults(user_id) {
      const insertLedger = db.prepare(`
        INSERT OR IGNORE INTO ledgers (user_id, name, type, color, is_default)
        VALUES (?, ?, ?, ?, 1)
      `)
      for (const ledger of DEFAULT_LEDGERS) {
        insertLedger.run(user_id, ledger.name, ledger.type, ledger.color)
      }

      const ledgers = db.prepare('SELECT * FROM ledgers WHERE user_id = ?').all(user_id)
      for (const ledger of ledgers) {
        const { count } = db
          .prepare('SELECT COUNT(*) as count FROM ledger_categories WHERE user_id = ? AND ledger_id = ?')
          .get(user_id, ledger.id)
        if (ledger.is_default && count === 0) seedCategoriesForLedger(db, user_id, ledger)
      }
    }
  }
}

