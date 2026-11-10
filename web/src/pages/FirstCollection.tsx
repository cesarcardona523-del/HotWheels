import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCollection } from '../context/CollectionContext'
import { errorMessage, supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'

export function FirstCollection() {
  const { session, email } = useAuth()
  const { setCurrentId, refetch } = useCollection()
  const [name, setName] = useState('Mi colección')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function create(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setBusy(true); setErr(null)
    const id = crypto.randomUUID()
    const { error } = await supabase.from('hw_collections').insert({ id, name: name.trim(), owner_id: session.user.id })
    setBusy(false)
    if (error) return setErr(errorMessage(error))
    setCurrentId(id); refetch()
  }
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={create} className="card w-full max-w-sm space-y-4 p-5">
        <Logo />
        <h1 className="text-2xl font-black">¡Bienvenido!</h1>
        <p className="text-sm text-muted">Entraste como <b className="text-ink">{email}</b>. Aún no tienes colecciones. Crea la tuya; si alguien te invitó, pídele que verifique que usó este mismo correo.</p>
        <div>
          <label className="label" htmlFor="cname">Nombre de la colección</label>
          <input id="cname" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy || !name.trim()}>{busy ? 'Creando…' : 'Crear colección'}</button>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-blue" onClick={() => refetch()}>Volver a revisar</button>
          <button type="button" className="text-muted" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </form>
    </div>
  )
}
