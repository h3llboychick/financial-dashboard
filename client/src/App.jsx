import { useState, useEffect, useCallback } from 'react'
import { getCategories, getEntries, getLedgers, getWallets } from './api.js'
import { useAuth } from './contexts/AuthContext.jsx'
import { useDarkMode } from './hooks/useDarkMode.js'
import LoginPage from './components/LoginPage.jsx'
import Dashboard from './components/dashboard/Dashboard.jsx'
import EntryForm from './components/EntryForm.jsx'
import EntryList from './components/EntryList.jsx'
import Settings from './components/settings/Settings.jsx'
import Wallets from './components/wallets/Wallets.jsx'

const TABS = ['Dashboard', 'Add Entry', 'History', 'Wallets', 'Settings']

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 1 1 0 10A5 5 0 0 1 12 7z" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export default function App() {
  const { isLoggedIn, user, logout } = useAuth()
  const [isDark, toggleDark] = useDarkMode()
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [ledgers, setLedgers] = useState([])
  const [entries, setEntries] = useState([])
  const [wallets, setWallets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const clearData = useCallback(() => {
    setLedgers([])
    setEntries([])
    setCategories([])
    setWallets([])
  }, [])

  const loadData = useCallback(async () => {
    setError(null)

    try {
      const [l, e, c, w] = await Promise.all([getLedgers(), getEntries(), getCategories(), getWallets()])
      setLedgers(l)
      setEntries(e)
      setCategories(c)
      setWallets(w)
      setError(null)
    } catch (err) {
      setError('Could not load data. Check server connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearData()
    setError(null)
    setLoading(true)
    if (!isLoggedIn) {
      return
    }
    loadData()
  }, [clearData, isLoggedIn, loadData])

  if (!isLoggedIn) return <LoginPage />

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 pt-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Financial Dashboard</h1>
          <div className="flex items-center gap-3">
            {user?.first_name && (
              <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                {user.first_name}
              </span>
            )}
            <button
              onClick={toggleDark}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={logout}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-4 mt-2 overflow-x-auto">
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 min-w-max">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-400 dark:text-gray-500">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-red-500">{error}</p>
          </div>
        ) : (
          <>
            {activeTab === 'Dashboard' && (
              <Dashboard entries={entries} ledgers={ledgers} categories={categories}/>
            )}
            {activeTab === 'Add Entry' && (
              <EntryForm
                wallets={wallets}
                ledgers={ledgers}
                categories={categories}
                onSuccess={() => { loadData()}}
              />
            )}
            {activeTab === 'History' && (
              <EntryList
                entries={entries}
                wallets={wallets}
                ledgers={ledgers}
                categories={categories}
                onDataChange={loadData}
              />
            )}
            {activeTab === 'Settings' && (
              <Settings ledgers={ledgers} categories={categories} onDataChange={loadData} />
            )}
            {activeTab === 'Wallets' && (
              <Wallets onDataChange={loadData}/>
            )}
          </>
        )}
      </main>
    </div>
  )
}
