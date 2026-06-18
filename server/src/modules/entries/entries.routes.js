import { Router } from 'express'
import { makeEntriesController } from './entries.controller.js'



export function makeEntriesRouter(repos) {
    const controller = makeEntriesController(repos)
    const router = Router()

    /**
     * @openapi
     * /entries:
     *   get:
     *     tags: [Entries]
     *     summary: List all entries for the authenticated user
     *     parameters:
     *       - in: query
     *         name: ledger_id
     *         schema:
     *           type: integer
     *         description: Filter entries to a specific ledger
     *     responses:
     *       200:
     *         description: Array of entries
     *         content:
     *           application/json:
     *             example:
     *               - id: 10
     *                 user_id: 1
     *                 ledger_id: 3
     *                 wallet_id: 2
     *                 amount: 49.99
     *                 currency: EUR
     *                 category_id: 4
     *                 category_name: Groceries
     *                 category_color: '#4ade80'
     *                 date: '2026-06-10'
     *                 note: Weekly shop
     *                 created_at: '2026-06-10T08:30:00.000Z'
     *                 ledger_name: Personal
     *                 ledger_type: expense
     *                 ledger_color: '#4ade80'
     *       404:
     *         description: Ledger not found
     *         content:
     *           application/json:
     *             example:
     *               error: Ledger not found
     */
    router.get('/', controller.list)

    /**
     * @openapi
     * /entries:
     *   post:
     *     tags: [Entries]
     *     summary: Create a new entry
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [ledger_id, wallet_id, amount, currency, category_id, date]
     *             properties:
     *               ledger_id:
     *                 type: integer
     *               wallet_id:
     *                 type: integer
     *               amount:
     *                 type: number
     *                 minimum: 0.01
     *               currency:
     *                 type: string
     *                 example: EUR
     *               category_id:
     *                 type: integer
     *               date:
     *                 type: string
     *                 format: date
     *               note:
     *                 type: string
     *           example:
     *             ledger_id: 3
     *             wallet_id: 2
     *             amount: 49.99
     *             currency: EUR
     *             category_id: 4
     *             date: '2026-06-10'
     *             note: Weekly shop
     *     responses:
     *       201:
     *         description: Entry created
     *         content:
     *           application/json:
     *             example:
     *               id: 10
     *               user_id: 1
     *               ledger_id: 3
     *               wallet_id: 2
     *               amount: 49.99
     *               currency: EUR
     *               category_id: 4
     *               category_name: Groceries
     *               category_color: '#4ade80'
     *               date: '2026-06-10'
     *               note: Weekly shop
     *               created_at: '2026-06-10T08:30:00.000Z'
     *               ledger_name: Personal
     *               ledger_type: expense
     *               ledger_color: '#4ade80'
     *       400:
     *         description: Missing or invalid fields
     *         content:
     *           application/json:
     *             example:
     *               error: ledger_id, wallet_id, category_id, amount, currency and date are required
     *       404:
     *         description: Ledger, wallet, or category not found
     *         content:
     *           application/json:
     *             example:
     *               error: Ledger not found
     */
    router.post('/', controller.create)

    /**
     * @openapi
     * /entries/{id}:
     *   delete:
     *     tags: [Entries]
     *     summary: Delete an entry by ID
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: ID of the entry to delete
     *     responses:
     *       204:
     *         description: Entry deleted successfully
     *       404:
     *         description: Entry not found
     *         content:
     *           application/json:
     *             example:
     *               error: Not found
     */
    router.delete('/:id', controller.remove)

    return router
}
