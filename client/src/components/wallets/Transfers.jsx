import { useState } from 'react'
import { deleteTransfer } from '../../api.js'
import { formatCurrency } from './walletUtils.js'

export default function Transfers({ transfers, onDeleted }) {
  const [removingId, setRemovingId] = useState(null)
  const [error, setError] = useState(null)

  if (!transfers || transfers.length === 0) return null

  async function handleDelete(transfer) {
    setRemovingId(transfer.id)
    setError(null)
    try {
      await deleteTransfer(transfer.id)
      onDeleted()
    } catch (e) {
      setError(e.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <section>
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Transfers</h3>
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <ul className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {transfers.map(transfer => (
          <li key={transfer.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                {transfer.from_wallet_name} → {transfer.to_wallet_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {transfer.date}
                {transfer.note ? ` · ${transfer.note}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(transfer.amount, transfer.currency)}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(transfer)}
                disabled={removingId === transfer.id}
                aria-label={`Delete transfer from ${transfer.from_wallet_name} to ${transfer.to_wallet_name}`}
                className="text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
