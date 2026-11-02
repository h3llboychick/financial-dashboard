import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createRecurringRule,
  deleteRecurringRule,
  getRecurringRules,
  updateRecurringRule,
} from '../../api.js'
import { useCurrency } from '../../contexts/CurrencyContext.jsx'
import { MONTHS, PRESETS, WEEKDAYS, buildSchedule, scheduleFormFromRule } from './recurringSchedule.js'

function todayIso() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const labelCls = 'text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500'
const fieldCls = 'px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
const fullFieldCls = `${fieldCls} w-full`

export default function Recurring({ ledgers, wallets, categories, onDataChange }) {
  const { format } = useCurrency()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const fiatWallets = useMemo(() => (wallets ?? []).filter(wallet => wallet.type === 'fiat'), [wallets])
  const orderedRules = useMemo(
    () => [...rules].sort((left, right) => (left.next_occurrence ?? '9999').localeCompare(right.next_occurrence ?? '9999')),
    [rules],
  )

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

  async function handleToggle(rule) {
    setError(null)
    try {
      await updateRecurringRule(rule.id, { active: !rule.active })
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
            Entries appear automatically on the schedule you set, both income and spending.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => { setCreating(true); setEditingId(null) }}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            + Add rule
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {creating && (
        <RecurringForm
          ledgers={ledgers}
          wallets={fiatWallets}
          categories={categories}
          onSaved={async () => {
            setCreating(false)
            await refresh()
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {rules.length === 0 && !creating && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">🔁</p>
          <p>No recurring payments yet. Add one for your scholarship or a subscription.</p>
        </div>
      )}

      {rules.length > 0 && (
        <ul className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {orderedRules.map(rule => (
            <li key={rule.id} className="px-4 py-3">
              {editingId === rule.id ? (
                <RecurringForm
                  rule={rule}
                  ledgers={ledgers}
                  wallets={fiatWallets}
                  categories={categories}
                  onSaved={async () => {
                    setEditingId(null)
                    await refresh()
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${rule.active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                      {rule.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {rule.ledger_name} · {rule.wallet_name} · {rule.category_name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {rule.schedule}
                      {rule.next_occurrence ? ` · next ${rule.next_occurrence}` : ''}
                      {rule.end_date ? ` · ends ${rule.end_date}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-sm font-medium ${rule.ledger_type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {rule.ledger_type === 'income' ? '+' : rule.ledger_type === 'expense' ? '−' : ''}{format(rule.amount, rule.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setEditingId(rule.id); setCreating(false) }}
                      aria-label={`Edit rule ${rule.name}`}
                      className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
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
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RecurringForm({ rule = null, ledgers, wallets, categories, onSaved, onCancel }) {
  const initial = useMemo(() => scheduleFormFromRule(rule ?? {}), [rule])

  const [name, setName] = useState(rule?.name ?? '')
  const [ledgerId, setLedgerId] = useState(rule?.ledger_id ?? ledgers[0]?.id ?? '')
  const [walletId, setWalletId] = useState(rule?.wallet_id ?? wallets[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(rule?.category_id ?? '')
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '')
  const [preset, setPreset] = useState(initial.preset)
  const [day, setDay] = useState(initial.day)
  const [weekday, setWeekday] = useState(initial.weekday)
  const [interval, setIntervalCount] = useState(String(initial.interval))
  const [month, setMonth] = useState(initial.month)
  const [startDate, setStartDate] = useState(rule?.start_date ?? todayIso)
  const [endDate, setEndDate] = useState(rule?.end_date ?? '')
  const [note, setNote] = useState(rule?.note ?? '')
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

  const wallet = wallets.find(item => Number(item.id) === Number(walletId))
  const needsDay = preset === 'month_day' || preset === 'every_n_months' || preset === 'yearly'
  const needsInterval = preset === 'every_n_months' || preset === 'weekly' || preset === 'every_n_days'
  const parsedAmount = parseFloat(amount)
  const canSubmit =
    !!name.trim() &&
    !!ledgerId &&
    !!walletId &&
    !!categoryId &&
    Number.isFinite(parsedAmount) && parsedAmount > 0 &&
    !!startDate

  const intervalUnit = preset === 'every_n_days' ? 'days' : preset === 'weekly' ? 'weeks' : 'months'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...buildSchedule({ preset, day, weekday, interval, month }),
        name: name.trim(),
        ledger_id: Number(ledgerId),
        wallet_id: Number(walletId),
        category_id: Number(categoryId),
        amount: parsedAmount,
        start_date: startDate,
        end_date: endDate || null,
        note: note.trim(),
      }
      if (rule) await updateRecurringRule(rule.id, payload)
      else await createRecurringRule(payload)
      await onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={rule
        ? 'flex flex-col gap-4'
        : 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5 flex flex-col gap-4'}
    >
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
        {rule ? `Edit ${rule.name}` : 'New recurring payment'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem] gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Name</span>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={fullFieldCls} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Amount{wallet ? ` (${wallet.currency})` : ''}</span>
          <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={fullFieldCls} required />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Ledger</span>
          <select value={ledgerId} onChange={e => setLedgerId(e.target.value)} className={fullFieldCls}>
            {ledgers.map(ledger => (
              <option key={ledger.id} value={ledger.id}>{ledger.name} · {ledger.type}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Wallet</span>
          <select value={walletId} onChange={e => setWalletId(e.target.value)} className={fullFieldCls}>
            {wallets.map(item => (
              <option key={item.id} value={item.id}>{item.name} ({item.currency})</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Category</span>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={fullFieldCls} disabled={ledgerCategories.length === 0}>
            {ledgerCategories.length === 0 ? (
              <option value="">No categories in this ledger</option>
            ) : ledgerCategories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelCls}>Repeat</span>
        <div className="flex flex-wrap items-center gap-2">
          <select value={preset} onChange={e => setPreset(e.target.value)} className={`${fieldCls} w-auto`}>
            {PRESETS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>

          {needsInterval && (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400">every</span>
              <input
                type="number"
                min="1"
                max="365"
                value={interval}
                onChange={e => setIntervalCount(e.target.value)}
                aria-label={`Interval in ${intervalUnit}`}
                className={`${fieldCls} w-20`}
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">{intervalUnit}</span>
            </>
          )}

          {preset === 'weekly' && (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400">on</span>
              <select value={weekday} onChange={e => setWeekday(e.target.value)} className={`${fieldCls} w-auto`}>
                {WEEKDAYS.map((label, index) => (
                  <option key={label} value={String(index)}>{label}</option>
                ))}
              </select>
            </>
          )}

          {preset === 'yearly' && (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400">on</span>
              <select value={month} onChange={e => setMonth(e.target.value)} className={`${fieldCls} w-auto`}>
                {MONTHS.map((label, index) => (
                  <option key={label} value={String(index + 1)}>{label}</option>
                ))}
              </select>
            </>
          )}

          {needsDay && (
            <>
              {preset !== 'yearly' && (
                <span className="text-sm text-gray-500 dark:text-gray-400">on day</span>
              )}
              <select value={day} onChange={e => setDay(e.target.value)} className={`${fieldCls} w-20`}>
                {Array.from({ length: 31 }, (_, index) => index + 1).map(value => (
                  <option key={value} value={String(value)}>{value}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[9rem_9rem_1fr] gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Starts</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fullFieldCls} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Ends (optional)</span>
          <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className={fullFieldCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Note</span>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" className={fullFieldCls} />
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : rule ? 'Save changes' : 'Create rule'}
        </button>
      </div>
    </form>
  )
}
