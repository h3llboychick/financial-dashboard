import { useMemo, useState } from 'react'
import { deleteEntry } from '../api.js'
import { useCurrency } from '../contexts/CurrencyContext.jsx'
import { MONTHS_LONG } from '../constants.js'

function amountClass(type) {
  if (type === 'income') return 'text-green-600 dark:text-green-400'
  if (type === 'investment') return 'text-blue-600 dark:text-blue-400'
  return 'text-red-600 dark:text-red-400'
}

export default function EntryList({ entries, ledgers, categories, onDelete }) {
  const { format } = useCurrency()
  const now = new Date()
  const defaultLedger = ledgers.find(l => l.name === 'Spending') || ledgers[0]
  const [selectedLedger, setSelectedLedger] = useState(defaultLedger?.id ? String(defaultLedger.id) : 'all')
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [deletingId, setDeletingId] = useState(null)

  const ledgerMap = useMemo(
    () => Object.fromEntries(ledgers.map(l => [l.id, l])),
    [ledgers]
  )
  const colorMap = useMemo(
    () => Object.fromEntries(categories.map(c => [`${c.ledger_id}:${c.id}`, c.color])),
    [categories]
  )
  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c])),
    [categories]
  )

  const years = useMemo(() => {
    const ys = new Set(entries.map(e => new Date(e.date + 'T00:00:00').getFullYear()))
    ys.add(now.getFullYear())
    return Array.from(ys).sort((a, b) => b - a)
  }, [entries])

  const filtered = useMemo(() =>
    entries
      .filter(entry => {
        const d = new Date(entry.date + 'T00:00:00')
        const matchesLedger = selectedLedger === 'all' || entry.ledger_id === Number(selectedLedger)
        return matchesLedger && d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [entries, selectedLedger, selectedYear, selectedMonth]
  )

  const totals = filtered.reduce((sum, entry) => {
    const type = entry.ledger_type || ledgerMap[entry.ledger_id]?.type
    const entryCurrency = entry.currency || 'EUR'
    const bucket = type === 'income' ? sum.income : type === 'investment' ? sum.investment : sum.expense
    bucket[entryCurrency] = (bucket[entryCurrency] || 0) + entry.amount
    return sum
  }, { income: {}, expense: {}, investment: {} })

  const formatCurrencyTotals = (rows) => {
    const grouped = rows.reduce((sum, entry) => {
      const entryCurrency = entry.currency || 'EUR'
      sum[entryCurrency] = (sum[entryCurrency] || 0) + entry.amount
      return sum
    }, {})
    return formatCurrencyMap(grouped, format)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    setDeletingId(id)
    try {
      await deleteEntry(id)
      onDelete()
    } catch {
      alert('Failed to delete. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const selectCls = 'border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={selectedLedger} onChange={e => setSelectedLedger(e.target.value)} className={selectCls}>
          <option value="all">All ledgers</option>
          {ledgers.map(ledger => <option key={ledger.id} value={ledger.id}>{ledger.name}</option>)}
        </select>
        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className={selectCls}>
          {MONTHS_LONG.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={selectCls}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {filtered.length > 0 && (
          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{filtered.length}</span> entries
            {selectedLedger !== 'all' && (
              <>
                {' '}·{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrencyTotals(filtered)}
                </span>
              </>
            )}
          </span>
        )}
      </div>

      {selectedLedger === 'all' && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Summary label="Earned" value={formatCurrencyMap(totals.income, format)} className="text-green-600 dark:text-green-400" />
          <Summary label="Spent" value={formatCurrencyMap(totals.expense, format)} className="text-red-600 dark:text-red-400" />
          <Summary label="Invested" value={formatCurrencyMap(totals.investment, format)} className="text-blue-600 dark:text-blue-400" />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center text-gray-300 dark:text-gray-600 text-sm">
          No entries for {MONTHS_LONG[selectedMonth - 1]} {selectedYear}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Ledger</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Note</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
	                {filtered.map(entry => {
	                  const ledger = ledgerMap[entry.ledger_id]
	                  const category = categoryMap[entry.category_id]
	                  const color = colorMap[`${entry.ledger_id}:${entry.category_id}`] || ledger?.color || '#6b7280'
	                  const type = entry.ledger_type || ledger?.type
	                  const entryCurrency = entry.currency || 'EUR'
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{entry.date}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{entry.ledger_name || ledger?.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
	                          <span className="text-gray-700 dark:text-gray-300">{entry.category_name || category?.name || '-'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 dark:text-gray-500 max-w-xs truncate">{entry.note || '-'}</td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${amountClass(type)}`}>
                        {format(entry.amount, entryCurrency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCurrencyMap(grouped, format) {
  const rows = Object.entries(grouped)
    .filter(([, value]) => value > 0)
    .sort(([a], [b]) => a.localeCompare(b))

  if (rows.length === 0) return '-'
  return rows.map(([code, value]) => format(value, code)).join(' · ')
}

function Summary({ label, value, className }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3">
      <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${className}`}>{value}</p>
    </div>
  )
}
