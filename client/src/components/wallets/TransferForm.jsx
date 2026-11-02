import { useCallback, useEffect, useMemo, useState } from 'react'
import { createTransfer } from '../../api.js'
import { transferDestinations } from './walletUtils.js'

function todayIso() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export default function TransferForm({ wallets, onCreated, onCancel }) {
  const fiatWallets = useMemo(
    () => (wallets ?? []).filter(wallet => wallet.type === 'fiat'),
    [wallets]
  )
  const [fromId, setFromId] = useState(() => fiatWallets[0]?.id ?? '')
  const destinations = useMemo(() => transferDestinations(fiatWallets, fromId), [fiatWallets, fromId])
  const [toId, setToId] = useState(() => destinations[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!destinations.some(wallet => wallet.id === Number(toId))) {
      setToId(destinations[0]?.id ?? '')
    }
  }, [destinations, toId])

  const source = fiatWallets.find(wallet => wallet.id === Number(fromId))
  const parsedAmount = parseFloat(amount)
  const canSubmit = !!source && !!toId && Number.isFinite(parsedAmount) && parsedAmount > 0 && !!date

  const handleSubmit = useCallback(async e => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await createTransfer({
        from_wallet_id: Number(fromId),
        to_wallet_id: Number(toId),
        amount: parsedAmount,
        date,
        note: note.trim(),
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }, [canSubmit, fromId, toId, parsedAmount, date, note, onCreated])

  const fieldCls = 'px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3"
    >
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">New Transfer</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Moves money between two wallets without touching any ledger.
      </p>

      <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
      <select value={fromId} onChange={e => setFromId(e.target.value)} className={fieldCls}>
        {fiatWallets.map(wallet => (
          <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency}</option>
        ))}
      </select>

      <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
      <select value={toId} onChange={e => setToId(e.target.value)} className={fieldCls} disabled={destinations.length === 0}>
        {destinations.length === 0 ? (
          <option value="">No wallet with the same currency</option>
        ) : destinations.map(wallet => (
          <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency}</option>
        ))}
      </select>

      <label className="text-xs text-gray-500 dark:text-gray-400">
        Amount{source ? ` (${source.currency})` : ''}
      </label>
      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        className={fieldCls}
        required
      />

      <label className="text-xs text-gray-500 dark:text-gray-400">Date</label>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldCls} required />

      <label className="text-xs text-gray-500 dark:text-gray-400">Note</label>
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Optional"
        className={fieldCls}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Moving…' : 'Transfer'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          Cancel
        </button>
      </div>
    </form>
  )
}
