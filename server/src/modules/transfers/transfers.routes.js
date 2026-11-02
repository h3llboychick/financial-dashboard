import { Router } from 'express'
import { makeTransfersController } from './transfers.controller.js'

export function makeTransfersRouter(repos) {
    const controller = makeTransfersController(repos)
    const router = Router()

    /**
     * @openapi
     * /transfers:
     *   get:
     *     tags: [Transfers]
     *     summary: List transfers between wallets
     *     description: >
     *       Transfers move money between two fiat wallets of the same currency.
     *       They never create ledger entries, so they stay out of spending and
     *       income analytics.
     *     responses:
     *       200:
     *         description: Array of transfers, newest first
     *         content:
     *           application/json:
     *             example:
     *               - id: 1
     *                 from_wallet_id: 1
     *                 to_wallet_id: 2
     *                 from_wallet_name: Cash
     *                 to_wallet_name: Bank
     *                 amount: 30
     *                 currency: EUR
     *                 date: '2026-08-05'
     *                 note: Top up
     */
    router.get('/', controller.list)

    /**
     * @openapi
     * /transfers:
     *   post:
     *     tags: [Transfers]
     *     summary: Move money between two fiat wallets
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [from_wallet_id, to_wallet_id, amount, date]
     *             properties:
     *               from_wallet_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               to_wallet_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               amount:
     *                 $ref: '#/components/schemas/FinancialAmount'
     *               date:
     *                 type: string
     *                 example: '2026-08-05'
     *               note:
     *                 type: string
     *                 maxLength: 2000
     *           example:
     *             from_wallet_id: 1
     *             to_wallet_id: 2
     *             amount: 30
     *             date: '2026-08-05'
     *             note: Top up savings
     *     responses:
     *       201:
     *         description: Transfer created
     *       400:
     *         description: Same wallet, different currencies, non-fiat wallet, or invalid amount/date
     *         content:
     *           application/json:
     *             examples:
     *               sameWallet:
     *                 value:
     *                   error: A transfer needs two different wallets
     *               currencyMismatch:
     *                 value:
     *                   error: Both wallets must use the same currency
     *               notFiat:
     *                 value:
     *                   error: Transfers are only supported between fiat wallets
     *       404:
     *         description: One of the wallets does not exist
     *         content:
     *           application/json:
     *             example:
     *               error: Not found
     */
    router.post('/', controller.create)

    /**
     * @openapi
     * /transfers/{id}:
     *   delete:
     *     tags: [Transfers]
     *     summary: Delete a transfer
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           $ref: '#/components/schemas/FinancialId'
     *     responses:
     *       204:
     *         description: Transfer deleted
     *       404:
     *         description: Transfer not found
     */
    router.delete('/:id', controller.remove)

    return router
}
