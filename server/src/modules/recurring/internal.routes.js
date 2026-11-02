import { Router } from 'express'
import { createHash, timingSafeEqual } from 'crypto'

function tokenMatches(provided, expected) {
  if (!provided || !expected) return false
  const left = createHash('sha256').update(String(provided)).digest()
  const right = createHash('sha256').update(String(expected)).digest()
  return timingSafeEqual(left, right)
}

/**
 * Machine endpoint for the systemd timer. Mounted outside /api, so user JWTs
 * never apply here: the shared token is the only way in. It returns counts,
 * never financial data.
 */
export function makeRecurringInternalRouter({ recurring_service, token, logger }) {
  const router = Router()
  const expected = token === undefined ? process.env.RECURRING_RUN_TOKEN : token

  router.post('/run', (req, res) => {
    if (!expected) {
      return res.status(503).json({ error: 'Recurring runner is not configured' })
    }
    if (!tokenMatches(req.get('x-service-token'), expected)) {
      logger?.warn?.({ remote_address: req.ip, forwarded_for: req.get('x-forwarded-for') }, 'recurring run rejected')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    res.json(recurring_service.run_due({}))
  })

  return router
}
