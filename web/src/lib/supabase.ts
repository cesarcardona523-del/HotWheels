import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
})

export const IMAGE_BUCKET = 'hw-car-images'

export function errorMessage(e: unknown): string {
  if (!navigator.onLine) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: unknown }).message)
    if (msg.includes('DUPLICATE_CAR')) return 'Ya existe un carro con el mismo casting, año y color.'
    if (msg.includes('row-level security')) return 'No tienes permiso para esta acción.'
    if (msg.includes('Failed to fetch')) return 'No se pudo conectar con el servidor.'
    return msg
  }
  return 'Ocurrió un error inesperado.'
}
