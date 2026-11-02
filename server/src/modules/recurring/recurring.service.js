import { dueOccurrences } from './schedule.js'

function isoToday(now) {
  return now.toISOString().slice(0, 10)
}

/**
 * Turns due recurring rules into entries. Safe to call as often as you like:
 * each rule claims its occurrence range inside a transaction, so a second call
 * (or a second process) finds nothing left to do.
 */
export function makeRecurringService({ db, recurring_repo, entry_repo, today = () => new Date() }) {
  function run_due({ user_id = null, now = today(), limit = 12 } = {}) {
    const until = isoToday(now)
    const rules = recurring_repo.list_active({ user_id, until })
    const created = []

    const run = db.transaction(() => {
      for (const rule of rules) {
        const dates = dueOccurrences({
          dayOfMonth: rule.day_of_month,
          startDate: rule.start_date,
          after: rule.last_generated_on,
          until,
          limit,
        })
        if (dates.length === 0) continue

        const claimed = recurring_repo.claim_until({
          rule_id: rule.id,
          user_id: rule.user_id,
          date: dates[dates.length - 1],
        })
        if (!claimed) continue

        for (const date of dates) {
          entry_repo.create({
            user_id: rule.user_id,
            ledger_id: rule.ledger_id,
            wallet_id: rule.wallet_id,
            category_id: rule.category_id,
            amount: rule.amount,
            currency: rule.currency,
            date,
            note: rule.note || rule.name,
          })
          created.push({ rule_id: rule.id, date })
        }
      }
    })

    run()

    return {
      rules_checked: rules.length,
      entries_created: created.length,
      occurrences: created,
    }
  }

  return { run_due }
}
