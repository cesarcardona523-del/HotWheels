import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { frontImage, useSearchIndex, useSignedUrls } from '../lib/data'
import { type Filters, NO_FILTERS, applyFilters, hasFilters, search } from '../lib/search'
import { useCollection } from '../context/CollectionContext'
import { CarCard } from '../components/CarCard'
import { FilterBar } from '../components/FilterBar'
import { Empty, ErrorBox, PageHeader, Spinner } from '../components/ui'

const STEP = 24

export function Catalog() {
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [sort, setSort] = useState<'recent' | 'name' | 'year'>('recent')
  const [shown, setShown] = useState(STEP)
  const { index, cars, brands, lines } = useSearchIndex()
  const { canEdit } = useCollection()

  const list = useMemo(() => {
    const base = q.trim() ? search(index, q).map((h) => h.car) : [...(cars.data ?? [])]
    const filtered = applyFilters(base, filters)
    if (!q.trim()) {
      if (sort === 'name') filtered.sort((a, b) => a.casting_name.localeCompare(b.casting_name, 'es'))
      if (sort === 'year') filtered.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    }
    return filtered
  }, [q, filters, sort, index, cars.data])

  useEffect(() => setShown(STEP), [q, filters, sort])
  const visible = list.slice(0, shown)
  const urls = useSignedUrls(visible.map((c) => frontImage(c)?.thumb_path ?? frontImage(c)?.storage_path))

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setShown((s) => s + STEP), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [list.length])

  const total = cars.data?.length ?? 0
  return (
    <div className="space-y-3">
      <PageHeader title="Catálogo" right={<span className="text-sm text-muted">{list.length} de {total}</span>} />
      <div className="flex gap-2">
        <input type="search" aria-label="Filtrar por texto" className="field" placeholder="Filtrar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Ordenar" className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} disabled={!!q.trim()}>
          <option value="recent">Recientes</option><option value="name">Nombre</option><option value="year">Año</option>
        </select>
      </div>
      <FilterBar filters={filters} onChange={setFilters} cars={cars.data ?? []} brands={brands.data ?? []} lines={lines.data ?? []} />
      {cars.isLoading ? <Spinner /> : cars.error ? <ErrorBox error={cars.error} onRetry={() => cars.refetch()} /> :
        total === 0 ? (
          <Empty title="Aún no hay carros" action={canEdit && <Link to="/nuevo" className="btn btn-primary">➕ Agregar carro</Link>}>
            {canEdit ? 'Registra tu primer carro con su foto.' : 'Cuando el dueño o un editor agregue carros, aparecerán aquí.'}
          </Empty>
        ) : list.length === 0 ? (
          <Empty title="Sin resultados" action={(hasFilters(filters) || q) && <button className="btn btn-secondary" onClick={() => { setFilters(NO_FILTERS); setQ('') }}>Limpiar búsqueda y filtros</button>}>
            Ningún carro cumple con la búsqueda y los filtros actuales.
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((c) => <CarCard key={c.id} car={c} brands={brands.data ?? []} lines={lines.data ?? []} urls={urls.data} />)}
            </div>
            {shown < list.length && <div ref={sentinel}><Spinner label="Cargando más…" /></div>}
          </>
        )}
    </div>
  )
}
