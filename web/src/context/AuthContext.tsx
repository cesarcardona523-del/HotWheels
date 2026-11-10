import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState { session: Session | null; loading: boolean; email: string | null }
const AuthCtx = createContext<AuthState>({ session: null, loading: true, email: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return (
    <AuthCtx.Provider value={{ session, loading, email: session?.user.email?.toLowerCase() ?? null }}>
      {children}
    </AuthCtx.Provider>
  )
}
export const useAuth = () => useContext(AuthCtx)
