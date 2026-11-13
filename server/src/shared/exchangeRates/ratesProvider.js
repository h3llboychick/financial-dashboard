const FRANKFURTER_RATES_URL = 'https://api.frankfurter.dev/v2/rates'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const cache = new Map()

/**
 * Multipliers that turn an amount in `source` into `target`.
 * Shared by the rates endpoint and the yearly recap so both quote the same
 * numbers on the same day.
 */
export async function getRatesToTarget({ target, sources, fetcher = fetch }) {
  const unique = [...new Set(sources.map(source => String(source).trim().toUpperCase()))]
  const needed = unique.filter(source => source !== target).sort()
  const identity = Object.fromEntries(unique.map(source => [source, 1]))

  if (needed.length === 0) {
    return { target, rates: identity, date: null }
  }

  const cacheKey = `${target}:${needed.join(',')}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { target, rates: { ...identity, ...cached.rates }, date: cached.date }
  }

  const url = new URL(FRANKFURTER_RATES_URL)
  url.searchParams.set('base', target)
  url.searchParams.set('quotes', needed.join(','))

  const response = await fetcher(url)
  if (!response.ok) {
    throw new Error(`Frankfurter request failed with status ${response.status}`)
  }

  const rows = await response.json()
  const targetToSource = Object.fromEntries(
    rows.map(row => [String(row.quote).trim().toUpperCase(), Number(row.rate)]),
  )

  const rates = { ...identity }
  for (const source of needed) {
    const rate = targetToSource[source]
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Missing exchange rate for ${source}`)
    }
    rates[source] = 1 / rate
  }

  const date = rows[0]?.date ?? null
  cache.set(cacheKey, { rates, date, fetchedAt: Date.now() })
  return { target, rates, date }
}
