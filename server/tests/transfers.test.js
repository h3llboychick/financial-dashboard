import { afterAll, beforeEach, describe, expect, test } from '@jest/globals'
import Database from 'better-sqlite3-multiple-ciphers'
import express from 'express'
import request from 'supertest'
import { makeTransferRepo } from '../src/modules/transfers/transfers.repository.js'
import { makeTransfersRouter } from '../src/modules/transfers/transfers.routes.js'
import { makeWalletRepo } from '../src/modules/wallets/wallets.repository.js'
import { makeWalletsRouter } from '../src/modules/wallets/wallets.routes.js'

const db = new Database(':memory:')

db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE wallets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    type TEXT NOT NULL,
    initial_balance REAL NOT NULL DEFAULT 0,
    balance_anchor_entry_id INTEGER NOT NULL DEFAULT 0,
    balance_anchor_at TEXT
  );
  CREATE TABLE ledgers (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT NOT NULL,
    is_default INTEGER DEFAULT 0
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
    wallet_id INTEGER
  );
  CREATE TABLE exchange_credentials (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    wallet_id INTEGER NOT NULL,
    slug TEXT NOT NULL
  );
  CREATE TABLE transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    from_wallet_id INTEGER NOT NULL,
    to_wallet_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    CHECK (from_wallet_id <> to_wallet_id)
  );
`)

const repos = {
  wallet_repo: makeWalletRepo(db),
  transfer_repo: makeTransferRepo(db),
}

const app = express()
app.use(express.json())
app.use((req, res, next) => {
  req.user = { user_id: Number(req.header('x-user-id') || 1) }
  next()
})
app.use('/wallets', makeWalletsRouter(repos))
app.use('/transfers', makeTransfersRouter(repos))
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message })
})

function seedRows() {
  db.exec(`
    DELETE FROM transfers;
    DELETE FROM entries;
    DELETE FROM wallets;
    DELETE FROM ledgers;

    INSERT INTO wallets (id, user_id, name, currency, type, initial_balance) VALUES
      (1, 1, 'Cash', 'EUR', 'fiat', 100),
      (2, 1, 'Bank', 'EUR', 'fiat', 0),
      (3, 1, 'Dollars', 'USD', 'fiat', 0),
      (4, 1, 'Kraken', 'USD', 'exchange', 0),
      (5, 2, 'Private', 'EUR', 'fiat', 0),
      (6, 2, 'Private savings', 'EUR', 'fiat', 0);

    INSERT INTO ledgers (id, user_id, name, type, color) VALUES
      (1, 1, 'Spending', 'expense', '#ef4444');

    INSERT INTO entries (id, user_id, ledger_id, wallet_id, amount, currency, date) VALUES
      (1, 1, 1, 1, 20, 'EUR', '2026-08-01');
  `)
}

async function walletBalances(userId = '1') {
  const response = await request(app).get('/wallets').set('x-user-id', userId)
  if (!Array.isArray(response.body)) {
    throw new Error(`GET /wallets failed with ${response.status}: ${response.text}`)
  }
  return Object.fromEntries(response.body.map(wallet => [wallet.name, wallet.balance]))
}

beforeEach(seedRows)
afterAll(() => db.close())

describe('POST /transfers', () => {
  test('moves money between two wallets of the same currency', async () => {
    const response = await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 2, amount: 30, date: '2026-08-05', note: 'Top up' })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      from_wallet_id: 1,
      to_wallet_id: 2,
      amount: 30,
      currency: 'EUR',
      date: '2026-08-05',
      note: 'Top up',
    })

    expect(await walletBalances()).toEqual({ Cash: 50, Bank: 30, Dollars: 0, Kraken: null, Private: undefined })
  })

  test('refuses a transfer into the same wallet', async () => {
    const response = await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 1, amount: 10, date: '2026-08-05' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/different wallets/i)
  })

  test('refuses wallets with different currencies', async () => {
    const response = await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 3, amount: 10, date: '2026-08-05' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/same currency/i)
  })

  test('refuses exchange wallets', async () => {
    const response = await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 4, amount: 10, date: '2026-08-05' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/fiat/i)
  })

  test('refuses a wallet owned by another user', async () => {
    const response = await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 5, amount: 10, date: '2026-08-05' })

    expect(response.status).toBe(404)
    expect(response.body.error).toMatch(/not found/i)
  })

  test('refuses a non-positive amount', async () => {
    const response = await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 2, amount: 0, date: '2026-08-05' })

    expect(response.status).toBe(400)
  })

  test('keeps transfers out of ledger entries', async () => {
    await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 2, amount: 30, date: '2026-08-05' })

    const row = db.prepare('SELECT COUNT(*) AS count FROM entries WHERE user_id = 1').get()
    expect(row.count).toBe(1)
  })
})

describe('GET /transfers', () => {
  test('lists transfers with wallet names, newest first', async () => {
    await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 2, amount: 10, date: '2026-08-01' })
    await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 2, amount: 5, date: '2026-08-09', note: 'Later' })

    const response = await request(app).get('/transfers').set('x-user-id', '1')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(2)
    expect(response.body[0]).toMatchObject({
      from_wallet_name: 'Cash',
      to_wallet_name: 'Bank',
      amount: 5,
      note: 'Later',
    })
    expect(response.body[1].amount).toBe(10)
  })

  test('does not leak transfers of another user', async () => {
    db.exec(`
      INSERT INTO transfers (id, user_id, from_wallet_id, to_wallet_id, amount, currency, date)
      VALUES (99, 2, 5, 6, 1, 'EUR', '2026-08-01');
    `)

    const response = await request(app).get('/transfers').set('x-user-id', '1')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(0)
  })
})

describe('DELETE /transfers/:id', () => {
  test('removes a transfer and restores both balances', async () => {
    const created = await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 2, amount: 40, date: '2026-08-05' })

    const response = await request(app)
      .delete(`/transfers/${created.body.id}`)
      .set('x-user-id', '1')

    expect(response.status).toBe(204)
    expect(await walletBalances()).toEqual({ Cash: 80, Bank: 0, Dollars: 0, Kraken: null, Private: undefined })
  })

  test('does not delete a transfer of another user', async () => {
    db.exec(`
      INSERT INTO transfers (id, user_id, from_wallet_id, to_wallet_id, amount, currency, date)
      VALUES (77, 2, 5, 6, 1, 'EUR', '2026-08-01');
    `)

    const response = await request(app).delete('/transfers/77').set('x-user-id', '1')

    expect(response.status).toBe(404)
    expect(db.prepare('SELECT COUNT(*) AS count FROM transfers WHERE id = 77').get().count).toBe(1)
  })
})

describe('wallet balance with transfers', () => {
  test('ignores transfers created before the wallet balance anchor timestamp', async () => {
    db.exec(`
      UPDATE wallets SET balance_anchor_at = '2027-01-01 00:00:00' WHERE id IN (1, 2);
    `)

    await request(app)
      .post('/transfers')
      .set('x-user-id', '1')
      .send({ from_wallet_id: 1, to_wallet_id: 2, amount: 30, date: '2026-08-05' })

    const balances = await walletBalances()
    expect(balances.Cash).toBe(80)
    expect(balances.Bank).toBe(0)
  })
})
