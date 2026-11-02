import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createRecurringRule,
  deleteRecurringRule,
  getRecurringRules,
  runRecurring,
  updateRecurringRule,
} from '../../api.js'
import { useCurrency } from '../../contexts/CurrencyContext.jsx'
import { nextOccurrence } from './recurringUtils.js'

function todayIso() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const fieldCls = 'px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'

export default function Recurring({ ledgers, wallets, categories, onDataChange }) {
  const { format } = useCurrency()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [running, setRunning] = useState(false)

  const fiatWallets = useMemo(() => (wallets ?? []).filter(wallet => wallet.type === 'fiat'), [wallets])

  const loadRules = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      setRules(await getRecurringRules())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  const refresh = useCallback(async () => {
    await loadRules({ silent: true })
    onDataChange?.()
  }, [loadRules, onDataChange])

  async function handleRunNow() {
    setRunning(true)
    setError(null)
    try {
      await runRecurring()
      await refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  async function handleToggle(rule) {
    setError(null)
    try {
      await updateRecurringRule(rule.id, { active: rule.active ? false : true })
      await refresh()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(rule) {
    setError(null)
    try {
      await deleteRecurringRule(rule.id)
      await refresh()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 dark:text-gray-500">Loading recurring payments…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recurring payments</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Entries are created automatically on the day you pick, once a month.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunNow}
            disabled={running}
            className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {running ? 'Running…' : 'Run now'}
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add rule'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {showForm && (
        <RecurringForm
          ledgers={ledgers}
          wallets={fiatWallets}
          categories={categories}
          onCreated={async () => {
            setShowForm(false)
            await refresh()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {rules.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">🔁</p>
          <p>No recurring payments yet. Add one for your scholarship or a subscription.</p>
        </div>
      )}

      {rules.length > 0 && (
        <ul className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {rules.map(rule => {
            const next = nextOccurrence({ dayOfMonth: rule.day_of_month })
            return (
              <li key={rule.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${rule.active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                    {rule.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {rule.ledger_name} · {rule.wallet_name} · {rule.category_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {next ? `next ${next.date}` : 'no next date'}
                    {rule.last_generated_on ? ` · last ${rule.last_generated_on}` : ' · never run'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {format(rule.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggle(rule)}
                    className="text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                  >
                    {rule.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rule)}
                    aria-label={`Delete rule ${rule.name}`}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function RecurringForm({ ledgers, wallets, categories, onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [ledgerId, setLedgerId] = useState(ledgers[0]?.id ?? '')
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [startDate, setStartDate] = useState(todayIso)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const ledgerCategories = useMemo(
    () => (categories ?? []).filter(category => Number(category.ledger_id) === Number(ledgerId)),
    [categories, ledgerId]
  )

  useEffect(() => {
    if (!ledgerCategories.some(category => category.id === Number(categoryId))) {
      setCategoryId(ledgerCategories[0]?.id ?? '')
    }
  }, [ledgerCategories, categoryId])

  const parsedAmount = parseFloat(amount)
  const parsedDay = Number(dayOfMonth)
  const canSubmit =
    !!name.trim() &&
    !!ledgerId &&
    !!walletId &&
    !!categoryId &&
    Number.isFinite(parsedAmount) && parsedAmount > 0 &&
    Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31 &&
    !!startDate

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      await createRecurringRule({
        name: name.trim(),
        ledger_id: Number(ledgerId),
        wallet_id: Number(walletId),
        category_id: Number(categoryId),
        amount: parsedAmount,
        day_of_month: parsedDay,
        start_date: startDate,
        note: note.trim(),
      })
      await onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3"
    >
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">New recurring payment</h3>

      <label className="text-xs text-gray-500 dark:text-gray-400">Name</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} className={fieldCls} required />

      <label className="text-xs text-gray-500 dark:text-gray-400">Ledger</label>
      <select value={ledgerId} onChange={e => setLedgerId(e.target.value)} className={fieldCls}>
        {ledgers.map(ledger => (
          <option key={ledger.id} value={ledger.id}>{ledger.name} · {ledger.type}</option>
        ))}
      </select>

      <label className="text-xs text-gray-500 dark:text-gray-400">Wallet</label>
      <select value={walletId} onChange={e => setWalletId(e.target.value)} className={fieldCls}>
        {wallets.map(wallet => (
          <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency}</option>
        ))}
      </select>

      <label className="text-xs text-gray-500 dark:text-gray-400">Category</label>
      <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={fieldCls} disabled={ledgerCategories.length === 0}>
        {ledgerCategories.length === 0 ? (
          <option value="">This ledger has no categories yet</option>
        ) : ledgerCategories.map(category => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>

      <label className="text-xs text-gray-500 dark:text-gray-400">Amount</label>
      <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={fieldCls} required />

      <label className="text-xs text-gray-500 dark:text-gray-400">Day of month (1-31)</label>
      <input type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} className={fieldCls} required />

      <label className="text-xs text-gray-500 dark:text-gray-400">Start date</label>
      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fieldCls} required />

      <label className="text-xs text-gray-500 dark:text-gray-400">Note</label>
      <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" className={fieldCls} />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Creating…' : 'Create rule'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          Cancel
        </button>
      </div>
    </form>
  )
}
