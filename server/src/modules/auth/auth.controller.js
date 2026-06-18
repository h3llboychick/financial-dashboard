import crypto from 'crypto'
import jwt from 'jsonwebtoken'


export function makeAuthController({ userDefaultsService }) {
    // Implementation guide: https://core.telegram.org/widgets/login-legacy
    function telegram(req, res) {
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
        const JWT_SECRET = process.env.JWT_SECRET
        
        if (!BOT_TOKEN || !JWT_SECRET) {
            return res.status(500).json({ error: 'Telegram auth is not configured on the server.' })
        }

        const data = req.body
        const { hash, ...rest } = data

        const data_str = Object.keys(rest)
            .sort()
            .map(k => `${k}=${rest[k]}`)
            .join('\n')

        const secret_key = crypto.createHash('sha256').update(BOT_TOKEN).digest()
        const hmac = crypto.createHmac('sha256', secret_key).update(data_str).digest('hex')

        if (hmac !== hash) {
            return res.status(401).json({ error: 'Invalid authentication data.' })
        }
        if (Date.now() / 1000 - data.auth_date > 86400) {
            return res.status(401).json({ error: 'Authentication data has expired.' })
        }

        const user_id = Number(data.id)
        if (!Number.isFinite(user_id)) {
            return res.status(401).json({ error: 'Invalid authentication data.' })
        }

        const token = jwt.sign(
            { user_id },
            JWT_SECRET,
            { expiresIn: '30d' }
        )

        userDefaultsService.ensureUserDefaults(user_id)

        res.json({
            token,
            user: {
                id: user_id,
                username: data.username,
                first_name: data.first_name,
                photo_url: data.photo_url,
            },
        })
    }

    return { telegram }
}
