import { useMemo } from 'react'
import { MONTHS_LONG } from '../../constants.js'
import { getRecentActivity } from './recentActivityData.js'

function amountClass(type) {
  if (type === 'income') return 'text-green-600 dark:text-green-400'
  if (type === 'investment') return 'text-blue-600 dark:text-blue-400'
  return 'text-red-600 dark:text-red-400'
}

function displayDate(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    .format(new Date(`${date}T00:00:00`))
}

function entryTitle(entry) {
  return entry.note?.trim() || entry.category_name || 'Untitled entry'
}

export default function RecentActivity({ entries, wallets, ledgers, selectedMonth, selectedYear, format }) {
  const recentEntries = useMemo(
    () => getRecentActivity(entries, selectedYear, selectedMonth),
    [entries, selectedMonth, selectedYear]
  )
  const walletMap = useMemo(
    () => Object.fromEntries(wallets.map(wallet => [wallet.id, wallet])),
    [wallets]
  )
  const ledgerMap = useMemo(
    () => Object.fromEntries(ledgers.map(ledger => [ledger.id, ledger])),
    [ledgers]
  )

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent activity</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Latest entries in {MONTHS_LONG[selectedMonth - 1]} {selectedYear}
          </p>
        </div>
        {recentEntries.length > 0 && (
          <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
            Latest {recentEntries.length} {recentEntries.length === 1 ? 'entry' : 'entries'}
          </span>
        )}
      </div>

      {recentEntries.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-gray-300 dark:text-gray-600">
          No activity for this month.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700">
          {recentEntries.map(entry => {
            const ledger = ledgerMap[entry.ledger_id]
            const wallet = walletMap[entry.wallet_id]
            const type = entry.ledger_type || ledger?.type || 'expense'
            const color = entry.category_color || entry.ledger_color || ledger?.color || '#6b7280'
            const currency = entry.currency || 'EUR'
            const prefix = type === 'income' ? '+' : '−'
            const details = [
              entry.category_name,
              entry.ledger_name || ledger?.name,
              wallet?.name,
              displayDate(entry.date),
            ].filter(Boolean)

            return (
              <li key={entry.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-gray-50 dark:bg-gray-700/60" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{entryTitle(entry)}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{details.join(' · ')}</p>
                </div>
                <span className={`whitespace-nowrap text-sm font-semibold ${amountClass(type)}`}>
                  {prefix}{format(entry.amount, currency)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
