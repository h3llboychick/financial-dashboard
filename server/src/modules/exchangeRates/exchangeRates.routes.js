import { Router } from 'express'
import { asyncHandler } from '../../shared/middleware/asyncHandler.js'
import { rateQueryInput } from '../../shared/validation/financialInput.js'

const FRANKFURTER_RATES_URL = 'https://api.frankfurter.dev/v2/rates'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const cache = new Map()

export function makeExchangeRatesRouter() {
  const router = Router()
  /**
   * @openapi
   * /exchange-rates:
   *   get:
   *     tags: [Exchange Rates]
   *     summary: Convert supported currencies to a target currency
   *     parameters:
   *       - in: query
   *         name: target
   *         schema:
   *           $ref: '#/components/schemas/FinancialCurrency'
   *         description: Defaults to EUR. Supply a single string, not nested or repeated parameters.
   *       - in: query
   *         name: sources
   *         schema:
   *           type: string
   *           example: EUR,USD
   *         description: Comma-separated supported currencies. Omitted or empty means no sources. Nested or repeated parameters are rejected.
   *     responses:
   *       200:
   *         description: Target, inverse provider rates, and provider date
   *       400:
   *         description: Malformed query or unsupported currency
   *       502:
   *         description: Provider failed or returned invalid rates
   */
  router.get('/', asyncHandler(async (req, res) => {
    const { target, sources } = rateQueryInput(req.query)

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
        rows.map(row => [String(row.quote).trim().toUpperCase(), Number(row.rate)]),
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
  }))

  return router;
}
