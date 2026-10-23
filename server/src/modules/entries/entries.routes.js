import { Router } from 'express'
import { makeEntriesController } from './entries.controller.js'



/**
 * @openapi
 * components:
 *   schemas:
 *     FinancialId:
 *       description: Positive safe integer; decimal digit strings are also accepted.
 *       oneOf:
 *         - type: integer
 *           minimum: 1
 *           maximum: 9007199254740991
 *         - type: string
 *           pattern: '^[0-9]+$'
 *           description: Numeric value must be within 1 to 9007199254740991.
 *     FinancialName:
 *       type: string
 *       minLength: 1
 *       maxLength: 100
 *       pattern: '\S'
 *       description: Must contain a non-whitespace character; surrounding whitespace is trimmed.
 *     FinancialColor:
 *       type: string
 *       pattern: '^#[0-9a-fA-F]{6}$'
 *       example: '#4ade80'
 *     FinancialDate:
 *       type: string
 *       format: date
 *       pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 *       description: Real calendar date from 0001-01-01 to 9999-12-31, including leap-day validation.
 *     FinancialNote:
 *       type: string
 *       maxLength: 2000
 *       default: ''
 *     FinancialCurrency:
 *       type: string
 *       enum: [EUR, USD, GBP, CHF, PLN, SEK, NOK, DKK, CZK, HUF, RON, BGN, KZT]
 *       description: Case-insensitive; surrounding whitespace is trimmed. Entries default to EUR when omitted.
 *     WalletBalance:
 *       default: 0
 *       description: Finite decimal number with absolute value at most 1000000000000. Signed and zero balances are allowed. Default applies on create; omission on update preserves the balance and anchor.
 *       oneOf:
 *         - type: number
 *           minimum: -1000000000000
 *           maximum: 1000000000000
 *         - type: string
 *           pattern: '^\s*[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\s*$'
 *           description: Parsed numeric value must be finite and within the stated bounds.
 *     EntryAmount:
 *       description: Positive finite decimal number at most 1000000000000.
 *       oneOf:
 *         - type: number
 *           minimum: 0
 *           exclusiveMinimum: true
 *           maximum: 1000000000000
 *         - type: string
 *           pattern: '^\s*[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\s*$'
 *           description: Parsed numeric value must be finite, positive, and at most 1000000000000.
 *     KrakenCredentials:
 *       type: object
 *       additionalProperties: false
 *       required: [api_key, api_secret]
 *       properties:
 *         api_key:
 *           type: string
 *           minLength: 1
 *           maxLength: 4096
 *           pattern: '\S'
 *           writeOnly: true
 *         api_secret:
 *           type: string
 *           minLength: 1
 *           maxLength: 4096
 *           pattern: '\S'
 *           writeOnly: true
 */

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
     *           $ref: '#/components/schemas/FinancialId'
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
     *             required: [ledger_id, wallet_id, amount, category_id, date]
     *             properties:
     *               ledger_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               wallet_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               amount:
     *                 $ref: '#/components/schemas/EntryAmount'
     *               currency:
     *                 $ref: '#/components/schemas/FinancialCurrency'
     *               category_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               date:
     *                 $ref: '#/components/schemas/FinancialDate'
     *               note:
     *                 $ref: '#/components/schemas/FinancialNote'
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
     *   patch:
     *     tags: [Entries]
     *     summary: Update an entry by ID
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           $ref: '#/components/schemas/FinancialId'
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [ledger_id, wallet_id, amount, category_id, date]
     *             properties:
     *               ledger_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               wallet_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               amount:
     *                 $ref: '#/components/schemas/EntryAmount'
     *               currency:
     *                 $ref: '#/components/schemas/FinancialCurrency'
     *               category_id:
     *                 $ref: '#/components/schemas/FinancialId'
     *               date:
     *                 $ref: '#/components/schemas/FinancialDate'
     *               note:
     *                 $ref: '#/components/schemas/FinancialNote'
     *     responses:
     *       200:
     *         description: Entry updated
     *       400:
     *         description: Missing or invalid fields
     *       404:
     *         description: Entry, ledger, wallet, or category not found
     */
    router.patch('/:id', controller.update)

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
     *           $ref: '#/components/schemas/FinancialId'
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
