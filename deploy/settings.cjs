const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

function settings(projectRoot) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Deployment requires Node.js 22 or newer')
  const root = fs.realpathSync(projectRoot)
  const appDirectory = path.join(root, 'app')
  if (fs.realpathSync(appDirectory) !== appDirectory) throw new Error('app/ must be a real directory')
  const requireFromServer = createRequire(path.join(appDirectory, 'server/package.json'))
  const envFile = path.join(root, '.env')
  const envDescriptor = fs.openSync(envFile, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
  let env
  try {
    // Check and read the same open file, even if its path is replaced meanwhile.
    const envStat = fs.fstatSync(envDescriptor)
    if (!envStat.isFile() || (envStat.mode & 0o077) !== 0) throw new Error('Root .env must be a private file (chmod 600)')
    const envLink = path.join(appDirectory, 'server/.env')
    if (!fs.lstatSync(envLink).isSymbolicLink() || fs.realpathSync(envLink) !== fs.realpathSync(envFile)) {
      throw new Error('app/server/.env must link to the project-root .env')
    }
    env = requireFromServer('dotenv').parse(fs.readFileSync(envDescriptor))
  } finally {
    fs.closeSync(envDescriptor)
  }
  if (env.NODE_ENV && env.NODE_ENV !== 'production') throw new Error('Root .env must use NODE_ENV=production')
  const databasePath = env.SQLITE_DB_PATH || env.DATABASE_PATH
  if (!databasePath || !path.isAbsolute(databasePath)) {
    throw new Error('Set SQLITE_DB_PATH or DATABASE_PATH to an absolute path in the root .env')
  }
  if (env.SQLITE_DB_PATH && env.DATABASE_PATH && env.SQLITE_DB_PATH !== env.DATABASE_PATH) {
    throw new Error('SQLITE_DB_PATH and DATABASE_PATH must refer to the same database')
  }
  for (const name of ['JWT_SECRET', 'CREDENTIALS_KEK']) {
    if (!env[name]) throw new Error(`Missing ${name} in the root .env`)
  }
  if (!env.DATABASE_ENCRYPTION_KEY && !env.DB_ENCRYPTION_KEY) throw new Error('Missing database encryption key in the root .env')
  if (!fs.statSync(databasePath).isFile()) throw new Error('The production database must already exist')
  const relativeDatabase = path.relative(appDirectory, fs.realpathSync(databasePath))
  if (!relativeDatabase.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeDatabase)) {
    throw new Error('The production database must be outside app/')
  }
  const port = Number(env.PORT || 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT in the root .env')
  return {
    projectRoot: root, appDirectory, requireFromServer, databasePath, port,
    env: { ...env, NODE_ENV: 'production' },
  }
}

module.exports = { settings }
if (require.main === module) settings(process.argv[2])
