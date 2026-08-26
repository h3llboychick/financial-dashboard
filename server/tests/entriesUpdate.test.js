import { afterAll, beforeEach, describe, expect, test } from '@jest/globals'
import Database from 'better-sqlite3-multiple-ciphers'
import express from 'express'
import request from 'supertest'
import { makeCategoryRepo } from '../src/modules/categories/categories.repository.js'
import { makeEntriesRouter } from '../src/modules/entries/entries.routes.js'
import { makeEntryRepo } from '../src/modules/entries/entries.repository.js'
import { makeLedgerRepo } from '../src/modules/ledgers/ledgers.repository.js'

const db = new Database(':memory:')

db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE ledgers (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT NOT NULL,
    is_default INTEGER DEFAULT 0
  );
  CREATE TABLE wallets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    type TEXT NOT NULL,
    initial_balance REAL NOT NULL DEFAULT 0,
    balance_anchor_entry_id INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE ledger_categories (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    ledger_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    FOREIGN KEY (ledger_id) REFERENCES ledgers(id)
  );
  CREATE TABLE entries (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    ledger_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    category_id INTEGER,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    wallet_id INTEGER,
    FOREIGN KEY (ledger_id) REFERENCES ledgers(id),
    FOREIGN KEY (category_id) REFERENCES ledger_categories(id),
    FOREIGN KEY (wallet_id) REFERENCES wallets(id)
  );
`)

const repos = {
  category_repo: makeCategoryRepo(db),
  entry_repo: makeEntryRepo(db),
  ledger_repo: makeLedgerRepo(db),
  wallet_repo: {
    find_by_id({ wallet_id, user_id }) {
      return db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?').get(wallet_id, user_id)
    },
  },
}

const app = express()
app.use(express.json())
app.use((req, res, next) => {
  req.user = { user_id: Number(req.header('x-user-id') || 1) }
  next()
})
app.use('/entries', makeEntriesRouter(repos))

function seedRows() {
  db.exec(`
    DELETE FROM entries;
    DELETE FROM ledger_categories;
    DELETE FROM wallets;
    DELETE FROM ledgers;

    INSERT INTO ledgers (id, user_id, name, type, color) VALUES
      (1, 1, 'Spending', 'expense', '#ef4444'),
      (2, 1, 'Earnings', 'income', '#22c55e'),
      (3, 2, 'Private ledger', 'expense', '#6b7280');

    INSERT INTO wallets (id, user_id, name, currency, type) VALUES
      (1, 1, 'Main EUR', 'EUR', 'fiat'),
      (2, 1, 'Main USD', 'USD', 'fiat'),
      (3, 2, 'Private wallet', 'EUR', 'fiat');

    INSERT INTO ledger_categories (id, user_id, ledger_id, name, color) VALUES
      (1, 1, 1, 'Food', '#f97316'),
      (2, 1, 2, 'Salary', '#22c55e'),
      (3, 2, 3, 'Private category', '#6b7280');

    INSERT INTO entries (id, user_id, ledger_id, wallet_id, category_id, amount, currency, date, note) VALUES
      (1, 1, 1, 1, 1, 25, 'EUR', '2026-08-01', 'Old note'),
      (2, 2, 3, 3, 3, 75, 'EUR', '2026-08-02', 'Private entry');
  `)
}

beforeEach(seedRows)
afterAll(() => db.close())

describe('PATCH /entries/:id', () => {
  test('updates every editable field and returns enriched entry details', async () => {
    const response = await request(app)
      .patch('/entries/1')
      .set('x-user-id', '1')
      .send({
        ledger_id: 2,
        wallet_id: 2,
        category_id: 2,
        amount: 120.5,
        currency: 'usd',
        date: '2026-08-20',
        note: 'Updated salary',
      })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: 1,
      user_id: 1,
      ledger_id: 2,
      ledger_name: 'Earnings',
      ledger_type: 'income',
      wallet_id: 2,
      category_id: 2,
      category_name: 'Salary',
      amount: 120.5,
      currency: 'USD',
      date: '2026-08-20',
      note: 'Updated salary',
    })

    const stored = db.prepare('SELECT * FROM entries WHERE id = 1').get()
    expect(stored).toMatchObject({ ledger_id: 2, wallet_id: 2, category_id: 2, amount: 120.5, currency: 'USD' })
  })

  test('rejects a category that does not belong to the selected ledger', async () => {
    const response = await request(app)
      .patch('/entries/1')
      .send({
        ledger_id: 2,
        wallet_id: 1,
        category_id: 1,
        amount: 25,
        currency: 'EUR',
        date: '2026-08-01',
        note: 'Invalid category change',
      })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'category_id must belong to ledger_id' })
    expect(db.prepare('SELECT ledger_id FROM entries WHERE id = 1').get().ledger_id).toBe(1)
  })

  test('does not allow a user to update another user’s entry', async () => {
    const response = await request(app)
      .patch('/entries/2')
      .set('x-user-id', '1')
      .send({
        ledger_id: 1,
        wallet_id: 1,
        category_id: 1,
        amount: 10,
        currency: 'EUR',
        date: '2026-08-03',
        note: 'Unauthorized change',
      })

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Not found' })
    expect(db.prepare('SELECT note FROM entries WHERE id = 2').get().note).toBe('Private entry')
  })

  test('rejects a wallet owned by another user', async () => {
    const response = await request(app)
      .patch('/entries/1')
      .send({
        ledger_id: 1,
        wallet_id: 3,
        category_id: 1,
        amount: 25,
        currency: 'EUR',
        date: '2026-08-01',
        note: 'Invalid wallet change',
      })

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Wallet not found' })
  })
})
