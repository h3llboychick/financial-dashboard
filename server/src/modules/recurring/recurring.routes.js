import { Router } from 'express'
import { makeRecurringController } from './recurring.controller.js'

export function makeRecurringRouter(repos) {
    const controller = makeRecurringController(repos)
    const router = Router()

    /**
     * @openapi
     * /recurring:
     *   get:
     *     tags: [Recurring]
     *     summary: List recurring payment rules
     *     description: >
     *       Listing also materialises any rule whose day has already arrived,
     *       so opening the app is enough to catch up on missed occurrences.
     *     responses:
     *       200:
     *         description: Rules with ledger, wallet and category names
     *         content:
     *           application/json:
     *             example:
     *               - id: 1
     *                 name: Scholarship
     *                 ledger_id: 2
     *                 ledger_name: Earnings
     *                 ledger_type: income
     *                 wallet_id: 1
     *                 wallet_name: Bank
     *                 category_id: 5
     *                 category_name: Scholarship
     *                 amount: 500
     *                 currency: EUR
     *                 day_of_month: 28
     *                 start_date: '2026-09-01'
     *                 active: 1
     *                 last_generated_on: '2026-10-28'
     */
    router.get('/', controller.list)

    /**
     * @openapi
     * /recurring:
     *   post:
     *     tags: [Recurring]
     *     summary: Create a monthly recurring payment rule
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name, ledger_id, wallet_id, category_id, amount, day_of_month, start_date]
     *             properties:
     *               name:
     *                 $ref: '#/components/schemas/FinancialName'
     *               ledger_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               wallet_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               category_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               amount:
     *                 $ref: '#/components/schemas/FinancialAmount'
     *               day_of_month:
     *                 type: integer
     *                 minimum: 1
     *                 maximum: 31
     *               start_date:
     *                 type: string
     *                 example: '2026-09-01'
     *               note:
     *                 type: string
     *                 maxLength: 2000
     *     responses:
     *       201:
     *         description: Rule created
     *       400:
     *         description: Invalid fields, non-fiat wallet, currency mismatch, or category from another ledger
     *       404:
     *         description: Ledger, wallet or category not found
     */
    router.post('/', controller.create)

    /**
     * @openapi
     * /recurring/run:
     *   post:
     *     tags: [Recurring]
     *     summary: Materialise due occurrences now
     *     description: Same work the hourly timer does, callable on demand.
     *     responses:
     *       200:
     *         description: How many rules were checked and how many entries were created
     *         content:
     *           application/json:
     *             example:
     *               rules_checked: 3
     *               entries_created: 1
     *               occurrences:
     *                 - rule_id: 1
     *                   date: '2026-11-28'
     */
    router.post('/run', controller.run)

    /**
     * @openapi
     * /recurring/{id}:
     *   patch:
     *     tags: [Recurring]
     *     summary: Update a rule
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           $ref: '#/components/schemas/FinancialId'
     *     responses:
     *       200:
     *         description: Updated rule
     *       404:
     *         description: Rule not found
     */
    router.patch('/:id', controller.update)

    /**
     * @openapi
     * /recurring/{id}:
     *   delete:
     *     tags: [Recurring]
     *     summary: Delete a rule
     *     description: >
     *       Stops future occurrences. Entries already created by the rule stay,
     *       because they describe money that actually moved.
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           $ref: '#/components/schemas/FinancialId'
     *     responses:
     *       204:
     *         description: Rule deleted
     *       404:
     *         description: Rule not found
     */
    router.delete('/:id', controller.remove)

    return router
}
