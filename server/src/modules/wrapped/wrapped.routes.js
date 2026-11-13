import { Router } from 'express'
import { makeWrappedController } from './wrapped.controller.js'

export function makeWrappedRouter(repos) {
    const controller = makeWrappedController(repos)
    const router = Router()

    /**
     * @openapi
     * /wrapped:
     *   get:
     *     tags: [Wrapped]
     *     summary: Year in numbers for the wrapped screen
     *     description: >
     *       Aggregates the requested year into the shape the story player
     *       renders: totals, months, categories, the most expensive day,
     *       no-spend runs, weekday split, subscriptions and logging habits.
     *       Money is summed in the year's dominant currency; entries in another
     *       currency are reported as skipped instead of being converted, because
     *       entries do not store the rate they were made at.
     *     parameters:
     *       - in: query
     *         name: year
     *         schema:
     *           type: integer
     *           minimum: 2000
     *           maximum: 2100
     *         description: Defaults to the current year.
     *     responses:
     *       200:
     *         description: Wrapped payload
     *         content:
     *           application/json:
     *             example:
     *               year: 2026
     *               currency: EUR
     *               has_data: true
     *               totals:
     *                 earned: 14200
     *                 spent: 9830
     *                 invested: 2400
     *                 net: 1970
     *                 entries: 247
     *               categories:
     *                 - name: Housing
     *                   color: '#eab308'
     *                   amount: 3600
     *                   share: 36.6
     *               no_spend_days: 96
     */
    /**
     * @openapi
     * /wrapped/availability:
     *   get:
     *     tags: [Wrapped]
     *     summary: Whether the yearly recap is open right now
     *     responses:
     *       200:
     *         description: Availability window, recap year and closing time
     */
    router.get('/availability', controller.availability)
    router.get('/', controller.show)

    return router
}
