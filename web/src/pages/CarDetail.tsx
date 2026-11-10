import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBrands, useCars, useInvalidateCars, useLines, useSignedUrls } from '../lib/data'
import { useCollection } from '../context/CollectionContext'
import { removeCarStorage } from '../lib/images'
import { errorMessage, supabase } from '../lib/supabase'
import { CONDITION_LABEL } from '../lib/types'
import { CarImage } from '../components/CarImage'
import { Badge, Empty, ErrorBox, Spinner } from '../components/ui'

export function CarDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const cars = useCars(), brands = useBrands(), lines = useLines()
  const { canEdit, current } = useCollection()
  const invalidate = useInvalidateCars()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const car = cars.data?.find((c) => c.id === id)
  const images = car?.car_images ?? []
  const urls = useSignedUrls(images.map((i) => i.storage_path))
  const people = useMembersEmails(current?.id)

  if (cars.isLoading) return <Spinner />
  if (cars.error) return <ErrorBox error={cars.error} onRetry={() => cars.refetch()} />
  if (!car) return <Empty title="Carro no encontrado" action={<Link className="btn btn-secondary" to="/catalogo">Ir al catálogo</Link>}>Puede que se haya borrado o que no tengas acceso.</Empty>

  async function remove() {
    if (!car || !confirm(`¿Borrar “${car.casting_name}” de la colección? No se puede deshacer.`)) return
    setBusy(true); setErr(null)
    const { error } = await supabase.from('hw_cars').delete().eq('id', car.id)
    if (error) { setBusy(false); return setErr(errorMessage(error)) }
    await removeCarStorage(images.flatMap((i) => [i.storage_path, i.thumb_path]))
    await invalidate()
    nav('/catalogo', { replace: true })
  }

  const brand = brands.data?.find((b) => b.id === car.brand_id)?.name
  const line = lines.data?.find((l) => l.id === car.line_id)?.name
  const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: current?.currency ?? 'COP', maximumFractionDigits: 0 }).format(n)
  const rows: [string, string | number | null | undefined][] = [
    ['Año', car.year], ['Tipo', car.is_real == null ? null : car.is_real ? 'Carro real' : 'Fantasía'],
    ['Marca', car.real_maker], ['Línea', car.real_model],
    ['Serie', car.mini_collection ? `${car.mini_collection}${car.mini_number ? ` · ${car.mini_number}${car.mini_total ? ` de ${car.mini_total}` : ''}` : ''}` : null],
    ['Color', car.color], ['Grupo', car.user_group],
    ['#', car.series_number ? `${car.series_number}${car.series_total ? ` de ${car.series_total}` : ''}` : null],
    ['Marca del juguete', brand], ['Línea de colección', line], ['Toy number', car.toy_number], ['Código de barras', car.barcode],
    ['Variante', car.variant], ['Estado', car.condition && CONDITION_LABEL[car.condition]],
    ['Precio pagado', car.price_paid != null ? money(car.price_paid) : null], ['Tienda', car.store], ['Ciudad', car.city],
    ['Fecha de compra', car.purchased_at], ['Notas', car.notes],
  ]

  return (
    <div className="space-y-4">
      <button className="text-blue" onClick={() => nav(-1)}>← Volver</button>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          {images.length === 0 ? <CarImage image={null} urls={undefined} className="aspect-[4/3] rounded-2xl" /> :
            [...images].sort((a) => (a.side === 'front' ? -1 : 1)).map((img) => (
              <figure key={img.id} className="card overflow-hidden">
                <CarImage image={img} urls={urls.data} full className="aspect-[4/3] w-full" />
                <figcaption className="flex flex-wrap justify-between gap-2 px-3 py-2 text-xs text-muted">
                  <span>{img.side === 'front' ? 'Frente' : 'Reverso'} · {img.is_reference ? 'Imagen de referencia' : 'Foto propia'}</span>
                  {img.source_url && <a className="truncate text-blue" href={img.source_url} target="_blank" rel="noreferrer noopener">Fuente: {img.source_domain}</a>}
                </figcaption>
              </figure>
            ))}
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold leading-tight">{car.casting_name}</h1>
          <div className="flex flex-wrap gap-1">
            {car.is_sth && <Badge tone="gold">Super Treasure Hunt</Badge>}
            {car.is_th && <Badge tone="orange">Treasure Hunt</Badge>}
            {car.variant_confirmed && <Badge tone="blue">Variante confirmada</Badge>}
          </div>
          <dl className="card divide-y divide-line">
            {rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <div key={k} className="flex gap-3 px-4 py-2.5 text-sm">
                <dt className="w-28 shrink-0 text-muted sm:w-36">{k}</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">
            Registrado por {people[car.created_by ?? ''] ?? '—'} el {new Date(car.created_at).toLocaleDateString('es-CO')}
            {car.updated_at !== car.created_at && ` · actualizado ${new Date(car.updated_at).toLocaleString('es-CO')}`}
            {car.updated_by && car.updated_by !== car.created_by && ` por ${people[car.updated_by] ?? '—'}`}
          </p>
          {err && <p className="text-sm text-danger" role="alert">{err}</p>}
          {canEdit && (
            <div className="flex gap-2">
              <Link to={`/carro/${car.id}/editar`} className="btn btn-primary flex-1">✏️ Editar</Link>
              <button className="btn btn-danger" disabled={busy} onClick={remove}>Borrar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function useMembersEmails(cid: string | undefined): Record<string, string> {
  const q = useQuery({
    queryKey: ['members', cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data, error } = await supabase.from('hw_collection_members').select('*').eq('collection_id', cid!)
      if (error) throw error
      return data
    },
  })
  return Object.fromEntries((q.data ?? []).filter((m) => m.user_id).map((m) => [m.user_id, m.email]))
}
