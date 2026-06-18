import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)
const DEV_AUTH_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS !== 'false'
const DEV_TOKEN = 'dev-auth-bypass'
const DEV_USER = {
  id: 0,
  username: 'dev',
  first_name: 'Dev',
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => DEV_AUTH_BYPASS ? DEV_TOKEN : localStorage.getItem('auth_token'))
  const [user, setUser] = useState(() => {
    if (DEV_AUTH_BYPASS) return DEV_USER
    try { return JSON.parse(localStorage.getItem('auth_user')) } catch { return null }
  })

  const login = useCallback((token, user) => {
    if (DEV_AUTH_BYPASS) {
      setToken(DEV_TOKEN)
      setUser(DEV_USER)
      return
    }
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
    setToken(token)
    setUser(user)
  }, [])

  const logout = useCallback(() => {
    if (DEV_AUTH_BYPASS) {
      setToken(DEV_TOKEN)
      setUser(DEV_USER)
      return
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
