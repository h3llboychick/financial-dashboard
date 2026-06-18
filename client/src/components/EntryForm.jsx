import { useEffect, useMemo, useRef, useState } from 'react'
import { createEntry } from '../api.js'
import { useCurrency } from '../contexts/CurrencyContext.jsx'

export default function EntryForm({ wallets, ledgers, categories, onSuccess}) {
  const { currency, currencies } = useCurrency()
  const today = new Date().toISOString().split('T')[0]
  const [walletId, setWalletId] = useState('')
  const [ledgerId, setLedgerId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState(currency.code)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const successTimer = useRef(null)

  const ledgerCategories = useMemo(
    () => categories.filter(c => c.ledger_id === Number(ledgerId)),
    [categories, ledgerId]
  )
  const availableWallets = useMemo(
    () => wallets.filter(w => w.currency === selectedCurrency && w.type == "fiat"),
    [wallets, selectedCurrency]
  )
  const selectedLedger = ledgers.find(l => l.id === Number(ledgerId))

  useEffect(() => {
    if (!ledgerId) {
      const match = ledgers.find(l => l.name === 'Spending') || ledgers[0]
      setLedgerId(match.id)
    }
  }, [ledgerId, ledgers])

  useEffect(() => {
    const match = wallets.find(w => w.currency === selectedCurrency && w.type === 'fiat')
    setWalletId(match?.id || '')
  }, [selectedCurrency, wallets])

  useEffect(() => {
    if (ledgerCategories.length === 0) return
    if (!ledgerCategories.some(c => c.id === Number(categoryId))) {
      setCategoryId(ledgerCategories[0].id)
    }
  }, [categoryId, ledgerCategories])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!ledgerId) {
      setError('Please choose a ledger.')
      return
    }
    if (!categoryId) {
      setError('Please choose a category.')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.')
      return
    }

    setLoading(true)
    try {
      await createEntry(
        { 
          currency: selectedCurrency, 
          ledger_id: Number(ledgerId), 
          amount: parsedAmount, 
          wallet_id: Number(walletId),
          category_id: Number(categoryId),
          note: note,
          date: date
        }
      )
      setAmount('')
      setNote('')
      setDate(today)
      clearTimeout(successTimer.current)
      setSuccess(true)
      successTimer.current = setTimeout(() => setSuccess(false), 3000)
      onSuccess()
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedCat = ledgerCategories.find(c => c.id === Number(categoryId))

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">Add Entry</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Ledger">
          <select value={ledgerId} onChange={e => setLedgerId(e.target.value)} className="input">
            {ledgers.map(ledger => (
              <option key={ledger.id} value={ledger.id}>{ledger.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Amount">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="number"
              name="amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              autoFocus
              className="input"
            />
            <select
              name="currency"
              value={selectedCurrency}
              onChange={e => setSelectedCurrency(e.target.value)}
              className="input w-28"
            >
              {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
        </Field>

        <Field label="Wallet">
          <div className="flex gap-2 items-center">
            { availableWallets.length >= 1 ?
              <select name="wallet" value={walletId} onChange={e => setWalletId(e.target.value)} className="input flex-1">
                {availableWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              :
              <p className="font-semibold text-gray-900 dark:text-gray-100">Please, first create a wallet in target currency</p>
            }
          </div>
        </Field>

        <Field label="Category">
          <div className="flex gap-2 items-center">
            {selectedCat && (
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedCat.color }} />
            )}
            <select name="category" value={categoryId} onChange={e => setCategoryId(e.target.value)} className="input flex-1">
              {ledgerCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </Field>

        <Field label="Date">
          <input type="date" name="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
        </Field>

        <Field label={<>Note <span className="text-gray-400 font-normal">(optional)</span></>}>
          <input
            type="text"
            name="note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={selectedLedger?.type === 'income' ? 'e.g. Salary' : 'e.g. Grocery run'}
            className="input"
          />
        </Field>

        {success && (
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            ✓ Entry added successfully!
          </p>
        )}
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !ledgerId || ledgerCategories.length === 0 || availableWallets.length === 0}
          className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : 'Add Entry'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}
