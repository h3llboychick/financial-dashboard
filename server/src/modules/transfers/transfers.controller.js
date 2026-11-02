import { boundedString, dateInput, money, objectInput, positiveId, MAX_NOTE_LENGTH } from '../../shared/validation/financialInput.js'

export function makeTransfersController({ transfer_repo, wallet_repo }) {
  function list(req, res) {
    const user_id = req.user.user_id
    res.json(transfer_repo.list({ user_id }))
  }

  function create(req, res) {
    const user_id = req.user.user_id
    const body = objectInput(req.body)
    const from_wallet_id = positiveId(body.from_wallet_id, 'from_wallet_id')
    const to_wallet_id = positiveId(body.to_wallet_id, 'to_wallet_id')
    const amount = money(body.amount, 'amount', { positive: true })
    const date = dateInput(body.date)
    const note = Object.hasOwn(body, 'note') ? boundedString(body.note, 'note', { max: MAX_NOTE_LENGTH }) : ''

    if (from_wallet_id === to_wallet_id) {
      return res.status(400).json({ error: 'A transfer needs two different wallets' })
    }

    const source = wallet_repo.find_by_id({ wallet_id: from_wallet_id, user_id })
    const target = wallet_repo.find_by_id({ wallet_id: to_wallet_id, user_id })
    if (!source || !target) return res.status(404).json({ error: 'Not found' })

    if (source.type !== 'fiat' || target.type !== 'fiat') {
      return res.status(400).json({ error: 'Transfers are only supported between fiat wallets' })
    }
    if (source.currency !== target.currency) {
      return res.status(400).json({ error: 'Both wallets must use the same currency' })
    }

    const result = transfer_repo.create({
      user_id,
      from_wallet_id,
      to_wallet_id,
      amount,
      currency: source.currency,
      date,
      note,
    })

    res.status(201).json(transfer_repo.find_by_id({ transfer_id: result.lastInsertRowid, user_id }))
  }

  function remove(req, res) {
    const user_id = req.user.user_id
    const transfer_id = positiveId(req.params.id)
    const transfer = transfer_repo.find_by_id({ transfer_id, user_id })
    if (!transfer) return res.status(404).json({ error: 'Not found' })

    transfer_repo.delete_by_id({ transfer_id, user_id })
    res.status(204).end()
  }

  return { list, create, remove }
}
