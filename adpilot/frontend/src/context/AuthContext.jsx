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
    fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('invalid')
        return r.json()
      })
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false))
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
