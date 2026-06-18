import { Router } from 'express'
import { makeLedgersController} from './ledgers.controller.js'


export function makeLedgersRouter(repos) {
    const controller = makeLedgersController(repos)
    const router = Router()

    /**
     * @openapi
     * /ledgers:
     *   get:
     *     tags: [Ledgers]
     *     summary: List all ledgers for the authenticated user
     *     responses:
     *       200:
     *         description: Array of ledgers
     *         content:
     *           application/json:
     *             example:
     *               - id: 1
     *                 user_id: 1
     *                 name: Personal
     *                 type: expense
     *                 color: '#4ade80'
     *                 is_default: 1
     *                 created_at: '2026-01-01T00:00:00.000Z'
     */
    router.get('/', controller.list)

    /**
     * @openapi
     * /ledgers:
     *   post:
     *     tags: [Ledgers]
     *     summary: Create a new ledger
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name, type, color]
     *             properties:
     *               name:
     *                 type: string
     *               type:
     *                 type: string
     *                 enum: [expense, income, investment]
     *               color:
     *                 type: string
     *                 description: Hex color string
     *                 example: '#4ade80'
     *           example:
     *             name: Personal
     *             type: expense
     *             color: '#4ade80'
     *     responses:
     *       201:
     *         description: Ledger created
     *         content:
     *           application/json:
     *             example:
     *               id: 1
     *               user_id: 1
     *               name: Personal
     *               type: expense
     *               color: '#4ade80'
     *               is_default: 0
     *               created_at: '2026-06-11T00:00:00.000Z'
     *       400:
     *         description: Missing or invalid fields
     *         content:
     *           application/json:
     *             example:
     *               error: name, type, and color are required
     *       409:
     *         description: A ledger with this name already exists
     *         content:
     *           application/json:
     *             example:
     *               error: A ledger with this name already exists.
     */
    router.post('/', controller.create)

    /**
     * @openapi
     * /ledgers/{id}:
     *   delete:
     *     tags: [Ledgers]
     *     summary: Delete a ledger by ID
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: ID of the ledger to delete
     *     responses:
     *       204:
     *         description: Ledger deleted successfully
     *       403:
     *         description: Ledger is a default ledger and cannot be deleted
     *         content:
     *           application/json:
     *             example:
     *               error: Default ledgers cannot be deleted.
     *       404:
     *         description: Ledger not found
     *         content:
     *           application/json:
     *             example:
     *               error: Not found
     *       409:
     *         description: Ledger is in use by one or more entries
     *         content:
     *           application/json:
     *             example:
     *               error: Cannot delete — 5 entries use this ledger.
     */
    router.delete('/:id', controller.remove)

    return router
}
