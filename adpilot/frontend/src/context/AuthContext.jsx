import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('adpilot_token'))
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('adpilot_token')
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    const base = (import.meta.env.VITE_API_URL || '') + '/api'

    const checkAuth = (isRetry) =>
      fetch(`${base}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => {
        // A real 401 means the token itself is invalid — log out.
        if (r.status === 401) {
          logout()
          return
        }
        if (!r.ok) throw new Error('network')
        return r.json().then(setUser)
      }).catch((err) => {
        // Network error / server hiccup, not an invalid token — retry once
        // before giving up, instead of punishing a valid session for a
        // transient blip (this is what was forcing a logout after every
        // full-page reload, e.g. the OAuth connect flow).
        if (!isRetry) return checkAuth(true)
        throw err
      })

    checkAuth(false).finally(() => setLoading(false))
  }, [token, logout])

  const login = useCallback((newToken, userData) => {
    localStorage.setItem('adpilot_token', newToken)
    setToken(newToken)
    setUser(userData)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
