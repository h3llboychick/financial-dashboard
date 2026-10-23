import { colorInput, nameInput, objectInput, positiveId } from '../../shared/validation/financialInput.js'

export function makeCategoriesController({ category_repo, ledger_repo }) {
    function list(req, res) {
        const user_id = req.user.user_id
        if (Object.hasOwn(req.query, 'ledger_id')) {
            const ledger_id = positiveId(req.query.ledger_id, 'ledger_id')
            if (!ledger_repo.find_by_id({ ledger_id, user_id })) return res.status(404).json({ error: 'Ledger not found' })
            return res.json(category_repo.list_for_ledger({ user_id, ledger_id }))
        }
        res.json(category_repo.list({ user_id }))
    }

    function create(req, res) {
        const body = objectInput(req.body)
        const ledger_id = positiveId(body.ledger_id, 'ledger_id')
        const name = nameInput(body.name)
        const color = colorInput(body.color)
        const user_id = req.user.user_id
        const ledger = ledger_repo.find_by_id({ ledger_id, user_id })
        if (!ledger) return res.status(404).json({ error: 'Ledger not found' })
        try {
            const result = category_repo.create({ user_id, ledger_id: ledger.id, name, color })
            res.status(201).json(category_repo.find_by_id({ category_id: result.lastInsertRowid, user_id }))
        } catch (e) {
            if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'A category with this name already exists in this ledger.' })
            return res.status(500).json({ error: 'Internal server error'})
        }
    }

    function remove(req, res) {
        const user_id = req.user.user_id
        const category_id = positiveId(req.params.id)
        const cat = category_repo.find_by_id({ category_id, user_id })
        if (!cat) return res.status(404).json({ error: 'Not found' })
        if (cat.is_default) return res.status(403).json({ error: 'Cannot delete default category' })
        const { count } = category_repo.count_entries({ category_id: cat.id, user_id })
        if (count > 0) return res.status(409).json({ error: `Cannot delete — ${count} entr${count === 1 ? 'y' : 'ies'} use this category.` })
        category_repo.delete_by_id({ category_id: cat.id, user_id })
        res.status(204).end()
    }
    return { list, create, remove }
}
