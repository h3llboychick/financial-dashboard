import { useEffect, useMemo, useState } from 'react'
import { createCategory, createLedger, deleteCategory, deleteLedger } from '../../api.js'
import { useCurrency } from '../../contexts/CurrencyContext.jsx'
import { PRESET_COLORS, LEDGER_TYPES } from '../../constants.js'
import CurrencySettings from './CurrencySettings.jsx'

export default function Settings({ ledgers, categories, onDataChange }) {
  const { currency, setCurrency } = useCurrency()
  const defaultLedger = ledgers.find(l => l.name === 'Spending') || ledgers[0]
  const [selectedLedgerId, setSelectedLedgerId] = useState(defaultLedger?.id || '')

  useEffect(() => {
    if (!selectedLedgerId && defaultLedger) setSelectedLedgerId(defaultLedger.id)
    if (selectedLedgerId && !ledgers.some(l => l.id === Number(selectedLedgerId))) {
      setSelectedLedgerId(defaultLedger?.id || '')
    }
  }, [defaultLedger, ledgers, selectedLedgerId])

  return (
    <div className="space-y-8 max-w-2xl">
      <CurrencySettings currency={currency} setCurrency={setCurrency} />
      <LedgerSettings
        ledgers={ledgers}
        selectedLedgerId={selectedLedgerId}
        setSelectedLedgerId={setSelectedLedgerId}
        onDataChange={onDataChange}
      />
      <CategorySettings
        ledgers={ledgers}
        categories={categories}
        selectedLedgerId={selectedLedgerId}
        setSelectedLedgerId={setSelectedLedgerId}
        onDataChange={onDataChange}
      />
    </div>
  )
}

function LedgerSettings({ ledgers, selectedLedgerId, setSelectedLedgerId, onDataChange }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [color, setColor] = useState(PRESET_COLORS[4])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSaving(true)
    try {
      const ledger = await createLedger({ name: name.trim(), type, color })
      setName('')
      setSelectedLedgerId(ledger.id)
      onDataChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ledger) => {
    if (!confirm(`Delete ledger "${ledger.name}"?`)) return
    setDeletingId(ledger.id)
    try {
      await deleteLedger(ledger.id)
      onDataChange()
    } catch (err) {
      alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Ledgers</h2>

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 mb-5">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ledger name"
          maxLength={40}
          className="input"
        />
        <select value={type} onChange={e => setType(e.target.value)} className="input sm:w-36">
          {LEDGER_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          Add
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>}

      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {ledgers.map(ledger => (
          <li key={ledger.id} className="flex items-center gap-3 py-2.5">
            <button
              onClick={() => setSelectedLedgerId(ledger.id)}
              className={`w-3 h-3 rounded-full flex-shrink-0 ring-offset-2 dark:ring-offset-gray-800 ${
                Number(selectedLedgerId) === ledger.id ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{ backgroundColor: ledger.color }}
              title={`Manage ${ledger.name}`}
            />
            <button
              onClick={() => setSelectedLedgerId(ledger.id)}
              className="flex-1 text-left text-sm text-gray-800 dark:text-gray-200"
            >
              {ledger.name}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">{LEDGER_TYPES.find(t => t.value === ledger.type)?.label}</span>
            {ledger.is_default ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">default</span>
            ) : (
              <button
                onClick={() => handleDelete(ledger)}
                disabled={deletingId === ledger.id}
                className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 transition-colors"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CategorySettings({ ledgers, categories, selectedLedgerId, setSelectedLedgerId, onDataChange }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[4])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const selectedLedger = ledgers.find(ledger => ledger.id === Number(selectedLedgerId))
  const ledgerCategories = useMemo(
    () => categories.filter(cat => cat.ledger_id === Number(selectedLedgerId)),
    [categories, selectedLedgerId]
  )

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim() || !selectedLedger) return
    setError(null)
    setSaving(true)
    try {
      await createCategory({ ledger_id: selectedLedger.id, name: name.trim(), color })
      setName('')
      onDataChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return
    setDeletingId(cat.id)
    try {
      await deleteCategory(cat.id)
      onDataChange()
    } catch (err) {
      alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Categories</h2>
        <select value={selectedLedgerId} onChange={e => setSelectedLedgerId(e.target.value)} className="input max-w-xs">
          {ledgers.map(ledger => <option key={ledger.id} value={ledger.id}>{ledger.name}</option>)}
        </select>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-5">
        <div className="relative">
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="sr-only"
            id="cat-color"
          />
          <label
            htmlFor="cat-color"
            className="block w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer"
            style={{ backgroundColor: color }}
            title="Pick color"
          />
        </div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={selectedLedger ? `${selectedLedger.name} category` : 'Category name'}
          maxLength={40}
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={saving || !name.trim() || !selectedLedger}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          Add
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>}

      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {ledgerCategories.map(cat => (
          <li key={cat.id} className="flex items-center gap-3 py-2.5">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: cat.color }}
            />
            <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{cat.name}</span>
            {cat.is_default ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">default</span>
            ) : (
              <button
                onClick={() => handleDelete(cat)}
                disabled={deletingId === cat.id}
                className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 transition-colors"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
