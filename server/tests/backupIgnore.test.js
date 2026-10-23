import { describe, expect, test } from '@jest/globals'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))

function isIgnored(path) {
  const result = spawnSync('git', ['check-ignore', '--no-index', '-q', path], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  if (![0, 1].includes(result.status)) throw new Error(result.stderr)
  return result.status === 0
}

describe('secret and database backup ignore policy', () => {
  test.each(['', 'server/', 'client/', 'nested/project/'])('%s ignores private environment variants', (prefix) => {
    for (const name of ['.env', '.env.local', '.env.production', '.env.test.local', '.envrc']) {
      expect({ path: prefix + name, ignored: isIgnored(prefix + name) }).toEqual({
        path: prefix + name,
        ignored: true,
      })
    }
  })

  test.each(['', 'server/', 'client/', 'nested/project/'])('%s retains sanitized environment examples', (prefix) => {
    for (const name of ['.env.example', '.env.production.example', '.env.local.example']) {
      expect(isIgnored(prefix + name)).toBe(false)
    }
  })

  test.each(['spendings.db', 'spendings.sqlite'])('%s ignores backups, sidecars, and private conversion staging', (name) => {
    for (const prefix of ['', 'server/', 'nested/project/']) {
      for (const suffix of ['', '-wal', '-shm', '-journal', '.encrypted-backup-2026-10-23-a', '.encrypted-backup-2026-10-23-a-wal']) {
        expect(isIgnored(prefix + name + suffix)).toBe(true)
      }
      expect(isIgnored(`${prefix}.${name}.encryption-staging-random/backup.db`)).toBe(true)
      expect(isIgnored(`${prefix}.${name}.encryption-staging-random/marker.txt`)).toBe(true)
    }
  })

  test.each(['operator-data', 'operator.custom'])('%s ignores generated backups for configurable database names', (name) => {
    for (const prefix of ['', 'server/', 'nested/project/']) {
      for (const suffix of ['', '-wal', '-shm', '-journal']) {
        expect(isIgnored(`${prefix}${name}.encrypted-backup-2026-10-23-a${suffix}`)).toBe(true)
      }
      expect(isIgnored(`${prefix}.${name}.encryption-staging-random/marker.txt`)).toBe(true)
    }
  })
})
