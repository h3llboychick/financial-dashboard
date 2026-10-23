import { entryInput, positiveId } from '../../shared/validation/financialInput.js'

export function makeEntriesController({ ledger_repo, entry_repo, wallet_repo, category_repo }) {
    function validateEntryInput(body, user_id) {
        const input = entryInput(body)
        const ledger = ledger_repo.find_by_id({ ledger_id: input.ledger_id, user_id })
        const wallet = wallet_repo.find_by_id({ wallet_id: input.wallet_id, user_id })
        const category = category_repo.find_by_id({ category_id: input.category_id, user_id })

        if (!ledger) return { status: 404, error: 'Ledger not found' }
        if (!wallet) return { status: 404, error: 'Wallet not found' }
        if (!category) return { status: 404, error: 'Category not found' }
        if (category.ledger_id !== ledger.id) return { status: 400, error: 'category_id must belong to ledger_id' }
        return { data: { ...input, user_id } }
    }

    function list(req, res) {
        const user_id = req.user.user_id
        if (Object.hasOwn(req.query, 'ledger_id')) {
            const ledger_id = positiveId(req.query.ledger_id, 'ledger_id')
            if (!ledger_repo.find_by_id({ ledger_id, user_id })) return res.status(404).json({ error: 'Ledger not found' })
            return res.json(entry_repo.list_for_ledger({ ledger_id, user_id }))
        }
        res.json(entry_repo.list({ user_id }))
    }

    function create(req, res) {
        const user_id = req.user.user_id
        const validated = validateEntryInput(req.body, user_id)
        if (validated.error) return res.status(validated.status).json({ error: validated.error })
        const result = entry_repo.create(validated.data)
        res.status(201).json(entry_repo.find_with_details({ entry_id: result.lastInsertRowid, user_id }))
    }

    function update(req, res) {
        const user_id = req.user.user_id
        const entry_id = positiveId(req.params.id)
        const entry = entry_repo.find_by_id({ entry_id, user_id })
        if (!entry) return res.status(404).json({ error: 'Not found' })
        const validated = validateEntryInput(req.body, user_id)
        if (validated.error) return res.status(validated.status).json({ error: validated.error })
        entry_repo.update({ entry_id: entry.id, ...validated.data })
        res.json(entry_repo.find_with_details({ entry_id: entry.id, user_id }))
    }

    function remove(req, res) {
        const user_id = req.user.user_id
        const entry_id = positiveId(req.params.id)
        const entry = entry_repo.find_by_id({ entry_id, user_id })
        if (!entry) return res.status(404).json({ error: 'Not found' })
        entry_repo.delete_by_id({ entry_id, user_id })
        res.status(204).end()
    }
    return { list, create, update, remove }
}
