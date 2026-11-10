import type { ReactNode } from 'react'
import { errorMessage } from '../lib/supabase'

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-orange" />
      {label}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="card border-danger/40 p-4 text-sm" role="alert">
      <p className="font-semibold text-danger">No se pudo completar</p>
      <p className="mt-1 text-muted">{errorMessage(error)}</p>
      {onRetry && <button className="btn btn-secondary mt-3" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="text-4xl" aria-hidden>🏁</div>
      <h2 className="text-lg font-bold">{title}</h2>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {right}
    </div>
  )
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'orange' | 'blue' | 'gold' }) {
  const cls = {
    muted: 'bg-surface2 text-muted border-line',
    orange: 'bg-orange/15 text-orange border-orange/40',
    blue: 'bg-blue/15 text-blue border-blue/40',
    gold: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/40',
  }[tone]
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>
}
