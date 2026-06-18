import kraken from './adapters/kraken.adapter.js'

const adapters = new Map([
    [kraken.slug, kraken],
])

export function getExchangeAdapter(slug) {
    return adapters.get(slug)
}

export function getSupportedExchanges() {
    return new Set(adapters.keys())
}

export function listExchangeMetadata() {
    return [...adapters.values()].map(adapter => ({
        slug: adapter.slug,
        display_name: adapter.display_name,
        portfolio_currency: adapter.portfolio_currency,
        credential_fields: adapter.credential_fields
    }))
}
