import { afterAll, describe, expect, test } from '@jest/globals'
import Database from 'better-sqlite3-multiple-ciphers'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeRecurringRepo } from '../src/modules/recurring/recurring.repository.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/infrastructure/db/migrations')

/**
 * Applies every migration in file order, the way umzug does on boot. A
 * migration edited after it already ran somewhere will not run again, so the
 * schema here has to match what the queries expect.
 */
async function migrateFreshDatabase() {
  const db = new Database(':memory:')
  const files = readdirSync(migrationsDir).filter(name => name.endsWith('.js')).sort()

  for (const file of files) {
    const { up } = await import(join(migrationsDir, file))
    up({ context: db })
  }

  return { db, files }
}

let db

afterAll(() => db?.close())

describe('migrations', () => {
  test('build a schema the recurring queries can use', async () => {
    const fresh = await migrateFreshDatabase()
    db = fresh.db

    expect(fresh.files.at(-1)).toBe('008_user_settings.js')

    const columns = db.prepare('PRAGMA table_info(recurring_rules)').all().map(column => column.name)
    for (const required of ['frequency', 'interval_count', 'day_of_month', 'last_day', 'weekday', 'month_of_year', 'start_date', 'end_date']) {
      expect(columns).toContain(required)
    }
  })

  test('let a rule be created and updated, including the end date', () => {
    db.exec(`
      INSERT INTO ledgers (id, user_id, name, type, color) VALUES (1, 1, 'Earnings', 'income', '#22c55e');
      INSERT INTO wallets (id, user_id, name, currency, type) VALUES (1, 1, 'Bank', 'EUR', 'fiat');
      INSERT INTO ledger_categories (id, user_id, ledger_id, name, color) VALUES (1, 1, 1, 'Scholarship', '#22c55e');
    `)
    const repo = makeRecurringRepo(db)

    const created = repo.create({
      user_id: 1,
      name: 'Scholarship',
      ledger_id: 1,
      wallet_id: 1,
      category_id: 1,
      amount: 500,
      currency: 'EUR',
      frequency: 'monthly',
      interval_count: 1,
      day_of_month: 31,
      last_day: 1,
      start_date: '2026-09-01',
      end_date: '2027-09-01',
    })

    expect(created.changes).toBe(1)

    const updated = repo.update({
      rule_id: created.lastInsertRowid,
      user_id: 1,
      end_date: '2027-12-31',
      active: 0,
    })

    expect(updated.changes).toBe(1)

    const cleared = repo.update({
      rule_id: created.lastInsertRowid,
      user_id: 1,
      clear_end_date: true,
    })

    expect(cleared.changes).toBe(1)
    expect(db.prepare('SELECT end_date FROM recurring_rules WHERE id = ?').get(created.lastInsertRowid).end_date).toBeNull()
  })
})
