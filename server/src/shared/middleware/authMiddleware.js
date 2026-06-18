import jwt from 'jsonwebtoken'

const PUBLIC_API_PATHS = new Set(['/config', '/auth/telegram'])

export function requireAuth(req, res, next) {
  if (req.path === '/config' || req.path === '/auth/telegram') return next()

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    const user_id = Number(payload.user_id ?? payload.userId)
    if (!Number.isFinite(user_id)) return res.status(401).json({ error: 'Invalid token' })
    req.user = { user_id }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAuthDev(req, res, next)  {
    if (PUBLIC_API_PATHS.has(req.path)) return next()
    req.user = { user_id: process.env.DEV_AUTH_USER_ID }
    next()
}