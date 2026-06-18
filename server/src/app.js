import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import morgan from 'morgan'
import pino from 'pino'
import swaggerUi from 'swagger-ui-express'

import { swaggerSpecification } from './config/swagger.js'
import { db } from './infrastructure/db/connection.js'
import { makeAuthRouter } from './modules/auth/auth.routes.js'
import { makeCategoriesRouter } from './modules/categories/categories.routes.js'
import { makeCategoryRepo } from './modules/categories/categories.repository.js'
import { makeEntriesRouter } from './modules/entries/entries.routes.js'
import { makeEntryRepo } from './modules/entries/entries.repository.js'
import { makeExchangeRatesRouter } from './modules/exchangeRates/exchangeRates.routes.js'
import { makeExchangesRouter } from './modules/exchanges/exchanges.routes.js'
import { makeLedgersRouter } from './modules/ledgers/ledgers.routes.js'
import { makeLedgerRepo } from './modules/ledgers/ledgers.repository.js'
import { makeWalletsRouter } from './modules/wallets/wallets.routes.js'
import { makeWalletRepo } from './modules/wallets/wallets.repository.js'
import { requireAuth, requireAuthDev } from './shared/middleware/authMiddleware.js'
import { makeUserDefaultsService } from './modules/users/userDefaults.service.js'

const currentFile = fileURLToPath(import.meta.url)
const __dirname = dirname(currentFile)

export const logger = pino()

function getDevAuthUserId() {
  const user_id = Number(process.env.DEV_AUTH_USER_ID)
  if (!user_id || !Number.isFinite(user_id)) {
    throw new Error('DEV_AUTH_USER_ID must be set to a numeric Telegram user ID in dev mode.')
  }
  return user_id
}

export function createApp() {
  const app = express()
  const repos = {
    category_repo: makeCategoryRepo(db),
    ledger_repo: makeLedgerRepo(db),
    entry_repo: makeEntryRepo(db),
    wallet_repo: makeWalletRepo(db),
  }

  const services = {
    userDefaultsService: makeUserDefaultsService(db)
  }
  const isDev = process.env.NODE_ENV === 'dev'
  const devUserId = isDev ? getDevAuthUserId() : null

  app.use(cors())
  app.use(express.json())
  app.use(morgan('combined'))
  app.use('/api', isDev ? requireAuthDev : requireAuth)

  app.use('/api/auth', makeAuthRouter(services))
  app.use('/api/ledgers', makeLedgersRouter(repos))
  app.use('/api/entries', makeEntriesRouter(repos))
  app.use('/api/categories', makeCategoriesRouter(repos))
  app.use('/api/wallets', makeWalletsRouter(repos))
  app.use('/api/exchange-rates', makeExchangeRatesRouter())
  app.use('/api/exchanges', makeExchangesRouter())
  app.get('/api/config', (req, res) => {
    res.json({
      bot_name: process.env.TELEGRAM_BOT_NAME,
    })
  })

  if (isDev) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecification))
    services.userDefaultsService.ensureUserDefaults(devUserId)
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, '../../client/dist')))
    app.get('*', (req, res) => {
      res.sendFile(join(__dirname, '../../client/dist/index.html'))
    })
  }

  return app
}
