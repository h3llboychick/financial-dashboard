import {
  SUPPORTED_CURRENCY_CODES,
} from '../../shared/constants.js'


export function makeEntriesController({ ledger_repo, entry_repo, wallet_repo, category_repo }) {
    function list(req, res) {
        const ledger_id = req.query.ledger_id
        const user_id = req.user.user_id

        if (ledger_id) {
            if (!ledger_repo.find_by_id({ ledger_id, user_id })) {
                return res.status(404).json({ error: 'Ledger not found' })
            }
            return res.json(entry_repo.list_for_ledger({ ledger_id, user_id }))
        }

        res.json(entry_repo.list({ user_id }))
    }

    function create(req, res) {
        const { ledger_id, wallet_id, category_id, amount, currency, date, note} = req.body 
        const user_id = req.user.user_id
        const parsed_amount = Number(amount)
        const normalized_currency = String(currency || 'EUR').trim().toUpperCase()

        if (!ledger_id || !wallet_id || !category_id || !parsed_amount || parsed_amount <= 0 || !date) {
            return res.status(400).json({ error: 'ledger_id, wallet_id, category_id, amount, currency and date are required' })
        }
        if (!SUPPORTED_CURRENCY_CODES.has(normalized_currency)) {
            return res.status(400).json({ error: 'Unsupported currency' })
        }

        const ledger = ledger_repo.find_by_id({ ledger_id, user_id })
        const wallet = wallet_repo.find_by_id({ wallet_id, user_id })
        const category = category_repo.find_by_id({ category_id, user_id })

        if (!ledger) return res.status(404).json({ error: 'Ledger not found' })
        if (!wallet) return res.status(404).json({ error: 'Wallet not found'})
        if (!category) return res.status(404).json({ error: 'Category not found'})
        if (category.ledger_id !== ledger.id) {
            return res.status(400).json({ error: 'category_id must belong to ledger_id' })
        }

        const result = entry_repo.create({
            ledger_id: ledger.id,
            category_id: category.id,
            wallet_id: wallet.id,
            user_id,
            amount: parsed_amount,
            currency: normalized_currency,
            date,
            note: note || '',
        })
        res.status(201).json(entry_repo.find_with_details({ entry_id: result.lastInsertRowid, user_id }))
    }


    function remove(req, res) {
        const user_id = req.user.user_id
        const entry_id = req.params.id

        const entry = entry_repo.find_by_id({ entry_id, user_id })
        if (!entry) return res.status(404).json({ error: 'Not found' })

        entry_repo.delete_by_id({ entry_id, user_id })
        res.status(204).end()
    }

    return { list, create, remove }
}
