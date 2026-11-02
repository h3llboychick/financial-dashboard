import {
  booleanInput,
  boundedString,
  currencyInput,
  dateInput,
  dayOfMonthInput,
  money,
  nameInput,
  objectInput,
  positiveId,
  MAX_NOTE_LENGTH,
} from '../../shared/validation/financialInput.js'

export function makeRecurringController({ recurring_repo, ledger_repo, wallet_repo, category_repo, recurring_service }) {
  function validateRuleInput(body, user_id, { partial = false } = {}) {
    const input = objectInput(body)
    const has = field => Object.hasOwn(input, field)
    const data = {}

    if (!partial || has('name')) data.name = nameInput(input.name)
    if (!partial || has('ledger_id')) data.ledger_id = positiveId(input.ledger_id, 'ledger_id')
    if (!partial || has('wallet_id')) data.wallet_id = positiveId(input.wallet_id, 'wallet_id')
    if (!partial || has('category_id')) data.category_id = positiveId(input.category_id, 'category_id')
    if (!partial || has('amount')) data.amount = money(input.amount, 'amount', { positive: true })
    if (!partial || has('day_of_month')) data.day_of_month = dayOfMonthInput(input.day_of_month)
    if (!partial || has('start_date')) data.start_date = dateInput(input.start_date)
    if (has('note')) data.note = boundedString(input.note, 'note', { max: MAX_NOTE_LENGTH })
    if (has('active')) data.active = booleanInput(input.active, 'active') ? 1 : 0

    const ledger_id = data.ledger_id
    const wallet_id = data.wallet_id
    const category_id = data.category_id

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
    res.json(recurring_repo.list({ user_id }))
  }

  function create(req, res) {
    const user_id = req.user.user_id
    const validated = validateRuleInput(req.body, user_id)
    if (validated.error) return res.status(validated.status).json({ error: validated.error })

    const result = recurring_repo.create({ user_id, ...validated.data })
    res.status(201).json(recurring_repo.find_by_id({ rule_id: result.lastInsertRowid, user_id }))
  }

  function update(req, res) {
    const user_id = req.user.user_id
    const rule_id = positiveId(req.params.id)
    const rule = recurring_repo.find_raw({ rule_id, user_id })
    if (!rule) return res.status(404).json({ error: 'Not found' })

    const body = objectInput(req.body)
    const merged = {
      ...rule,
      ...body,
    }
    const validated = validateRuleInput(merged, user_id)
    if (validated.error) return res.status(validated.status).json({ error: validated.error })

    const changes = { rule_id, user_id }
    for (const field of ['name', 'ledger_id', 'wallet_id', 'category_id', 'amount', 'currency', 'note', 'day_of_month', 'start_date', 'active']) {
      if (Object.hasOwn(validated.data, field)) changes[field] = validated.data[field]
    }

    recurring_repo.update(changes)
    res.json(recurring_repo.find_by_id({ rule_id, user_id }))
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
