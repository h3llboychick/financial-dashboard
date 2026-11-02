#!/usr/bin/env node
/**
 * One-off trigger for the recurring runner, called by a systemd timer.
 *
 * It talks to the API over loopback, so the database keeps a single writer and
 * the runner reuses the same validation and transactions as the HTTP endpoints.
 * Only counts are printed, never financial data.
 */

const token = process.env.RECURRING_RUN_TOKEN
const port = process.env.PORT || '3001'
const url = `http://127.0.0.1:${port}/internal/recurring/run`

if (!token) {
  console.error('RECURRING_RUN_TOKEN is not set; refusing to call the runner.')
  process.exit(1)
}

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-service-token': token },
  })
  const body = await response.text()

  console.log(`${new Date().toISOString()} ${response.status} ${body}`)

  if (!response.ok) process.exit(1)
} catch (error) {
  console.error(`Recurring runner request failed: ${error.message}`)
  process.exit(1)
}
