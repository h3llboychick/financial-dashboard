import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getRequiredSecretKey } from './keys.js'
import { CredentialsEncryptionError, CREDENTIALS_ERROR_CODES } from '../errors/encryptionErrors.js'

export const CREDENTIAL_ENCRYPTION_VERSION = 1

const AES_KEY_BYTES = 32
const GCM_IV_BYTES = 12
const GCM_TAG_BYTES = 16

let credentialKek

export function getCredentialKek() {
  if (!credentialKek) {
    credentialKek = getRequiredSecretKey('CREDENTIALS_KEK', 'exchange credential KEK')
  }
  return credentialKek
}

export function validateCredentialKekConfigured() {
  getCredentialKek()
}

function toBase64(value) {
  return Buffer.from(value).toString('base64')
}

function fromBase64(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing encrypted credential field: ${field}`)
  }
  return Buffer.from(value, 'base64')
}

function credentialAad({ user_id, wallet_id, slug }, part) {
  return Buffer.from(
    `financial-dashboard.exchange-credentials.v${CREDENTIAL_ENCRYPTION_VERSION}:${part}:${user_id}:${wallet_id}:${slug}`,
    'utf8',
  )
}

function encryptAesGcm(key, plaintext, aad) {
  if (!Buffer.isBuffer(key) || key.length !== AES_KEY_BYTES) {
    throw new Error(`AES-GCM key must be ${AES_KEY_BYTES} bytes`)
  }

  const iv = randomBytes(GCM_IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: GCM_TAG_BYTES })
  cipher.setAAD(aad)

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    tag: toBase64(tag),
  }
}

function decryptAesGcm(key, encrypted, aad) {
  if (!Buffer.isBuffer(key) || key.length !== AES_KEY_BYTES) {
    throw new Error(`AES-GCM key must be ${AES_KEY_BYTES} bytes`)
  }

  const decipher = createDecipheriv('aes-256-gcm', key, encrypted.iv, { authTagLength: GCM_TAG_BYTES })
  decipher.setAAD(aad)
  decipher.setAuthTag(encrypted.tag)

  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()])
}

function credentialContext(row) {
  return {
    user_id: Number(row.user_id ?? row.userId),
    wallet_id: Number(row.wallet_id ?? row.walletId),
    slug: String(row.slug ?? ''),
  }
}

export function isEncryptedCredentialRow(row) {
  return (
    Number(row?.encryption_version) === CREDENTIAL_ENCRYPTION_VERSION &&
    !!row.encrypted_dek &&
    !!row.encrypted_dek_iv &&
    !!row.encrypted_dek_tag &&
    !!row.credentials_ciphertext &&
    !!row.credentials_iv &&
    !!row.credentials_tag
  )
}

export function encryptExchangeCredentials({ user_id, wallet_id, slug, credentials }) {
  const context = { user_id, wallet_id, slug }
  if (!context?.user_id || !context.wallet_id || !context.slug) {
    throw new CredentialsEncryptionError('Bad/missing context', {
      code: CREDENTIALS_ERROR_CODES.CONTEXT_MISSING
    })
  } 

  const dek = randomBytes(AES_KEY_BYTES)

  try {
    const payload = Buffer.from(
      JSON.stringify(credentials),
      'utf8',
    )

    const encryptedPayload = encryptAesGcm(dek, payload, credentialAad(context, 'payload'))
    const wrappedDek = encryptAesGcm(getCredentialKek(), dek, credentialAad(context, 'dek'))

    return {
      encrypted_dek: wrappedDek.ciphertext,
      encrypted_dek_iv: wrappedDek.iv,
      encrypted_dek_tag: wrappedDek.tag,
      credentials_ciphertext: encryptedPayload.ciphertext,
      credentials_iv: encryptedPayload.iv,
      credentials_tag: encryptedPayload.tag,
      encryption_version: CREDENTIAL_ENCRYPTION_VERSION,
    }
  } catch (error) {
    throw new CredentialsEncryptionError('Encryption failed', {
      code: CREDENTIALS_ERROR_CODES.ENCRYPTION_FAILED, 
      cause: error
    })
  } finally {
    dek.fill(0)
  }
}

export function decryptExchangeCredentials(row) {
  const context = credentialContext(row)

  if (!context?.user_id || !context.wallet_id || !context.slug) {
    throw new CredentialsEncryptionError('Bad/missing context', {
      code: CREDENTIALS_ERROR_CODES.CONTEXT_MISSING
    })
  }
  
  if (!isEncryptedCredentialRow(row)) {
    throw new CredentialsEncryptionError('Missing/malformed encrypted row', {
      code: CREDENTIALS_ERROR_CODES.MALFORMED_ENCRYPTED_ROW
    })
  }

  let dek;
  try {
    dek = decryptAesGcm(
      getCredentialKek(),
      {
        ciphertext: fromBase64(row.encrypted_dek, 'encrypted_dek'),
        iv: fromBase64(row.encrypted_dek_iv, 'encrypted_dek_iv'),
        tag: fromBase64(row.encrypted_dek_tag, 'encrypted_dek_tag'),
      },
      credentialAad(context, 'dek'),
    )

    const plaintext = decryptAesGcm(
      dek,
      {
        ciphertext: fromBase64(row.credentials_ciphertext, 'credentials_ciphertext'),
        iv: fromBase64(row.credentials_iv, 'credentials_iv'),
        tag: fromBase64(row.credentials_tag, 'credentials_tag'),
      },
      credentialAad(context, 'payload'),
    )
    const parsed = JSON.parse(plaintext.toString('utf8'))
    return parsed
  } catch (error) {
    throw new CredentialsEncryptionError('Decryption failed', {
      code: CREDENTIALS_ERROR_CODES.DECRYPTION_FAILED,
      cause: error
    })
  } finally {
    if (dek) dek.fill(0)
  }
}
