import { Router } from 'express'
import { asyncHandler } from '../../shared/middleware/asyncHandler.js'
import { rateQueryInput } from '../../shared/validation/financialInput.js'
import { getRatesToTarget } from '../../shared/exchangeRates/ratesProvider.js'

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

    try {
      const { rates, date } = await getRatesToTarget({ target, sources })
      res.json({ target, rates, date })
    } catch (error) {
      res.status(502).json({ error: error.message || 'Failed to fetch exchange rates' })
    }
  }))

  return router;
}
