import { CURRENCIES } from "../../contexts/CurrencyContext"


export default function CurrencySettings({ currency, setCurrency }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Dashboard Currency</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CURRENCIES.map(c => (
          <button
            key={c.code}
            onClick={() => setCurrency(c.code)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              currency.code === c.code
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <span className="font-mono">{c.symbol.trim()}</span>
            <span className="ml-1.5 text-gray-500 dark:text-gray-400 font-normal">{c.code}</span>
          </button>
        ))}
      </div>
    </section>
  )
}