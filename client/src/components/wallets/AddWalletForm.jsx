import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  createWallet,
} from '../../api.js'
import { CURRENCIES } from '../../contexts/CurrencyContext.jsx'

export default function AddWalletForm({ exchangeOptions, onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('fiat')
  const [currency, setCurrency] = useState('EUR')
  const [initialBalance, setInitialBalance] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const exchangePortfolioCurrencies = useMemo(
    () => [...new Set(exchangeOptions.map(exchange => exchange.portfolioCurrency).filter(Boolean))],
    [exchangeOptions],
  )
  const exchangeCurrencyLabel = exchangePortfolioCurrencies.length === 1
    ? `Portfolio value in ${exchangePortfolioCurrencies[0]}`
    : 'Exchange portfolio value'

  useEffect(() => {
    if (type !== 'fiat') {
      if (currency !== 'USD') setCurrency('USD')
      return
    }
  }, [currency, type])

  const handleSubmit = useCallback(async e => {
    e.preventDefault()
    if (!name.trim() || !currency) return
    setSaving(true)
    setError(null)
    try {
      await createWallet({ name: name.trim(), type, currency, initial_balance: parseFloat(initialBalance) || 0 })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }, [name, type, currency, initialBalance, onCreated])

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3"
    >
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">New Wallet</h3>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType('fiat')}
          className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${type === 'fiat' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          Fiat
        </button>
        <button
          type="button"
          onClick={() => setType('exchange')}
          className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${type === 'exchange' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          Exchange
        </button>
      </div>

      <input
        type="text"
        placeholder="Wallet name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {type === 'fiat' ? (
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      ) : (
        <div className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400">
          {exchangeCurrencyLabel}
        </div>
      )}

      {type === 'fiat' && (
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Baseline balance</label>
          <input
            type="number"
            value={initialBalance}
            onChange={e => setInitialBalance(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim() || !currency}
          className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Creating…' : 'Create Wallet'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          Cancel
        </button>
      </div>
    </form>
  )
}