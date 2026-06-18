import { Router } from 'express'
import { SUPPORTED_CURRENCY_CODES } from '../../shared/constants.js'

const FRANKFURTER_RATES_URL = 'https://api.frankfurter.dev/v2/rates'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const cache = new Map()

function normalizeCurrency(value) {
  return String(value || '').trim().toUpperCase()
}

function parseSources(value) {
  return String(value || '')
    .split(',')
    .map(normalizeCurrency)
    .filter(Boolean)
}

function validateCurrency(code) {
  return /^[A-Z]{3}$/.test(code) && SUPPORTED_CURRENCY_CODES.has(code)
}

export function makeExchangeRatesRouter() {
  const router = Router()
  router.get('/', async (req, res) => {
    const target = normalizeCurrency(req.query.target || 'EUR')
    const sources = [...new Set(parseSources(req.query.sources))]

    if (!validateCurrency(target) || sources.some(source => !validateCurrency(source))) {
      return res.status(400).json({ error: 'Unsupported currency' })
    }

    const neededSources = sources.filter(source => source !== target).sort()
    if (neededSources.length === 0) {
      return res.json({
        target,
        rates: Object.fromEntries(sources.map(source => [source, 1])),
        date: null,
      })
    }

    const cacheKey = `${target}:${neededSources.join(',')}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.json({
        target,
        rates: { ...Object.fromEntries(sources.map(source => [source, 1])), ...cached.rates },
        date: cached.date,
      })
    }

    try {
      const url = new URL(FRANKFURTER_RATES_URL)
      url.searchParams.set('base', target)
      url.searchParams.set('quotes', neededSources.join(','))

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Frankfurter request failed with status ${response.status}`)
      }

      const rows = await response.json()
      const targetToSourceRates = Object.fromEntries(
        rows.map(row => [normalizeCurrency(row.quote), Number(row.rate)]),
      )

      const rates = Object.fromEntries(sources.map(source => [source, 1]))
      for (const source of neededSources) {
        const rate = targetToSourceRates[source]
        if (!Number.isFinite(rate) || rate <= 0) {
          throw new Error(`Missing exchange rate for ${source}`)
        }
        rates[source] = 1 / rate
      }

      const date = rows[0]?.date ?? null
      cache.set(cacheKey, { rates, date, fetchedAt: Date.now() })
      res.json({ target, rates, date })
    } catch (error) {
      res.status(502).json({ error: error.message || 'Failed to fetch exchange rates' })
    }
  })

  return router;
}
