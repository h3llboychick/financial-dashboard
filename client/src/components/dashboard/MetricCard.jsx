export default function MetricCard({ label, value, sub, highlight }) {
  const valueClass =
    highlight === 'red' ? 'text-red-600 dark:text-red-400' :
    highlight === 'green' ? 'text-green-600 dark:text-green-400' :
    highlight === 'blue' ? 'text-blue-600 dark:text-blue-400' :
    'text-gray-900 dark:text-gray-100'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}