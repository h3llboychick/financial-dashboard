import { useEffect, useMemo, useState } from 'react'
import { getExchangeRates } from '../api.js'

function normalizeSourceCurrencies(sourceCurrencies, fallbackCurrencyCode) {
  const sources = sourceCurrencies?.length ? sourceCurrencies : [fallbackCurrencyCode]
  return [...new Set(sources.filter(Boolean))].sort()
}

export function useExchangeRates({ currencyCode, sourceCurrencies }) {
  const sourceCurrencyKey = useMemo(
    () => normalizeSourceCurrencies(sourceCurrencies, currencyCode).join(','),
    [sourceCurrencies, currencyCode],
  )
  const [exchangeRateState, setExchangeRateState] = useState({
    target: currencyCode,
    rates: { [currencyCode]: 1 },
  })
  const [loadedSourceCurrencyKey, setLoadedSourceCurrencyKey] = useState(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [ratesError, setRatesError] = useState(null)
  const isLoading = ratesLoading || loadedSourceCurrencyKey !== sourceCurrencyKey

  useEffect(() => {
    let active = true
    const sources = sourceCurrencyKey ? sourceCurrencyKey.split(',') : [currencyCode]

    setRatesLoading(true)
    setRatesError(null)
    getExchangeRates({ target: currencyCode, sources })
      .then(data => {
        if (!active) return
        setExchangeRateState({ target: data.target, rates: data.rates })
        setLoadedSourceCurrencyKey(sourceCurrencyKey)
        setRatesLoading(false)
      })
      .catch(error => {
        if (!active) return
        setExchangeRateState({ target: currencyCode, rates: { [currencyCode]: 1 } })
        setLoadedSourceCurrencyKey(sourceCurrencyKey)
        setRatesLoading(false)
        setRatesError(error.message || 'Failed to load exchange rates')
      })

    return () => { active = false }
  }, [currencyCode, sourceCurrencyKey])

  return { exchangeRateState, ratesError, ratesLoading: isLoading }
}
