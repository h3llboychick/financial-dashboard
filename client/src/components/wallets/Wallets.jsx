import { useCallback, useState } from 'react'
import { useCurrency } from '../../contexts/CurrencyContext.jsx'
import WalletCard from './WalletCard.jsx'
import AddWalletForm from './AddWalletForm.jsx'
import {
  useExchangeOptions,
  useLivePortfolios,
  useWalletBalanceData,
  useWalletGroups,
  useWalletList,
} from './walletHooks.js'


export default function Wallets({onDataChange}) {
  const { currency, format } = useCurrency()
  const [showAddForm, setShowAddForm] = useState(false)
  const { wallets, loading, error, refreshWallets } = useWalletList(onDataChange)
  const exchangeOptions = useExchangeOptions()
  const { fiatWallets, exchangeWallets, existingFiatCurrencies } = useWalletGroups(wallets)
  const { livePortfolios, loadExchangePortfolio } = useLivePortfolios(exchangeWallets)
  const {
    loading: balanceLoading,
    overallBalance,
    ratesError,
    exchangeLoading,
    exchangeErrors,
  } = useWalletBalanceData({
    fiatWallets,
    exchangeWallets,
    livePortfolios,
    currencyCode: currency.code,
  })

  const handleCreated = useCallback(() => {
    setShowAddForm(false)
    refreshWallets()
  }, [refreshWallets])

  if (loading || (wallets?.length > 0 && balanceLoading)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 dark:text-gray-500">Loading wallets…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Wallets</h2>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Wallet'}
        </button>
      </div>

      {wallets?.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">
            Overall Balance
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {format(overallBalance)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Converted to {currency.code}{exchangeLoading ? ' · loading exchange balance' : ''}
          </p>
          {ratesError && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{ratesError}</p>}
          {exchangeErrors.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              Exchange unavailable: {exchangeErrors[0]}
            </p>
          )}
        </section>
      )}

      {showAddForm && (
        <AddWalletForm
          existingFiatCurrencies={existingFiatCurrencies}
          exchangeOptions={exchangeOptions}
          onCreated={handleCreated}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {wallets?.length === 0 && !showAddForm && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">💰</p>
          <p>No wallets yet. Add one to start tracking your balances.</p>
        </div>
      )}

      {fiatWallets.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Fiat</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fiatWallets.map(w => (
              <WalletCard
                key={w.id}
                wallet={w}
                exchangeOptions={exchangeOptions}
                onRefreshLive={loadExchangePortfolio}
                onUpdated={refreshWallets}
                onDeleted={refreshWallets}
              />
            ))}
          </div>
        </section>
      )}

      {exchangeWallets.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Exchanges</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {exchangeWallets.map(w => {
              const state = livePortfolios[w.id] || {}
              return (
                <WalletCard
                  key={w.id}
                  wallet={w}
                  exchangeOptions={exchangeOptions}
                  portfolioValue={state.portfolioValue}
                  loadingLive={!!state.loading}
                  liveError={state.error}
                  onRefreshLive={loadExchangePortfolio}
                  onUpdated={refreshWallets}
                  onDeleted={refreshWallets}
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
