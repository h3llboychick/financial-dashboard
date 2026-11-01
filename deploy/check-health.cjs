const { settings } = require('./settings.cjs')

async function checkHealth(config, revision, { attempts = 30, intervalMs = 1000, fetchImpl = fetch } = {}) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid expected revision')
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(`http://127.0.0.1:${config.port}/health`, { signal: AbortSignal.timeout(1500) })
      const health = await response.json()
      if (response.ok && health.status === 'ok' && health.revision === revision) return
    } catch { /* The process may still be starting or running migrations. */ }
    if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error('The expected application revision did not become healthy')
}

module.exports = { checkHealth }
if (require.main === module) {
  checkHealth(settings(process.argv[2]), process.argv[3]).then(() => console.log('Application is healthy.')).catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
