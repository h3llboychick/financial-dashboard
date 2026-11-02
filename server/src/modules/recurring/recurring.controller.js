import {
  booleanInput,
  boundedString,
  currencyInput,
  dateInput,
  dayOfMonthInput,
  enumInput,
  integerRangeInput,
  money,
  nameInput,
  objectInput,
  positiveId,
  MAX_NOTE_LENGTH,
} from '../../shared/validation/financialInput.js'
import { nextOccurrenceAfter, scheduleLabel } from './schedule.js'

const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'yearly'])
const USES_MONTH_DAY = new Set(['monthly', 'yearly'])

function decorate(rule) {
  if (!rule) return rule
  return {
    ...rule,
    schedule: scheduleLabel(rule),
    next_occurrence: nextOccurrenceAfter(rule, rule.last_generated_on ?? null),
  }
}

export function makeRecurringController({ recurring_repo, ledger_repo, wallet_repo, category_repo, recurring_service }) {
  function validateRuleInput(body, user_id, { partial = false, stored = null } = {}) {
    const input = objectInput(body)
    const has = field => Object.hasOwn(input, field)
    const current = stored ?? {}
    const data = {}

    if (!partial || has('name')) data.name = nameInput(input.name)
    if (!partial || has('ledger_id')) data.ledger_id = positiveId(input.ledger_id, 'ledger_id')
    if (!partial || has('wallet_id')) data.wallet_id = positiveId(input.wallet_id, 'wallet_id')
    if (!partial || has('category_id')) data.category_id = positiveId(input.category_id, 'category_id')
    if (!partial || has('amount')) data.amount = money(input.amount, 'amount', { positive: true })
    if (!partial || has('start_date')) data.start_date = dateInput(input.start_date)
    if (has('note')) data.note = boundedString(input.note, 'note', { max: MAX_NOTE_LENGTH })
    if (has('active')) data.active = booleanInput(input.active, 'active') ? 1 : 0

    const frequency = has('frequency')
      ? enumInput(input.frequency, FREQUENCIES, 'frequency')
      : (current.frequency ?? 'monthly')
    if (!partial || has('frequency')) data.frequency = frequency

    const interval = has('interval_count')
      ? integerRangeInput(input.interval_count, { min: 1, max: 365 }, 'interval_count')
      : (current.interval_count ?? 1)
    if (!partial || has('interval_count')) data.interval_count = interval

    const lastDay = has('last_day') ? booleanInput(input.last_day, 'last_day') : current.last_day === 1
    if (!partial || has('last_day')) data.last_day = lastDay ? 1 : 0

    if (has('day_of_month')) {
      data.day_of_month = dayOfMonthInput(input.day_of_month)
    } else if (!partial) {
      if (lastDay) data.day_of_month = 31
      else if (USES_MONTH_DAY.has(frequency)) {
        return { status: 400, error: 'day_of_month is required unless the rule uses the last day of the month' }
      } else {
        data.day_of_month = 1
      }
    }

    if (frequency === 'weekly') {
      const weekday = has('weekday')
        ? integerRangeInput(input.weekday, { min: 0, max: 6 }, 'weekday')
        : current.weekday
      if (weekday === null || weekday === undefined) {
        return { status: 400, error: 'weekday is required for weekly rules (0 is Sunday)' }
      }
      if (has('weekday') || !partial) data.weekday = weekday
    }

    if (frequency === 'yearly') {
      const monthOfYear = has('month_of_year')
        ? integerRangeInput(input.month_of_year, { min: 1, max: 12 }, 'month_of_year')
        : current.month_of_year
      if (monthOfYear === null || monthOfYear === undefined) {
        return { status: 400, error: 'month_of_year is required for yearly rules' }
      }
      if (has('month_of_year') || !partial) data.month_of_year = monthOfYear
    }

    const ledger_id = data.ledger_id ?? current.ledger_id
    const wallet_id = data.wallet_id ?? current.wallet_id
    const category_id = data.category_id ?? current.category_id

    if (ledger_id !== undefined) {
      if (!ledger_repo.find_by_id({ ledger_id, user_id })) return { status: 404, error: 'Ledger not found' }
    }
    if (wallet_id !== undefined) {
      const wallet = wallet_repo.find_by_id({ wallet_id, user_id })
      if (!wallet) return { status: 404, error: 'Wallet not found' }
      if (wallet.type !== 'fiat') return { status: 400, error: 'A recurring rule needs a fiat wallet' }
      const currency = has('currency') ? currencyInput(input.currency) : wallet.currency
      if (currency !== wallet.currency) return { status: 400, error: 'Rule currency must match the wallet currency' }
      data.currency = currency
    }
    if (category_id !== undefined) {
      const category = category_repo.find_by_id({ category_id, user_id })
      if (!category) return { status: 404, error: 'Category not found' }
      if (ledger_id !== undefined && category.ledger_id !== ledger_id) {
        return { status: 400, error: 'category_id must belong to ledger_id' }
      }
    }

    return { data }
  }

  function list(req, res) {
    const user_id = req.user.user_id
    recurring_service?.run_due({ user_id })
    res.json(recurring_repo.list({ user_id }).map(decorate))
  }

  function create(req, res) {
    const user_id = req.user.user_id
    const validated = validateRuleInput(req.body, user_id)
    if (validated.error) return res.status(validated.status).json({ error: validated.error })

    const result = recurring_repo.create({ user_id, ...validated.data })
    res.status(201).json(decorate(recurring_repo.find_by_id({ rule_id: result.lastInsertRowid, user_id })))
  }

  function update(req, res) {
    const user_id = req.user.user_id
    const rule_id = positiveId(req.params.id)
    const rule = recurring_repo.find_raw({ rule_id, user_id })
    if (!rule) return res.status(404).json({ error: 'Not found' })

    const validated = validateRuleInput(req.body, user_id, { partial: true, stored: rule })
    if (validated.error) return res.status(validated.status).json({ error: validated.error })

    const changes = { rule_id, user_id }
    const editable = [
      'name', 'ledger_id', 'wallet_id', 'category_id', 'amount', 'currency', 'note',
      'frequency', 'interval_count', 'day_of_month', 'last_day', 'weekday', 'month_of_year',
      'start_date', 'active',
    ]
    for (const field of editable) {
      if (Object.hasOwn(validated.data, field)) changes[field] = validated.data[field]
    }

    recurring_repo.update(changes)
    res.json(decorate(recurring_repo.find_by_id({ rule_id, user_id })))
  }

  function remove(req, res) {
    const user_id = req.user.user_id
    const rule_id = positiveId(req.params.id)
    const rule = recurring_repo.find_raw({ rule_id, user_id })
    if (!rule) return res.status(404).json({ error: 'Not found' })

    recurring_repo.delete_by_id({ rule_id, user_id })
    res.status(204).end()
  }

  function run(req, res) {
    const user_id = req.user.user_id
    res.json(recurring_service.run_due({ user_id }))
  }

  return { list, create, update, remove, run }
}
