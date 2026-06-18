import { useState, useEffect, useCallback } from 'react'
import { getConfig, loginTelegram } from '../api.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import TelegramLoginButton from './TelegramLoginButton.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const [botName, setBotName] = useState(undefined) // undefined = loading, null = not configured, string = ready
  const [error, setError] = useState(null)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    getConfig()
      .then(cfg => setBotName(cfg.bot_name || cfg.botName || null))
      .catch(() => setError('Could not reach the server.'))
  }, [])

  const handleAuth = useCallback(async (telegramData) => {
    setError(null)
    setSigningIn(true)
    try {
      const { token, user } = await loginTelegram(telegramData)
      login(token, user)
    } catch (err) {
      setError(err.message)
      setSigningIn(false)
    }
  }, [login])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Financial Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to continue</p>
        </div>

        {botName === undefined && !error && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Connecting...</p>
        )}

        {botName === null && (
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            Telegram auth is not configured on the server.<br />
            Set <code className="font-mono text-xs">TELEGRAM_BOT_NAME</code> in <code className="font-mono text-xs">server/.env</code> and restart.
          </p>
        )}

        {botName && !signingIn && typeof botName === 'string' && (
          <TelegramLoginButton botName={botName} onAuth={handleAuth} />
        )}

        {signingIn && (
          <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Signing in...</p>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-600">
          Your data is stored locally on the server and never shared.
        </p>
      </div>
    </div>
  )
}
