import { Router } from 'express'
import { makeWalletsController } from './wallets.controller.js'


export function makeWalletsRouter(repos) {
    const controller = makeWalletsController(repos)
    const router = Router()

    /**
     * @openapi
     * /wallets:
     *   get:
     *     tags: [Wallets]
     *     summary: List all wallets for the authenticated user
     *     description: >
     *       Returns all wallets. Fiat wallets include a computed `balance`;
     *       exchange wallets return `balance: null` and include `has_credentials`.
     *     responses:
     *       200:
     *         description: Array of wallets
     *         content:
     *           application/json:
     *             example:
     *               - id: 1
     *                 name: Main Account
     *                 slug: null
     *                 type: fiat
     *                 currency: EUR
     *                 initial_balance: 1000
     *                 balance: 1234.56
     *               - id: 2
     *                 name: Kraken
     *                 slug: kraken
     *                 type: exchange
     *                 currency: USD
     *                 initial_balance: 0
     *                 balance: null
     *                 has_credentials: true
     */
    router.get('/', controller.list)

    /**
     * @openapi
     * /wallets:
     *   post:
     *     tags: [Wallets]
     *     summary: Create a new wallet
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name, currency, type]
     *             properties:
     *               name:
     *                 type: string
     *               currency:
     *                 type: string
     *                 example: EUR
     *               type:
     *                 type: string
     *                 enum: [fiat, exchange]
     *               initial_balance:
     *                 type: number
     *                 default: 0
     *           example:
     *             name: Main Account
     *             currency: EUR
     *             type: fiat
     *             initial_balance: 1000
     *     responses:
     *       201:
     *         description: Wallet created
     *         content:
     *           application/json:
     *             example:
     *               id: 1
     *               user_id: 1
     *               name: Main Account
     *               currency: EUR
     *               type: fiat
     *               initial_balance: 1000
     *               balance_anchor_entry_id: 0
     *               balance_anchor_at: null
     *               created_at: '2026-06-11T00:00:00.000Z'
     *       400:
     *         description: Missing/invalid fields or unsupported currency
     *         content:
     *           application/json:
     *             examples:
     *               missingFields:
     *                 value:
     *                   error: name, currency, and type are required
     *               unsupportedCurrency:
     *                 value:
     *                   error: Unsupported currency
     *               invalidBalance:
     *                 value:
     *                   error: initial_balance must be a number
     *       409:
     *         description: A wallet with this name already exists
     *         content:
     *           application/json:
     *             example:
     *               error: A wallet with this name already exists.
     */
    router.post('/', controller.create)

    /**
     * @openapi
     * /wallets/{id}:
     *   patch:
     *     tags: [Wallets]
     *     summary: Update a wallet's name or initial balance
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: ID of the wallet to update
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               initial_balance:
     *                 type: number
     *                 description: >
     *                   Setting this for a fiat wallet resets the balance anchor
     *                   to the latest entry, so the new initial balance takes effect
     *                   from this point forward.
     *           example:
     *             name: Savings
     *             initial_balance: 2000
     *     responses:
     *       200:
     *         description: Updated wallet
     *         content:
     *           application/json:
     *             example:
     *               id: 1
     *               name: Savings
     *               currency: EUR
     *               type: fiat
     *               initial_balance: 2000
     *       400:
     *         description: initial_balance is not a number
     *         content:
     *           application/json:
     *             example:
     *               error: initial_balance must be a number
     *       404:
     *         description: Wallet not found
     *         content:
     *           application/json:
     *             example:
     *               error: Not found
     */
    router.patch('/:id', controller.update)

    /**
     * @openapi
     * /wallets/{id}:
     *   delete:
     *     tags: [Wallets]
     *     summary: Delete a wallet by ID
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: ID of the wallet to delete
     *     responses:
     *       204:
     *         description: Wallet deleted successfully
     *       404:
     *         description: Wallet not found
     *         content:
     *           application/json:
     *             example:
     *               error: Not found
     */
    router.delete('/:id', controller.remove)

    /**
     * @openapi
     * /wallets/{id}/credentials:
     *   put:
     *     tags: [Wallets]
     *     summary: Save or replace API credentials for an exchange wallet
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: ID of the exchange wallet
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [slug, credentials]
     *             properties:
     *               slug:
     *                 type: string
     *                 enum: [kraken]
     *                 description: Exchange identifier
     *               credentials:
     *                 type: object
     *                 additionalProperties: true
     *           example:
     *             slug: kraken
     *             credentials:
     *              api_key: example-api-key
     *              api_secret: example-api-secret
     *     responses:
     *       201:
     *         description: Credentials saved
     *         content:
     *           application/json:
     *             example:
     *               ok: true
     *       400:
     *         description: Missing fields, unknown slug, or wallet is not an exchange type
     *         content:
     *           application/json:
     *             examples:
     *               notExchange:
     *                 value:
     *                   error: Only exchange wallets support credentials
     *               missingFields:
     *                 value:
     *                   error: slug and credentials are required
     *               unknownSlug:
     *                 value:
     *                   error: 'Unknown exchange slug. Supported: kraken'
     *       404:
     *         description: Wallet not found
     *         content:
     *           application/json:
     *             example:
     *               error: Not found
     */
    router.put('/:id/credentials', controller.putExchangeCredentials)

    /**
     * @openapi
     * /wallets/{id}/live-balance:
     *   get:
     *     tags: [Wallets]
     *     summary: Fetch live portfolio balance from the exchange
     *     description: >
     *       Calls the exchange API using the stored credentials and returns the
     *       current portfolio value. Only supported for exchange wallets with
     *       saved credentials.
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: ID of the exchange wallet
     *     responses:
     *       200:
     *         description: Live balance from the exchange
     *         content:
     *           application/json:
     *             example:
     *               portfolio_value:
     *                 amount: 4321.99
     *                 currency: USD
     *       400:
     *         description: Wallet is not an exchange type, has no credentials, or no adapter exists for the exchange
     *         content:
     *           application/json:
     *             examples:
     *               notExchange:
     *                 value:
     *                   error: Only exchange wallets have a live balance
     *               noCredentials:
     *                 value:
     *                   error: No API credentials saved for this wallet
     *               noAdapter:
     *                 value:
     *                   error: 'No adapter for exchange: kraken'
     *       404:
     *         description: Wallet not found
     *         content:
     *           application/json:
     *             example:
     *               error: Not found
     *       502:
     *         description: Exchange API returned an error
     *         content:
     *           application/json:
     *             example:
     *               error: 'Kraken API error: Invalid key'
     */
    router.get('/:id/live-balance', controller.getExchangeLiveBalance)

    return router;
}
