import { Router } from 'express'
import { makeAuthController } from './auth.controller.js'



export function makeAuthRouter(services) {
    const controller = makeAuthController(services)
    const router = Router()

    /**
     * @openapi
     * /auth/telegram:
     *   post:
     *     tags: [Auth]
     *     summary: Authenticate via Telegram Login Widget
     *     description: >
     *       Verifies the HMAC-SHA256 signature produced by the Telegram Login Widget,
     *       checks that the auth data is not older than 24 hours, and returns a JWT
     *       on success. This endpoint is public (no `Authorization` header required).
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [id, first_name, auth_date, hash]
     *             properties:
     *               id:
     *                 type: integer
     *                 description: Telegram user ID
     *               first_name:
     *                 type: string
     *               username:
     *                 type: string
     *               photo_url:
     *                 type: string
     *                 format: uri
     *               auth_date:
     *                 type: integer
     *                 description: Unix timestamp when the user authenticated
     *               hash:
     *                 type: string
     *                 description: HMAC-SHA256 signature produced by the Telegram widget
     *           example:
     *             id: 123456789
     *             first_name: Daniil
     *             username: daniil
     *             photo_url: 'https://t.me/i/userpic/320/daniil.jpg'
     *             auth_date: 1749600000
     *             hash: 'a3f2...c1d9'
     *     responses:
     *       200:
     *         description: JWT and basic user info
     *         content:
     *           application/json:
     *             example:
     *               token: eyJhbGciOiJIUzI1NiJ9...
     *               user:
     *                 id: 123456789
     *                 username: daniil
     *                 first_name: Daniil
     *                 photo_url: 'https://t.me/i/userpic/320/daniil.jpg'
     *       401:
     *         description: Invalid or expired authentication data
     *         content:
     *           application/json:
     *             examples:
     *               invalid:
     *                 value:
     *                   error: Invalid authentication data.
     *               expired:
     *                 value:
     *                   error: Authentication data has expired.
     *       500:
     *         description: Telegram auth is not configured on the server
     *         content:
     *           application/json:
     *             example:
     *               error: Telegram auth is not configured on the server.
     */
    router.post('/telegram', controller.telegram)

    return router
}
