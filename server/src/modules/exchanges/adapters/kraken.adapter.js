import { createHmac, createHash } from 'crypto'

function signKrakenSpotRequest(path, apiSecret, postData) {
  const nonce = new URLSearchParams(postData).get('nonce')
  const sha256Hash = createHash('sha256').update(nonce + postData).digest()
  const message = Buffer.concat([Buffer.from(path), sha256Hash])
  const secretBuffer = Buffer.from(apiSecret, 'base64')
  return createHmac('sha512', secretBuffer).update(message).digest('base64')
}

async function krakenSpotRequest(endpoint, apiKey, apiSecret, params = {}) {
  const path = `/0/private/${endpoint}`
  const nonce = Date.now().toString()
  const postData = new URLSearchParams({ ...params, nonce }).toString()
  const signature = signKrakenSpotRequest(path, apiSecret, postData)

  const resp = await fetch(`${KRAKEN_SPOT_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: postData,
  })

  if (!resp.ok) throw new Error(`Kraken HTTP error: ${resp.status}`)
  const data = await resp.json()
  if (data.error?.length) throw new Error(`Kraken API error: ${data.error.join(', ')}`)
  return data.result ?? {}
}

function parseKrakenNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const PORTFOLIO_CURRENCY = 'USD'
const KRAKEN_SPOT_BASE_URL = 'https://api.kraken.com'

export default {
    slug: 'kraken',
    display_name: 'Kraken',
    portfolio_currency: PORTFOLIO_CURRENCY,

    credential_fields: [
      { name: 'api_key', label: 'API Key', secret: true },
      { name: 'api_secret', label: 'API Secret', secret: true },
    ],

    async fetch_portfolio_value(credentials) {
        const tradeBalance = await krakenSpotRequest('TradeBalance', credentials.api_key, credentials.api_secret, {
            asset: PORTFOLIO_CURRENCY,
        })
        const mainValue = parseKrakenNumber(tradeBalance.eb)
        if (mainValue === null) {
            throw new Error('Kraken TradeBalance response did not include equivalent balance')
        }

        return {
            portfolio_value: {
                amount: mainValue,
                currency: PORTFOLIO_CURRENCY,
            }
        }
  }
}
