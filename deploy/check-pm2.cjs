const path = require('node:path')
const { settings } = require('./settings.cjs')

function checkPm2(apps, name, config) {
  const matching = apps.filter(app => app.name === name)
  if (matching.length !== 1) throw new Error('Expected exactly one PM2 process with the configured name')
  const pm2 = matching[0].pm2_env
  if (pm2.status !== 'online' || pm2.exec_mode !== 'fork_mode' || pm2.watch) {
    throw new Error('Expected one online PM2 process in fork mode with watch disabled')
  }
  if (pm2.pm_exec_path !== path.join(config.appDirectory, 'server/src/server.js') || pm2.pm_cwd !== config.appDirectory) {
    throw new Error('PM2 must run app/server/src/server.js with app/ as its working directory')
  }
  if (apps.some(app => app !== matching[0] && app.pm2_env?.pm_exec_path === pm2.pm_exec_path &&
    ['online', 'launching'].includes(app.pm2_env.status))) {
    throw new Error('Another PM2 process runs this application; stop it before deploying')
  }
  const expected = { ...config.env, PORT: String(config.port), SQLITE_DB_PATH: config.databasePath, DATABASE_PATH: config.databasePath }
  for (const [key, value] of Object.entries(expected)) {
    if (pm2.env?.[key] !== undefined && String(pm2.env[key]) !== value) {
      throw new Error(`PM2 has a conflicting ${key}; keep application configuration in the root .env`)
    }
  }
}

module.exports = { checkPm2 }
if (require.main === module) {
  let input = ''
  process.stdin.on('data', chunk => { input += chunk })
  process.stdin.on('end', () => {
    try { checkPm2(JSON.parse(input), process.argv[3], settings(process.argv[2])) }
    catch (error) { console.error(error.message); process.exitCode = 1 }
  })
}
