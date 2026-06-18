import { useState, useCallback, useEffect, useMemo } from 'react'
import { formatCurrency, getEmptyCredentialValues } from './walletUtils'
import {
   updateWallet,
   deleteWallet,
   saveWalletCredentials,
} from '../../api.js'

export default function WalletCard({
  wallet,
  exchangeOptions = DEFAULT_EXCHANGES,
  portfolioValue,
  loadingLive,
  liveError,
  onRefreshLive,
  onUpdated,
  onDeleted,
}) {
  const [editing, setEditing] = useState(false)
  const [initialBalance, setInitialBalance] = useState(String(wallet.initial_balance ?? 0))
  const [saving, setSaving] = useState(false)

  const [showCreds, setShowCreds] = useState(false)
  const [slug, setSlug] = useState(wallet.slug ?? exchangeOptions[0]?.slug ?? '')
  const [credentialValues, setCredentialValues] = useState({})
  const [savingCreds, setSavingCreds] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const isFiat = wallet.type === 'fiat'
  const selectedExchange = useMemo(
    () => exchangeOptions.find(exchange => exchange.slug === slug) ?? exchangeOptions[0] ?? null,
    [exchangeOptions, slug],
  )
  const storedExchange = useMemo(
    () => exchangeOptions.find(exchange => exchange.slug === wallet.slug) ?? null,
    [exchangeOptions, wallet.slug],
  )
  const credentialFields = selectedExchange?.credentialFields ?? []
  const canSaveCreds = !!slug
    && credentialFields.length > 0
    && credentialFields.every(field => !field.required || String(credentialValues[field.name] || '').trim())

  useEffect(() => {
    setSlug(currentSlug => {
      if (currentSlug && exchangeOptions.some(exchange => exchange.slug === currentSlug)) return currentSlug
      if (wallet.slug && exchangeOptions.some(exchange => exchange.slug === wallet.slug)) return wallet.slug
      return exchangeOptions[0]?.slug ?? currentSlug
    })
  }, [exchangeOptions, wallet.slug])

  useEffect(() => {
    setCredentialValues(previous => ({
      ...getEmptyCredentialValues(selectedExchange),
      ...Object.fromEntries(
        credentialFields.map(field => [field.name, previous[field.name] ?? '']),
      ),
    }))
  }, [credentialFields, selectedExchange])

  const handleSaveBalance = useCallback(async () => {
    setSaving(true)
    try {
      await updateWallet(wallet.id, { initial_balance: parseFloat(initialBalance) || 0 })
      onUpdated()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [wallet.id, initialBalance, onUpdated])

  const handleSaveCreds = useCallback(async () => {
    if (!canSaveCreds) return
    setSavingCreds(true)
    try {
      const credentials = Object.fromEntries(
        credentialFields.map(field => [field.name, String(credentialValues[field.name] || '').trim()]),
      )
      await saveWalletCredentials(wallet.id, { slug, credentials })
      onUpdated()
      setShowCreds(false)
      setCredentialValues(getEmptyCredentialValues(selectedExchange))
    } finally {
      setSavingCreds(false)
    }
  }, [canSaveCreds, credentialFields, credentialValues, onUpdated, selectedExchange, slug, wallet.id])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{wallet.name}</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {isFiat ? wallet.currency : (storedExchange?.displayName ?? wallet.slug ?? 'exchange')}
          </span>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-colors text-xs"
        >
          ✕
        </button>
      </div>

      {/* Balance */}
      {isFiat ? (
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(wallet.balance ?? 0, wallet.currency)}
          </p>
          {editing ? (
            <div className="mt-2 flex gap-2 items-center">
              <input
                type="number"
                value={initialBalance}
                onChange={e => setInitialBalance(e.target.value)}
                className="w-32 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Baseline balance"
              />
              <button
                onClick={handleSaveBalance}
                disabled={saving}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setInitialBalance(String(wallet.initial_balance ?? 0)); setEditing(true) }}
              className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 mt-1 transition-colors"
            >
              Set baseline balance ({formatCurrency(wallet.initial_balance ?? 0, wallet.currency)})
            </button>
          )}
        </div>
      ) : (
        <div>
          {portfolioValue ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">
                Total Portfolio Value
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {formatCurrency(portfolioValue.amount, portfolioValue.currency)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {wallet.has_credentials ? 'Click Refresh to load portfolio value' : 'No API credentials set'}
            </p>
          )}
          {liveError && <p className="text-xs text-red-500 mt-1">{liveError}</p>}
          <div className="flex gap-2 mt-3 flex-wrap">
            {wallet.has_credentials && (
              <button
                onClick={() => onRefreshLive(wallet)}
                disabled={loadingLive}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {loadingLive ? 'Loading…' : 'Refresh'}
              </button>
            )}
            <button
              onClick={() => setShowCreds(v => !v)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {wallet.has_credentials ? 'Update credentials' : 'Set credentials'}
            </button>
          </div>
          {showCreds && (
            <div className="mt-3 space-y-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <select
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {exchangeOptions.map(exchange => (
                  <option key={exchange.slug} value={exchange.slug}>{exchange.displayName}</option>
                ))}
              </select>
              {credentialFields.map(field => (
                <input
                  key={field.name}
                  type={field.secret ? 'password' : 'text'}
                  placeholder={field.label}
                  value={credentialValues[field.name] ?? ''}
                  onChange={e => setCredentialValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
                />
              ))}
              {credentialFields.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Credential fields are not available for this exchange.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCreds}
                  disabled={savingCreds || !canSaveCreds}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                >
                  {savingCreds ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setShowCreds(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">Delete this wallet?</span>
          <button
            onClick={async () => { await deleteWallet(wallet.id); onDeleted() }}
            className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded"
          >
            Delete
          </button>
          <button onClick={() => setConfirmDelete(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}
    </div>
  )
}