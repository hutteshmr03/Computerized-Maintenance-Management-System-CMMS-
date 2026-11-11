import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, getToken, setToken } from './api'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    api.get('/api/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])

  const login = useCallback(async (email, password) => {
    const r = await api.post('/api/login', { email, password })
    setToken(r.token)
    setUser(r.user)
    return r.user
  }, [])

  const logout = useCallback(() => { setToken(null); setUser(null) }, [])
  const can = useCallback(
    (p) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'super_admin') return true
      if (user.permissions?.includes('*')) return true
      return !!user.permissions?.includes(p)
    },
    [user]
  )

  return <AuthCtx.Provider value={{ user, ready, login, logout, can }}>{children}</AuthCtx.Provider>
}
