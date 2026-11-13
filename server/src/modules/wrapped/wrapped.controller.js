import { integerRangeInput } from '../../shared/validation/financialInput.js'
import { buildWrapped } from './wrapped.service.js'

export function makeWrappedController({ entry_repo, ledger_repo, category_repo, transfer_repo, recurring_repo }) {
  function show(req, res) {
    const user_id = req.user.user_id
    const year = Object.hasOwn(req.query, 'year')
      ? integerRangeInput(req.query.year, { min: 2000, max: 2100 }, 'year')
      : new Date().getUTCFullYear()

    res.json(buildWrapped({
      year,
      entries: entry_repo.list({ user_id }),
      ledgers: ledger_repo.list({ user_id }),
      categories: category_repo.list({ user_id }),
      transfers: transfer_repo.list({ user_id }),
      rules: recurring_repo.list({ user_id }),
    }))
  }

  return { show }
}
