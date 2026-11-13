import { describe, expect, test } from '@jest/globals'
import Database from 'better-sqlite3-multiple-ciphers'
import express from 'express'
import request from 'supertest'
import { up } from '../src/infrastructure/db/migrations/008_user_settings.js'
import { makeSettingsRepo } from '../src/modules/settings/settings.repository.js'
import { makeSettingsRouter } from '../src/modules/settings/settings.routes.js'

function makeApp() {
  const db = new Database(':memory:')
  up({ context: db })
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    req.user = { user_id: 1 }
    next()
  })
  app.use('/settings', makeSettingsRouter({ settings_repo: makeSettingsRepo(db) }))
  return { app, db }
}

describe('account settings', () => {
  test('defaults to EUR for a user who never chose one', async () => {
    const { app } = makeApp()

    const response = await request(app).get('/settings')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ currency: 'EUR' })
  })

  test('stores the chosen currency per user', async () => {
    const { app, db } = makeApp()

    const saved = await request(app).put('/settings').send({ currency: 'USD' })

    expect(saved.status).toBe(200)
    expect(saved.body).toEqual({ currency: 'USD' })
    expect((await request(app).get('/settings')).body.currency).toBe('USD')
    expect(db.prepare('SELECT COUNT(*) as count FROM user_settings').get().count).toBe(1)
  })

  test('replaces the currency instead of adding a row', async () => {
    const { app, db } = makeApp()

    await request(app).put('/settings').send({ currency: 'USD' })
    await request(app).put('/settings').send({ currency: 'KZT' })

    expect((await request(app).get('/settings')).body.currency).toBe('KZT')
    expect(db.prepare('SELECT COUNT(*) as count FROM user_settings').get().count).toBe(1)
  })

  test('rejects a currency the app does not support', async () => {
    const { app } = makeApp()

    const response = await request(app).put('/settings').send({ currency: 'XYZ' })

    expect(response.status).toBe(400)
  })
})
