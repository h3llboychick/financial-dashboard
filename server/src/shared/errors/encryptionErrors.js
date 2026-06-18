export const CREDENTIALS_ERROR_CODES = {
    CONTEXT_MISSING: 'CREDENTIALS_CONTEXT_MISSING',
    MALFORMED_ENCRYPTED_ROW: 'CREDENTIALS_MALFORMED_PAYLOAD',
    ENCRYPTION_FAILED: 'CREDENTIALS_ENCRYPTION_FAILED',
    DECRYPTION_FAILED: 'CREDENTIALS_DECRYPTION_FAILED',
}


export class CredentialsEncryptionError extends Error {
    constructor(message, {code, cause}) {
        super(message, { cause })
        this.name = 'CredentialsEncryptionError'
        this.code = code
    }
}