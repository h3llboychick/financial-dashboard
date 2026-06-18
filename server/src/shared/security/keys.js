const KEY_BYTES = 32

function normalizeNames(names) {
  return Array.isArray(names) ? names : [names]
}

function readEnvValue(names) {
  for (const name of normalizeNames(names)) {
    const value = process.env[name]
    if (value?.trim()) return { name, value: value.trim() }
  }
  return null
}

function decodeSecretKey(value, name) {
  const prefixedBase64 = value.startsWith('base64:')
  const prefixedHex = value.startsWith('hex:')
  const raw = prefixedBase64 || prefixedHex ? value.slice(value.indexOf(':') + 1) : value
  const encoding = prefixedHex || /^[0-9a-f]{64}$/i.test(raw) ? 'hex' : 'base64'
  const key = Buffer.from(raw, encoding)

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `${name} must decode to ${KEY_BYTES} bytes. Generate keys with "npm run secrets:generate --prefix server".`,
    )
  }

  return key
}

export function getRequiredSecretKey(names, purpose) {
  const namesList = normalizeNames(names)
  const found = readEnvValue(namesList)
  if (!found) {
    throw new Error(
      `Missing ${namesList.join(' or ')} for ${purpose}. Generate keys with "npm run secrets:generate --prefix server".`,
    )
  }

  return decodeSecretKey(found.value, found.name)
}

export function assertDifferentKeys(left, right, leftName, rightName) {
  if (Buffer.compare(left, right) === 0) {
    throw new Error(`${leftName} and ${rightName} must be different keys.`)
  }
}
