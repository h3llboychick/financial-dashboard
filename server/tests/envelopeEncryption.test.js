import { describe, expect, test, beforeAll } from '@jest/globals'
import {
    CREDENTIAL_ENCRYPTION_VERSION,
    decryptExchangeCredentials,
    encryptExchangeCredentials,
    isEncryptedCredentialRow,
} from '../src/shared/security/envelopeEncryption.js'
import { CREDENTIALS_ERROR_CODES, CredentialsEncryptionError } from '../src/shared/errors/encryptionErrors.js'

beforeAll(() => {
    process.env.CREDENTIALS_KEK =
        '0000000000000000000000000000000000000000000000000000000000000001'
})

const TEST_CONTEXT = {
    user_id: 1,
    wallet_id: 2,
    slug: 'kraken',
}

const TEST_CREDENTIALS = {
    api_key: 'XXXXA',
    api_secret: 'XXXXB',
}

const ENCRYPTED_ROW_FIELDS = [
    'encrypted_dek',
    'encrypted_dek_iv',
    'encrypted_dek_tag',
    'credentials_ciphertext',
    'credentials_iv',
    'credentials_tag',
]

function makeCredentialInput(overrides = {}) {
    const { credentials, ...contextOverrides } = overrides

    return {
        ...TEST_CONTEXT,
        ...contextOverrides,
        credentials: {
            ...TEST_CREDENTIALS,
            ...credentials,
        },
    }
}

function makeEncryptedRow(input = makeCredentialInput()) {
    const encrypted = encryptExchangeCredentials(input)

    return {
        user_id: input.user_id,
        wallet_id: input.wallet_id,
        slug: input.slug,
        ...encrypted,
    }
}

function expectCredentialsError(fn, code) {
    let thrownError

    try {
        fn()
    } catch (error) {
        thrownError = error
    }

    expect(thrownError).toBeInstanceOf(CredentialsEncryptionError)
    expect(thrownError.code).toBe(code)
}

describe('envelope encryption', () => {
    test('encryptExchangeCredentials returns a valid encrypted credential row', () => {
        const encrypted = encryptExchangeCredentials(makeCredentialInput())

        expect(encrypted.encryption_version).toBe(CREDENTIAL_ENCRYPTION_VERSION)
        expect(isEncryptedCredentialRow(encrypted)).toBe(true)
        for (const field of ENCRYPTED_ROW_FIELDS) {
            expect(typeof encrypted[field]).toBe('string')
            expect(encrypted[field].length).toBeGreaterThan(0)
        }
    })

    test('encryptExchangeCredentials does not expose plaintext credentials', () => {
        const input = makeCredentialInput()
        const encrypted = encryptExchangeCredentials(input)
        const serialized = JSON.stringify(encrypted)

        expect(serialized).not.toContain(input.credentials.api_key)
        expect(serialized).not.toContain(input.credentials.api_secret)
    })

    test('decryptExchangeCredentials returns the original credentials', () => {
        const input = makeCredentialInput()
        const encryptedRow = makeEncryptedRow(input)

        const decrypted = decryptExchangeCredentials(encryptedRow)

        expect(decrypted).toEqual(input.credentials)
    })

    test('encryptExchangeCredentials rejects missing credential context', () => {
        expectCredentialsError(() => {
            encryptExchangeCredentials(makeCredentialInput({ user_id: null }))
        }, CREDENTIALS_ERROR_CODES.CONTEXT_MISSING)
    })

    test('decryptExchangeCredentials rejects missing credential context', () => {
        const rowWithoutWalletId = makeEncryptedRow()
        delete rowWithoutWalletId.wallet_id

        expectCredentialsError(() => {
            decryptExchangeCredentials(rowWithoutWalletId)
        }, CREDENTIALS_ERROR_CODES.CONTEXT_MISSING)
    })

    test('decryptExchangeCredentials rejects rows encrypted for a different context', () => {
        const encryptedRow = makeEncryptedRow()
        const rowWithDifferentUser = { ...encryptedRow, user_id: 2 }

        expectCredentialsError(() => {
            decryptExchangeCredentials(rowWithDifferentUser)
        }, CREDENTIALS_ERROR_CODES.DECRYPTION_FAILED)
    })

    test('decryptExchangeCredentials rejects tampered ciphertext', () => {
        const encryptedRow = makeEncryptedRow()
        const rowWithTamperedCiphertext = {
            ...encryptedRow,
            credentials_ciphertext: encryptedRow.credentials_ciphertext.slice(0, -2) + 'xx',
        }

        expectCredentialsError(() => {
            decryptExchangeCredentials(rowWithTamperedCiphertext)
        }, CREDENTIALS_ERROR_CODES.DECRYPTION_FAILED)
    })
})
