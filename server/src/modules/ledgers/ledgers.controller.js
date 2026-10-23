import { LEDGER_TYPES } from '../../shared/constants.js'
import { colorInput, enumInput, nameInput, objectInput, positiveId } from '../../shared/validation/financialInput.js'

export function makeLedgersController({ ledger_repo }) {
    function list(req, res) {
        res.json(ledger_repo.list({ user_id: req.user.user_id }))
    }

    function create(req, res) {
        const body = objectInput(req.body)
        const name = nameInput(body.name)
        const type = enumInput(body.type, LEDGER_TYPES, 'type')
        const color = colorInput(body.color)
        try {
            const user_id = req.user.user_id
            const result = ledger_repo.create({ user_id, name, type, color })
            const ledger = ledger_repo.find_by_id({ ledger_id: result.lastInsertRowid, user_id })
            ledger_repo.seed_categories_for_ledger({ user_id, ledger })
            res.status(201).json(ledger)
        } catch (e) {
            if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'A ledger with this name already exists.' })
            return res.status(500).json({ error: 'Internal server error' })
        }
    }

    function remove(req, res) {
        const user_id = req.user.user_id
        const ledger_id = positiveId(req.params.id)
        const ledger = ledger_repo.find_by_id({ ledger_id, user_id })
        if (!ledger) return res.status(404).json({ error: 'Not found' })
        if (ledger.is_default) return res.status(403).json({ error: 'Default ledgers cannot be deleted.' })
        const { count } = ledger_repo.count_entries({ ledger_id: ledger.id, user_id })
        if (count > 0) return res.status(409).json({ error: `Cannot delete — ${count} entr${count === 1 ? 'y' : 'ies'} use this ledger.` })
        ledger_repo.delete_by_id({ ledger_id: ledger.id, user_id })
        res.status(204).end()
    }
    return { list, create, remove }
}
