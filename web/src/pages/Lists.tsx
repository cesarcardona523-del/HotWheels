import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBrands, useLines } from '../lib/data'
import { useCollection } from '../context/CollectionContext'
import { errorMessage, supabase } from '../lib/supabase'
import type { NamedItem } from '../lib/types'
import { PageHeader, Spinner } from '../components/ui'

export function Lists() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Listas" />
      <ListEditor table="brands" title="Marcas" />
      <ListEditor table="lines" title="Líneas" />
    </div>
  )
}

function ListEditor({ table, title }: { table: 'brands' | 'lines'; title: string }) {
  const brands = useBrands(), lines = useLines()
  const q = table === 'brands' ? brands : lines
  const { current, canEdit } = useCollection()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const reload = () => qc.invalidateQueries({ queryKey: [table, current?.id] })
  const items = q.data ?? []

  async function add() {
    if (!current || !name.trim()) return
    setErr(null)
    const sort = Math.max(0, ...items.map((i) => i.sort)) + 1
    const { error } = await supabase.from(`hw_${table}`).insert({ collection_id: current.id, name: name.trim(), sort })
    if (error) return setErr(error.code === '23505' ? 'Ya existe.' : errorMessage(error))
    setName(''); reload()
  }
  async function rename(i: NamedItem) {
    const n = prompt('Nuevo nombre', i.name)?.trim()
    if (!n || n === i.name) return
    const { error } = await supabase.from(`hw_${table}`).update({ name: n }).eq('id', i.id)
    if (error) setErr(errorMessage(error)); reload()
  }
  async function remove(i: NamedItem) {
    if (!confirm(`¿Eliminar “${i.name}”? Los carros que la usen quedarán sin ${title.toLowerCase().slice(0, -1)}.`)) return
    const { error } = await supabase.from(`hw_${table}`).delete().eq('id', i.id)
    if (error) setErr(errorMessage(error)); reload()
    qc.invalidateQueries({ queryKey: ['cars', current?.id] })
  }

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      {q.isLoading ? <Spinner /> : (
        <ul className="card divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1">{i.name}</span>
              {canEdit && <><button className="min-h-11 px-2 text-sm text-blue" onClick={() => rename(i)}>Renombrar</button>
                <button className="min-h-11 px-2 text-sm text-danger" onClick={() => remove(i)}>Eliminar</button></>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex gap-2">
          <input className="field" placeholder={`Agregar a ${title.toLowerCase()}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <button className="btn btn-secondary shrink-0" onClick={add} disabled={!name.trim()}>Agregar</button>
        </div>
      )}
      {err && <p className="min-h-11 px-2 text-sm text-danger">{err}</p>}
    </section>
  )
}
