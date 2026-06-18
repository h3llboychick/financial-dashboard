import { createContext, useContext, useState, useCallback, useMemo } from 'react'

export const CURRENCIES = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'PLN', symbol: 'zł' },
  { code: 'SEK', symbol: 'kr' },
  { code: 'NOK', symbol: 'kr' },
  { code: 'DKK', symbol: 'kr' },
  { code: 'CZK', symbol: 'Kč' },
  { code: 'HUF', symbol: 'Ft' },
  { code: 'RON', symbol: 'lei' },
  { code: 'BGN', symbol: 'лв' },
  { code: 'KZT', symbol: '₸' },
]

const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  const [code, setCode] = useState(() => localStorage.getItem('currency') || 'EUR')

  const currency = useMemo(
    () => CURRENCIES.find(c => c.code === code) || CURRENCIES[0],
    [code]
  )

  const setCurrency = useCallback((newCode) => {
    localStorage.setItem('currency', newCode)
    setCode(newCode)
  }, [])

  const format = useCallback(
    (amount, overrideCode) => {
      const targetCode = overrideCode || currency.code
      const value = Number(amount)
      if (!Number.isFinite(value)) return `0.00 ${targetCode}`

      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: targetCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value)
      } catch {
        return `${value.toFixed(2)} ${targetCode}`
      }
    },
    [currency.code]
  )

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, currencies: CURRENCIES }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
