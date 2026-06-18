import { existsSync, mkdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverRoot = resolve(__dirname, '..')
const args = process.argv.slice(2)

config({ path: join(serverRoot, '.env') })

function readArg(name) {
  const inline = args.find(arg => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)

  const index = args.indexOf(name)
  if (index !== -1) return args[index + 1]

  return null
}

function hasArg(name) {
  return args.includes(name)
}

function setDemoDatabasePath() {
  const requestedDatabase = readArg('--database')
  const useCurrentDatabase = hasArg('--current-db')

  if (requestedDatabase && useCurrentDatabase) {
    throw new Error('Use either --database or --current-db, not both.')
  }

  if (useCurrentDatabase) {
    if (!hasArg('--yes')) {
      throw new Error(
        'Refusing to seed the configured database without --yes. This resets rows for DEV_AUTH_USER_ID.',
      )
    }
    return process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH
  }

  const demoDatabasePath = requestedDatabase
    ? resolve(process.cwd(), requestedDatabase)
    : join(serverRoot, 'demo-screenshot.db')

  process.env.SQLITE_DB_PATH = demoDatabasePath
  process.env.DATABASE_PATH = demoDatabasePath
  return demoDatabasePath
}

function requireAnyEnv(names) {
  const hasValue = names.some(name => process.env[name]?.trim())
  if (!hasValue) {
    throw new Error(`${names.join(' or ')} is required. Generate keys with "npm run secrets:generate --prefix server".`)
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateForMonthOffset(monthOffset, day) {
  const now = new Date()
  const lastSafeCurrentMonthDay = Math.max(1, now.getDate() - 1)
  const safeDay = monthOffset === 0 ? Math.min(day, lastSafeCurrentMonthDay) : day
  return formatDate(new Date(now.getFullYear(), now.getMonth() - monthOffset, safeDay))
}

function byName(rows) {
  return Object.fromEntries(rows.map(row => [row.name, row]))
}

function getRequired(map, name, kind) {
  const value = map[name]
  if (!value) throw new Error(`Missing ${kind}: ${name}`)
  return value
}

process.env.NODE_ENV ||= 'dev'
process.env.DEV_AUTH_USER_ID ||= '1'

const databasePath = setDemoDatabasePath()
requireAnyEnv(['DATABASE_ENCRYPTION_KEY', 'DB_ENCRYPTION_KEY'])
requireAnyEnv(['CREDENTIALS_KEK'])

const userId = Number(process.env.DEV_AUTH_USER_ID)
if (!Number.isFinite(userId) || userId <= 0) {
  throw new Error('DEV_AUTH_USER_ID must be a positive numeric user id.')
}

if (databasePath) {
  const databaseDir = dirname(databasePath)
  if (!existsSync(databaseDir)) mkdirSync(databaseDir, { recursive: true })
}

const [{ db }, { migrator }, { makeUserDefaultsService }] = await Promise.all([
  import('../src/infrastructure/db/connection.js'),
  import('../src/infrastructure/db/migrator.js'),
  import('../src/modules/users/userDefaults.service.js'),
])

await migrator.up()

const resetUserData = db.transaction((seedUserId) => {
  db.prepare('DELETE FROM exchange_credentials WHERE user_id = ?').run(seedUserId)
  db.prepare('DELETE FROM entries WHERE user_id = ?').run(seedUserId)
  db.prepare('DELETE FROM ledger_categories WHERE user_id = ?').run(seedUserId)
  db.prepare('DELETE FROM wallets WHERE user_id = ?').run(seedUserId)
  db.prepare('DELETE FROM ledgers WHERE user_id = ?').run(seedUserId)
  db.prepare('DELETE FROM categories WHERE user_id = ?').run(seedUserId)
})

resetUserData(userId)
makeUserDefaultsService(db).ensureUserDefaults(userId)

const ledgers = byName(db.prepare('SELECT * FROM ledgers WHERE user_id = ?').all(userId))
const ledgerCategories = db.prepare('SELECT * FROM ledger_categories WHERE user_id = ?').all(userId)
const categoriesByLedger = new Map()

for (const category of ledgerCategories) {
  const categories = categoriesByLedger.get(category.ledger_id) || {}
  categories[category.name] = category
  categoriesByLedger.set(category.ledger_id, categories)
}

function categoryFor(ledgerName, categoryName) {
  const ledger = getRequired(ledgers, ledgerName, 'ledger')
  const categories = categoriesByLedger.get(ledger.id) || {}
  return getRequired(categories, categoryName, `${ledgerName} category`)
}

const insertWallet = db.prepare(`
  INSERT INTO wallets (user_id, name, currency, type, initial_balance, balance_anchor_entry_id)
  VALUES (?, ?, ?, ?, ?, 0)
`)

const wallets = {}
for (const wallet of [
  ['Main Checking', 'EUR', 'fiat', 2750],
  ['Everyday Cash', 'EUR', 'fiat', 180],
  ['Savings Buffer', 'EUR', 'fiat', 8400],
  ['Kraken Portfolio', 'EUR', 'exchange', 0],
]) {
  const result = insertWallet.run(userId, ...wallet)
  wallets[wallet[0]] = result.lastInsertRowid
}

const insertEntry = db.prepare(`
  INSERT INTO entries (user_id, ledger_id, category_id, wallet_id, amount, currency, date, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

function addEntry({ ledgerName, categoryName, walletName, amount, monthOffset, day, note }) {
  const ledger = getRequired(ledgers, ledgerName, 'ledger')
  const category = categoryFor(ledgerName, categoryName)
  const walletId = getRequired(wallets, walletName, 'wallet')

  insertEntry.run(
    userId,
    ledger.id,
    category.id,
    walletId,
    amount,
    'EUR',
    dateForMonthOffset(monthOffset, day),
    note,
  )
}

const monthProfiles = [
  { salary: 4100, freelance: 0, rent: 1180, food: 540, transport: 92, shopping: 210, fun: 130, health: 65, travel: 0, invested: 520 },
  { salary: 4100, freelance: 350, rent: 1180, food: 575, transport: 88, shopping: 160, fun: 170, health: 0, travel: 260, invested: 600 },
  { salary: 4200, freelance: 0, rent: 1195, food: 520, transport: 95, shopping: 145, fun: 150, health: 80, travel: 0, invested: 620 },
  { salary: 4200, freelance: 450, rent: 1195, food: 610, transport: 104, shopping: 260, fun: 190, health: 0, travel: 0, invested: 700 },
  { salary: 4200, freelance: 0, rent: 1195, food: 560, transport: 86, shopping: 120, fun: 155, health: 40, travel: 340, invested: 650 },
  { salary: 4200, freelance: 300, rent: 1195, food: 590, transport: 92, shopping: 180, fun: 165, health: 0, travel: 0, invested: 720 },
  { salary: 4300, freelance: 0, rent: 1210, food: 545, transport: 96, shopping: 210, fun: 145, health: 120, travel: 0, invested: 680 },
  { salary: 4300, freelance: 500, rent: 1210, food: 615, transport: 99, shopping: 250, fun: 210, health: 0, travel: 420, invested: 760 },
  { salary: 4300, freelance: 0, rent: 1210, food: 570, transport: 90, shopping: 135, fun: 165, health: 75, travel: 0, invested: 720 },
  { salary: 4400, freelance: 250, rent: 1230, food: 600, transport: 110, shopping: 230, fun: 185, health: 0, travel: 0, invested: 780 },
  { salary: 4400, freelance: 0, rent: 1230, food: 555, transport: 94, shopping: 175, fun: 160, health: 60, travel: 290, invested: 750 },
  { salary: 4400, freelance: 400, rent: 1230, food: 585, transport: 98, shopping: 190, fun: 175, health: 45, travel: 0, invested: 820 },
]

for (const [index, profile] of monthProfiles.entries()) {
  const monthOffset = monthProfiles.length - index - 1

  addEntry({
    ledgerName: 'Earnings',
    categoryName: 'Salary',
    walletName: 'Main Checking',
    amount: profile.salary,
    monthOffset,
    day: 1,
    note: 'Monthly salary',
  })

  if (profile.freelance > 0) {
    addEntry({
      ledgerName: 'Earnings',
      categoryName: 'Freelance',
      walletName: 'Main Checking',
      amount: profile.freelance,
      monthOffset,
      day: 12,
      note: 'Side project invoice',
    })
  }

  for (const expense of [
    ['Housing', profile.rent, 3, 'Rent and utilities'],
    ['Food & Dining', profile.food, 6, 'Groceries and cafes'],
    ['Transport', profile.transport, 8, 'Public transport and rides'],
    ['Shopping', profile.shopping, 14, 'Clothing and household items'],
    ['Entertainment', profile.fun, 18, 'Subscriptions and going out'],
    ['Healthcare', profile.health, 20, 'Health expenses'],
    ['Travel', profile.travel, 24, 'Trip planning'],
  ]) {
    const [categoryName, amount, day, note] = expense
    if (amount <= 0) continue
    addEntry({
      ledgerName: 'Spending',
      categoryName,
      walletName: categoryName === 'Food & Dining' ? 'Everyday Cash' : 'Main Checking',
      amount,
      monthOffset,
      day,
      note,
    })
  }

  addEntry({
    ledgerName: 'Investments',
    categoryName: index % 3 === 0 ? 'Funds' : 'Stocks',
    walletName: 'Main Checking',
    amount: profile.invested,
    monthOffset,
    day: 26,
    note: 'Monthly investment contribution',
  })
}

const counts = {
  entries: db.prepare('SELECT COUNT(*) AS count FROM entries WHERE user_id = ?').get(userId).count,
  wallets: db.prepare('SELECT COUNT(*) AS count FROM wallets WHERE user_id = ?').get(userId).count,
  ledgers: db.prepare('SELECT COUNT(*) AS count FROM ledgers WHERE user_id = ?').get(userId).count,
}
const activeDatabasePath = process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH

console.log(`Seeded demo screenshot data for user ${userId}.`)
console.log(`Database: ${activeDatabasePath}`)
console.log(`Rows: ${counts.entries} entries, ${counts.wallets} wallets, ${counts.ledgers} ledgers.`)
console.log('')
console.log('Start the app against this database with:')
console.log(`SQLITE_DB_PATH="${activeDatabasePath}" DATABASE_PATH="${activeDatabasePath}" NODE_ENV=dev DEV_AUTH_USER_ID=${userId} npm run dev`)
console.log('')
console.log('Capture the dashboard and save it as docs/screenshots/dashboard-demo.png.')

db.close()
