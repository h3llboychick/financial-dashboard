import { getExchangeAdapter } from './registry.js'

async function get_live_balance({ credentials_row }) {
    const adapter = getExchangeAdapter(credentials_row.slug)
    if (!adapter) {
        const error = new Error(`Unsupported exchange: ${credentials_row.slug}`)
        error.status = 400
        throw error
    }

    return adapter.fetch_portfolio_value(credentials_row.credentials)
}

export default { get_live_balance }
