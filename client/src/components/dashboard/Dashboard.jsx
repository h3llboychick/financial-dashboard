import { useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { useCurrency } from '../../contexts/CurrencyContext.jsx'
import { useExchangeRates } from '../../hooks/useExchangeRates.js'
import { MONTHS_LONG } from '../../constants.js'
import { CustomTooltip, PieTooltip } from './ChartTooltips.jsx'
import { useDashboardData } from './dashboardData.js'
import { getEntryCurrency } from './dashboardUtils.js'
import AnalyticsPanel from './AnalyticsPanel.jsx'
import MetricCard from './MetricCard.jsx'
import RecentActivity from './RecentActivity.jsx'

export default function Dashboard({ entries, wallets = [], ledgers, categories }) {
  const { currency, format } = useCurrency()
  const sourceCurrencies = useMemo(() =>
    [...new Set(entries.map(entry => getEntryCurrency(entry)))].sort(),
    [entries]
  )
  const { exchangeRateState, ratesError, ratesLoading } = useExchangeRates({
    currencyCode: currency.code,
    sourceCurrencies,
  })
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const {
    filters: { years },
    summary: { totals, net, netChange },
    charts: { barData, ledgerPieData },
    analytics,
  } = useDashboardData({ entries, ledgers, categories, selectedMonth, selectedYear, currencyCode: currency.code, exchangeRateState })

  const inputCls = 'border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'

  if (entries.length > 0 && ratesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 dark:text-gray-500">Loading…</p>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
          {MONTHS_LONG[selectedMonth - 1]} {selectedYear}
        </h2>
        <div className="flex items-center gap-2">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className={inputCls}>
            {MONTHS_LONG.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={inputCls}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {ratesError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          {ratesError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Earned" value={format(totals.income)} sub="income ledgers" highlight="green" />
        <MetricCard label="Spent" value={format(totals.expense)} sub="expense ledgers" highlight="red" />
        <MetricCard label="Invested" value={format(totals.investment)} sub="investment ledgers" highlight="blue" />
        <MetricCard
          label="Net Cash Flow"
          value={format(net)}
          sub={netChange === null ? 'Last month: N/A' : `vs last month: ${netChange >= 0 ? '+' : ''}${netChange.toFixed(1)}%`}
          highlight={net >= 0 ? 'green' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">Last 12 Months</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:[&>line]:stroke-gray-700" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip format={format} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Earned" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Spent" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Invested" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">This Month by Ledger</h3>
          {ledgerPieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-300 dark:text-gray-600 text-sm">
              No data for this month
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={ledgerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40}>
                  {ledgerPieData.map(entry => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip format={format} />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <AnalyticsPanel analytics={analytics} format={format} />

      <RecentActivity
        entries={entries}
        wallets={wallets}
        ledgers={ledgers}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        format={format}
      />
    </div>
  )
}
