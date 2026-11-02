function getEmptyCredentialValues(exchange) {
  return Object.fromEntries((exchange?.credentialFields ?? []).map(field => [field.name, '']))
}

function formatCurrency(amount, currency) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '-'

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

function normalizeExchangeOptions(data) {
  const rows = Array.isArray(data) ? data : data?.exchanges

  const exchanges = rows
    .map(exchange => {
      const credentialFields = Array.isArray(exchange?.credentialFields)
        ? exchange.credentialFields
        : Array.isArray(exchange?.credential_fields)
          ? exchange.credential_fields
          : []
      const normalizedCredentialFields = credentialFields
            .filter(field => field?.name)
            .map(field => ({
              name: String(field.name),
              label: field.label || String(field.name),
              secret: field.secret !== false,
              required: field.required !== false,
            }))

      return {
        slug: String(exchange?.slug || '').trim(),
        displayName: exchange?.display_name || exchange?.displayName || exchange?.slug,
        portfolioCurrency: exchange?.portfolio_currency || exchange?.portfolioCurrency || exchange?.protfolioCurrency || 'USD',
        credentialFields: normalizedCredentialFields,
      }
    })
    .filter(exchange => exchange.slug)

  return exchanges 
}

/**
 * Wallets a transfer can be sent to: fiat, same currency, and not the source.
 * Transfers between currencies need an exchange rate, so they stay out of v1.
 */
function transferDestinations(wallets, fromWalletId) {
  const source = (wallets ?? []).find(wallet => wallet.id === Number(fromWalletId))
  if (!source) return []
  return (wallets ?? []).filter(wallet =>
    wallet.type === 'fiat' &&
    wallet.id !== source.id &&
    wallet.currency === source.currency
  )
}

export { getEmptyCredentialValues, formatCurrency, normalizeExchangeOptions, transferDestinations }