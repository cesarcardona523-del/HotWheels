import { useState, type FormEvent } from 'react'
import { errorMessage, isConfigured, supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'

export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    const clean = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return setError('Escribe un correo válido.')
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) return setError(error.status === 429 ? 'Demasiados intentos. Espera un minuto.' : errorMessage(error))
    setEmail(clean)
    setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError('Código incorrecto o vencido. Pide uno nuevo.')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-sm">
        <h1 className="mb-4"><Logo size="lg" /></h1>
        <p className="mb-6 text-muted">Consulta tu colección en segundos y no compres repetidos.</p>
        {!isConfigured && (
          <div className="card mb-4 border-danger/40 p-3 text-sm text-danger" role="alert">
            Falta configurar Supabase: crea <code>web/.env.local</code> con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver README).
          </div>
        )}
        {step === 'email' ? (
          <form onSubmit={sendCode} className="card space-y-4 p-5">
            <div>
              <label className="label" htmlFor="email">Correo electrónico</label>
              <input id="email" className="field" type="email" inputMode="email" autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required />
            </div>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <button className="btn btn-primary w-full" disabled={busy || !isConfigured}>{busy ? 'Enviando…' : 'Enviarme un código'}</button>
            <p className="text-xs text-muted">Sin contraseña. Te enviaremos un código (y un enlace) a tu correo.</p>
          </form>
        ) : (
          <form onSubmit={verify} className="card space-y-4 p-5">
            <p className="text-sm text-muted">Enviamos un código a <b className="text-ink">{email}</b>. Escríbelo aquí o abre el enlace del correo en este mismo navegador.</p>
            <div>
              <label className="label" htmlFor="code">Código</label>
              <input id="code" className="field text-center text-2xl tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code"
                autoFocus maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
            </div>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <button className="btn btn-primary w-full" disabled={busy || code.length < 6}>{busy ? 'Verificando…' : 'Entrar'}</button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-blue" onClick={() => { setStep('email'); setCode('') }}>Cambiar correo</button>
              <button type="button" className="text-blue" disabled={busy} onClick={() => sendCode()}>Reenviar código</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
