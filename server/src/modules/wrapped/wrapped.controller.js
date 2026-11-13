import { integerRangeInput } from '../../shared/validation/financialInput.js'
import { getRatesToTarget } from '../../shared/exchangeRates/ratesProvider.js'
import { buildWrapped, dominantCurrencyForYear } from './wrapped.service.js'

export function makeWrappedController({ entry_repo, ledger_repo, category_repo, transfer_repo, recurring_repo }) {
  async function show(req, res) {
    const user_id = req.user.user_id
    const year = Object.hasOwn(req.query, 'year')
      ? integerRangeInput(req.query.year, { min: 2000, max: 2100 }, 'year')
      : new Date().getUTCFullYear()

    const entries = entry_repo.list({ user_id })
    const currency = dominantCurrencyForYear(entries, year)
    const sources = [...new Set(entries.map(entry => entry.currency))]

    // A failed provider must not break the report: without rates the foreign
    // entries are skipped and counted instead of being mixed in.
    let rates = null
    let rates_date = null
    if (currency && sources.length > 1) {
      try {
        const result = await getRatesToTarget({ target: currency, sources })
        rates = result.rates
        rates_date = result.date
      } catch {
        rates = null
      }
    }

    res.json(buildWrapped({
      year,
      rates,
      rates_date,
      entries,
      ledgers: ledger_repo.list({ user_id }),
      categories: category_repo.list({ user_id }),
      transfers: transfer_repo.list({ user_id }),
      rules: recurring_repo.list({ user_id }),
    }))
  }

  return { show }
}
