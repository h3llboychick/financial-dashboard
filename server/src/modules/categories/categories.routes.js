import { Router } from 'express'
import { makeCategoriesController } from './categories.controller.js'



export function makeCategoriesRouter(repos) {
    const controller = makeCategoriesController(repos);
    const router = Router()

    /**
     * @openapi
     * /categories:
     *   get:
     *     tags: [Categories]
     *     summary: List categories for the authenticated user
     *     parameters:
     *       - in: query
     *         name: ledger_id
     *         schema:
     *           type: integer
     *         description: Filter categories to a specific ledger
     *     responses:
     *       200:
     *         description: Array of categories
     *         content:
     *           application/json:
     *             example:
     *               - id: 1
     *                 user_id: 1
     *                 ledger_id: 3
     *                 name: Groceries
     *                 color: '#4ade80'
     *                 is_default: 0
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
     * /categories:
     *   post:
     *     tags: [Categories]
     *     summary: Create a new category in a ledger
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [ledger_id, name, color]
     *             properties:
     *               ledger_id:
     *                 type: integer
     *               name:
     *                 type: string
     *               color:
     *                 type: string
     *                 description: Hex color string
     *                 example: '#4ade80'
     *           example:
     *             ledger_id: 3
     *             name: Groceries
     *             color: '#4ade80'
     *     responses:
     *       201:
     *         description: Category created
     *         content:
     *           application/json:
     *             example:
     *               id: 1
     *               user_id: 1
     *               ledger_id: 3
     *               name: Groceries
     *               color: '#4ade80'
     *               is_default: 0
     *       400:
     *         description: Missing required fields
     *         content:
     *           application/json:
     *             example:
     *               error: ledger_id, name, and color are required
     *       404:
     *         description: Ledger not found
     *         content:
     *           application/json:
     *             example:
     *               error: Ledger not found
     *       409:
     *         description: A category with this name already exists in this ledger
     *         content:
     *           application/json:
     *             example:
     *               error: A category with this name already exists in this ledger.
     */
    router.post('/', controller.create)

    /**
     * @openapi
     * /categories/{id}:
     *   delete:
     *     tags: [Categories]
     *     summary: Delete a category by ID
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: ID of the category to delete
     *     responses:
     *       204:
     *         description: Category deleted successfully
     *       403:
     *         description: Category is a default category and cannot be deleted
     *         content:
     *           application/json:
     *             example:
     *               error: Cannot delete default category
     *       404:
     *         description: Category not found
     *         content:
     *           application/json:
     *             example:
     *               error: Not found
     *       409:
     *         description: Category is in use by one or more entries
     *         content:
     *           application/json:
     *             example:
     *               error: Cannot delete — 5 entries use this category.
     */
    router.delete('/:id', controller.remove)

    return router
}
