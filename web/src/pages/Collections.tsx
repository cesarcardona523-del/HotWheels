import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCollection } from '../context/CollectionContext'
import { useAuth } from '../context/AuthContext'
import { errorMessage, supabase } from '../lib/supabase'
import { ROLE_LABEL, type Membership, type Role } from '../lib/types'
import { ErrorBox, PageHeader, Spinner } from '../components/ui'

export function Collections() {
  const { collections, current, setCurrentId, isOwner, refetch } = useCollection()
  const { session, email } = useAuth()
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !session) return
    setBusy(true); setMsg(null)
    const id = crypto.randomUUID()
    // Sin .select(): la fila solo es visible tras el trigger que crea la membresía de dueño.
    const { error } = await supabase.from('hw_collections').insert({ id, name: name.trim(), owner_id: session.user.id })
    setBusy(false)
    if (error) return setMsg(errorMessage(error))
    setName('')
    setCurrentId(id)
    refetch()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Colecciones" right={<button className="btn btn-secondary text-sm" onClick={() => supabase.auth.signOut()}>Salir</button>} />
      <p className="-mt-4 text-sm text-muted">Sesión: {email}</p>

      <section className="card divide-y divide-line">
        {collections.map((c) => (
          <button key={c.id} onClick={() => setCurrentId(c.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className={c.id === current?.id ? 'font-bold text-orange' : ''}>{c.id === current?.id ? '● ' : ''}{c.name}</span>
            <span className="text-xs text-muted">{ROLE_LABEL[c.role]}</span>
          </button>
        ))}
      </section>

      <form onSubmit={create} className="flex gap-2">
        <input className="field" placeholder="Nueva colección" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Nombre de la nueva colección" />
        <button className="btn btn-primary shrink-0" disabled={busy || !name.trim()}>Crear</button>
      </form>
      {msg && <p className="min-h-11 px-2 text-sm text-danger" role="alert">{msg}</p>}

      {current && (
        <>
          {isOwner && <Rename />}
          <Members collectionId={current.id} isOwner={isOwner} myEmail={email ?? ''} />
          {current.role !== 'viewer' && (
            <Link to="/listas" className="card flex items-center justify-between px-4 py-3">
              <span>Editar listas de marcas y líneas</span><span className="text-muted">→</span>
            </Link>
          )}
        </>
      )}
      <p className="pt-4 text-center text-xs text-muted">App personal de colección. No está afiliada a Mattel ni a Hot Wheels®, marcas registradas de Mattel, Inc.</p>
    </div>
  )
}

function Rename() {
  const { current, refetch } = useCollection()
  const [name, setName] = useState(current?.name ?? '')
  const [err, setErr] = useState<string | null>(null)
  if (!current) return null
  return (
    <form className="flex gap-2" onSubmit={async (e) => {
      e.preventDefault(); setErr(null)
      const { error } = await supabase.from('hw_collections').update({ name: name.trim() }).eq('id', current.id)
      if (error) setErr(errorMessage(error)); else refetch()
    }}>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la colección" maxLength={80} />
      <button className="btn btn-secondary shrink-0" disabled={!name.trim() || name.trim() === current.name}>Renombrar</button>
      {err && <p className="min-h-11 px-2 text-sm text-danger">{err}</p>}
    </form>
  )
}

function Members({ collectionId, isOwner, myEmail }: { collectionId: string; isOwner: boolean; myEmail: string }) {
  const qc = useQueryClient()
  const { refetch: refetchCollections } = useCollection()
  const q = useQuery({
    queryKey: ['members', collectionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('hw_collection_members').select('*').eq('collection_id', collectionId).order('created_at')
      if (error) throw error
      return data as Membership[]
    },
  })
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const reload = () => qc.invalidateQueries({ queryKey: ['members', collectionId] })

  async function invite(e: FormEvent) {
    e.preventDefault(); setErr(null); setInfo(null)
    const clean = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return setErr('Correo no válido.')
    const { error } = await supabase.from('hw_collection_members').insert({ collection_id: collectionId, email: clean, role })
    if (error) return setErr(error.code === '23505' ? 'Ese correo ya tiene acceso.' : errorMessage(error))
    setEmail('')
    setInfo(`Acceso dado a ${clean}. Avísale que entre a la app con ese correo; no se envía un correo automático.`)
    reload()
  }
  async function changeRole(m: Membership, r: Role) {
    setErr(null)
    const { error } = await supabase.from('hw_collection_members').update({ role: r }).eq('id', m.id)
    if (error) setErr(errorMessage(error)); reload()
  }
  async function revoke(m: Membership) {
    const self = m.email === myEmail
    if (!confirm(self ? '¿Salir de esta colección?' : `¿Quitar el acceso de ${m.email}?`)) return
    setErr(null)
    const { error } = await supabase.from('hw_collection_members').delete().eq('id', m.id)
    if (error) return setErr(errorMessage(error))
    if (self) refetchCollections(); else reload()
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Personas con acceso</h2>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (
        <ul className="card divide-y divide-line">
          {q.data!.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3">
              <span className="w-full min-w-0 break-all sm:w-auto sm:flex-1">{m.email}{m.email === myEmail && <span className="text-muted"> (tú)</span>}
                {!m.user_id && <span className="ml-2 text-xs text-muted">pendiente</span>}</span>
              {isOwner && m.email !== myEmail ? (
                <>
                  <select className="field !w-auto flex-1 !py-2 sm:flex-none" value={m.role} aria-label={`Rol de ${m.email}`} onChange={(e) => changeRole(m, e.target.value as Role)}>
                    {(['owner', 'editor', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button className="min-h-11 px-2 text-sm text-danger" onClick={() => revoke(m)}>Quitar</button>
                </>
              ) : (
                <>
                  <span className="text-sm text-muted">{ROLE_LABEL[m.role]}</span>
                  {m.email === myEmail && m.role !== 'owner' && <button className="min-h-11 px-2 text-sm text-danger" onClick={() => revoke(m)}>Salir</button>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner && (
        <form onSubmit={invite} className="card space-y-3 p-4">
          <h3 className="font-semibold">Invitar por correo</h3>
          <input className="field" type="email" inputMode="email" placeholder="familiar@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Correo a invitar" />
          <div className="flex gap-2">
            <select className="field" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rol">
              <option value="viewer">Lector (solo consulta)</option>
              <option value="editor">Editor (agrega y edita)</option>
              <option value="owner">Dueño (todo)</option>
            </select>
            <button className="btn btn-primary shrink-0">Invitar</button>
          </div>
        </form>
      )}
      {err && <p className="min-h-11 px-2 text-sm text-danger" role="alert">{err}</p>}
      {info && <p className="text-sm text-ok">{info}</p>}
    </section>
  )
}
