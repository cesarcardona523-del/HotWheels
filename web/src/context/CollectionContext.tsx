import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Collection, Role } from '../lib/types'
import { useAuth } from './AuthContext'

export interface MyCollection extends Collection { role: Role }

interface CollectionState {
  collections: MyCollection[]
  current: MyCollection | null
  setCurrentId: (id: string) => void
  loading: boolean
  error: unknown
  refetch: () => void
  canEdit: boolean
  isOwner: boolean
}
const Ctx = createContext<CollectionState | null>(null)
const KEY = 'hw.currentCollection'

export function CollectionProvider({ children }: { children: ReactNode }) {
  const { email } = useAuth()
  const q = useQuery({
    queryKey: ['collections', email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hw_collection_members')
        .select('role, collections:hw_collections(*)')
        .eq('email', email!)
      if (error) throw error
      return (data ?? [])
        .filter((r) => r.collections)
        .map((r) => ({ ...(r.collections as unknown as Collection), role: r.role as Role }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    },
  })
  const [currentId, setCurrentIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(KEY) } catch { return null }
  })
  const collections = useMemo(() => q.data ?? [], [q.data])
  const current = collections.find((c) => c.id === currentId) ?? collections[0] ?? null
  useEffect(() => {
    if (current && current.id !== currentId) setCurrentIdState(current.id)
  }, [current, currentId])
  const setCurrentId = (id: string) => {
    setCurrentIdState(id)
    try { localStorage.setItem(KEY, id) } catch { /* sin almacenamiento */ }
  }
  return (
    <Ctx.Provider
      value={{
        collections, current, setCurrentId, loading: q.isLoading, error: q.error, refetch: () => q.refetch(),
        canEdit: current?.role === 'owner' || current?.role === 'editor',
        isOwner: current?.role === 'owner',
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
export function useCollection() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCollection fuera de CollectionProvider')
  return c
}
