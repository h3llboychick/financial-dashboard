// Isolated worker: all data and cryptographic keys are disposable test fixtures.
import { db } from '../../src/infrastructure/db/connection.js'
import { initializeFinancialData } from './financialData.js'
import { makeWalletRepo } from '../../src/modules/wallets/wallets.repository.js'

initializeFinancialData(db)
makeWalletRepo(db).upsert_exchange_credentials({
  user_id: 1, wallet_id: 2, slug: 'kraken',
  credentials: { api_key: 'fixture-key', api_secret: 'fixture-secret' },
})
db.prepare("UPDATE exchange_credentials SET credentials_tag = 'broken-fixture-tag'").run()
let providerCalls = 0
globalThis.fetch = async () => {
  providerCalls += 1
  throw new Error('External network is disabled in this fixture')
}
const { createApp } = await import('../../src/app.js')
const app = createApp()
app.get('/fixture-stats', (req, res) => res.json({ providerCalls }))
const server = app.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }))
process.on('message', message => {
  if (message === 'stop') server.close(() => { db.close(); process.exit(0) })
})
