import { integerRangeInput } from '../../shared/validation/financialInput.js'
import { getRatesToTarget } from '../../shared/exchangeRates/ratesProvider.js'
import { buildWrapped, dominantCurrencyForYear } from './wrapped.service.js'

const CURRENCY_CODE = /^[A-Z]{3}$/

export function makeWrappedController({ entry_repo, ledger_repo, category_repo, transfer_repo, recurring_repo, settings_repo }) {
  async function show(req, res) {
    const user_id = req.user.user_id
    const year = Object.hasOwn(req.query, 'year')
      ? integerRangeInput(req.query.year, { min: 2000, max: 2100 }, 'year')
      : new Date().getUTCFullYear()

    const entries = entry_repo.list({ user_id })
    const rules = recurring_repo.list({ user_id })
    const dominant = dominantCurrencyForYear(entries, year)
    const requested = typeof req.query.currency === 'string' ? req.query.currency.trim().toUpperCase() : ''
    // the account currency wins: a query parameter is only an explicit override
    const account = settings_repo.get({ user_id }).currency
    const target = CURRENCY_CODE.test(requested) ? requested : (account ?? dominant)
    // rules carry a currency too, and it has to be converted the same way
    const sources = [...new Set([
      ...entries.map(entry => entry.currency),
      ...rules.map(rule => rule.currency),
    ].filter(Boolean))]

    // A failed provider must not break the report: without rates the entries in
    // other currencies are skipped and counted instead of being mixed in. If the
    // requested currency cannot be reached at all, fall back to the dominant one.
    let currency = target
    let rates = null
    let rates_date = null
    if (target && sources.some(source => source !== target)) {
      try {
        const result = await getRatesToTarget({ target, sources })
        rates = result.rates
        rates_date = result.date
      } catch {
        currency = dominant
        rates = null
      }
    }

    res.json(buildWrapped({
      year,
      currency,
      rates,
      rates_date,
      entries,
      ledgers: ledger_repo.list({ user_id }),
      categories: category_repo.list({ user_id }),
      transfers: transfer_repo.list({ user_id }),
      rules,
    }))
  }

  return { show }
}
