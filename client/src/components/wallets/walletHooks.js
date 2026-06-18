import { useCallback, useEffect, useMemo, useState } from 'react'
import { getExchanges, getWalletLiveBalance, getWallets } from '../../api.js'
import { useExchangeRates } from '../../hooks/useExchangeRates.js'
import { normalizeExchangeOptions } from './walletUtils.js'

export function useWalletList(onDataChange) {
  const [wallets, setWallets] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadWallets = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getWallets()
      setWallets(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshWallets = useCallback(async () => {
    await loadWallets()
    onDataChange?.()
  }, [loadWallets, onDataChange])

  useEffect(() => { loadWallets() }, [loadWallets])

  return { wallets, loading, error, refreshWallets }
}

export function useExchangeOptions() {
  const [exchangeOptions, setExchangeOptions] = useState([])

  const loadExchangeOptions = useCallback(async () => {
    try {
      const data = await getExchanges()
      setExchangeOptions(normalizeExchangeOptions(data))
    } catch {
      setExchangeOptions([])
    }
  }, [])

  useEffect(() => { loadExchangeOptions() }, [loadExchangeOptions])

  return exchangeOptions
}

export function useWalletGroups(wallets) {
  const fiatWallets = useMemo(
    () => wallets?.filter(w => w.type === 'fiat') ?? [],
    [wallets]
  )
  const exchangeWallets = useMemo(
    () => wallets?.filter(w => w.type === 'exchange') ?? [],
    [wallets]
  )
  const existingFiatCurrencies = useMemo(
    () => new Set(fiatWallets.map(w => w.currency)),
    [fiatWallets]
  )

  return { fiatWallets, exchangeWallets, existingFiatCurrencies }
}

export function useLivePortfolios(exchangeWallets) {
  const [livePortfolios, setLivePortfolios] = useState({})

  const loadExchangePortfolio = useCallback(async (wallet) => {
    setLivePortfolios(prev => ({
      ...prev,
      [wallet.id]: {
        portfolioValue: prev[wallet.id]?.portfolioValue ?? null,
        loading: true,
        error: null,
      },
    }))

    try {
      const data = await getWalletLiveBalance(wallet.id)
      setLivePortfolios(prev => ({
        ...prev,
        [wallet.id]: {
          portfolioValue: data.portfolio_value || null,
          loading: false,
          error: null,
        },
      }))
    } catch (e) {
      setLivePortfolios(prev => ({
        ...prev,
        [wallet.id]: {
          portfolioValue: prev[wallet.id]?.portfolioValue ?? null,
          loading: false,
          error: e.message,
        },
      }))
    }
  }, [])

  useEffect(() => {
    exchangeWallets.forEach(wallet => {
      const state = livePortfolios[wallet.id]
      if (wallet.has_credentials && !state?.portfolioValue && !state?.loading && !state?.error) {
        loadExchangePortfolio(wallet)
      }
    })
  }, [exchangeWallets, livePortfolios, loadExchangePortfolio])

  return { livePortfolios, loadExchangePortfolio }
}

export function useWalletBalanceData({
  fiatWallets,
  exchangeWallets,
  livePortfolios,
  currencyCode,
}) {
  const sourceCurrencies = useMemo(() => {
    const codes = new Set()
    fiatWallets.forEach(wallet => codes.add(wallet.currency))
    exchangeWallets.forEach(wallet => {
      const portfolio = livePortfolios[wallet.id]?.portfolioValue
      if (portfolio?.currency) codes.add(portfolio.currency)
    })
    codes.add(currencyCode)
    return [...codes].sort()
  }, [currencyCode, exchangeWallets, fiatWallets, livePortfolios])

  const { exchangeRateState, ratesError, ratesLoading } = useExchangeRates({
    currencyCode,
    sourceCurrencies,
  })

  const overallBalance = useMemo(() => {
    if (exchangeRateState.target !== currencyCode) return 0

    const convert = (amount, sourceCurrency) => {
      if (sourceCurrency === currencyCode) return Number(amount) || 0
      const rate = exchangeRateState.rates[sourceCurrency]
      return Number.isFinite(rate) ? (Number(amount) || 0) * rate : 0
    }

    const fiatTotal = fiatWallets.reduce(
      (sum, wallet) => sum + convert(wallet.balance ?? 0, wallet.currency),
      0,
    )
    const exchangeTotal = exchangeWallets.reduce((sum, wallet) => {
      const portfolio = livePortfolios[wallet.id]?.portfolioValue
      if (!portfolio) return sum
      return sum + convert(portfolio.amount, portfolio.currency)
    }, 0)

    return fiatTotal + exchangeTotal
  }, [currencyCode, exchangeRateState, exchangeWallets, fiatWallets, livePortfolios])

  const exchangeLoading = exchangeWallets.some(wallet => livePortfolios[wallet.id]?.loading)
  const exchangeErrors = exchangeWallets
    .map(wallet => livePortfolios[wallet.id]?.error)
    .filter(Boolean)

  return {
    loading: ratesLoading || exchangeLoading,
    overallBalance,
    ratesError,
    exchangeLoading,
    exchangeErrors,
  }
}
