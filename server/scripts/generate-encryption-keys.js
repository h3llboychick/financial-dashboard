import { randomBytes } from 'crypto'

for (const name of ['DATABASE_ENCRYPTION_KEY', 'CREDENTIALS_KEK']) {
  console.log(`${name}=base64:${randomBytes(32).toString('base64')}`)
}
