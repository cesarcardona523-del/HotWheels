import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { frontImage, useSearchIndex, useSignedUrls } from '../lib/data'
import { search } from '../lib/search'
import { useCollection } from '../context/CollectionContext'
import { CarImage } from '../components/CarImage'
import { CarCard, carSubtitle } from '../components/CarCard'
import { Badge, Empty, ErrorBox, Spinner } from '../components/ui'
import { CONDITION_LABEL } from '../lib/types'

export function Home() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const dq = useDeferredValue(q)
  const inputRef = useRef<HTMLInputElement>(null)
  const { index, cars, brands, lines } = useSearchIndex()
  const { canEdit } = useCollection()
  const hits = useMemo(() => search(index, dq), [index, dq])
  const top = hits[0]
  const strong = top && (top.kind === 'code' || top.kind === 'name' || top.score < 0.2)
  const urls = useSignedUrls(hits.slice(0, 13).map((h) => frontImage(h.car)?.thumb_path ?? frontImage(h.car)?.storage_path))

  useEffect(() => {
    const t = setTimeout(() => setParams(q ? { q } : {}, { replace: true }), 300)
    return () => clearTimeout(t)
  }, [q, setParams])

  const B = brands.data ?? [], L = lines.data ?? []
  const total = cars.data?.length ?? 0

  return (
    <div className="space-y-4">
      <div className="sticky top-[calc(3.5rem+1px+env(safe-area-inset-top))] z-10 -mx-4 -mt-4 bg-bg/95 px-4 pb-3 pt-3 backdrop-blur">
        <label htmlFor="q" className="sr-only">Buscar en tu colección</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl" aria-hidden>🔍</span>
          <input id="q" ref={inputRef} autoFocus type="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
            className="field !rounded-2xl !py-4 pl-12 pr-12 text-lg" placeholder="Nombre, código, color, año…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button aria-label="Borrar búsqueda" className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full text-muted hover:text-ink"
              onClick={() => { setQ(''); inputRef.current?.focus() }}>✕</button>
          )}
        </div>
      </div>

      {cars.isLoading ? <Spinner label="Cargando tu colección…" /> :
        cars.error ? <ErrorBox error={cars.error} onRetry={() => cars.refetch()} /> :
        !dq.trim() ? (
          total === 0 ? (
            <Empty title="Tu colección está vacía" action={canEdit && <Link to="/nuevo" className="btn btn-primary">➕ Agregar mi primer carro</Link>}>
              Agrega tus carros y luego búscalos aquí desde la tienda para saber si ya los tienes.
            </Empty>
          ) : (
            <p className="text-center text-muted">Escribe para buscar entre tus <b className="text-ink">{total}</b> carros.</p>
          )
        ) : !top ? (
          <section className="rounded-3xl border-2 border-blue/60 bg-blue/10 p-6 text-center" aria-live="polite">
            <p className="text-3xl font-black text-blue">NO ESTÁ EN TU COLECCIÓN</p>
            <p className="mt-2 text-muted">Nada coincide con “{dq}”. Revisa la ortografía o prueba con otra palabra.</p>
            {canEdit && <Link to={`/nuevo?nombre=${encodeURIComponent(dq)}`} className="btn btn-primary mt-4">➕ Agregarlo</Link>}
          </section>
        ) : (
          <>
            <section aria-live="polite" className={`overflow-hidden rounded-3xl border-2 ${strong ? 'border-ok bg-ok/10' : 'border-orange bg-orange/10'}`}>
              <p className={`px-5 pt-4 text-3xl font-black ${strong ? 'text-ok' : 'text-orange'}`}>
                {strong ? '✔ YA LO TIENES' : '¿YA LO TIENES?'}
              </p>
              <p className="px-5 text-sm text-muted">
                {top.kind === 'code' ? 'Coincide el código.' : strong ? 'Coincidencia por nombre.' : 'Coincidencia parecida: revisa los datos.'}
                {hits.length > 1 && ` ${hits.length} resultados.`}
              </p>
              <Link to={`/carro/${top.car.id}`} className="mt-3 flex gap-4 bg-black/20 p-4">
                <CarImage image={frontImage(top.car)} urls={urls.data} className="h-28 w-36 shrink-0 overflow-hidden rounded-xl" />
                <div className="min-w-0 space-y-1">
                  <h2 className="text-xl font-bold leading-tight">{top.car.casting_name}</h2>
                  <p className="text-sm text-muted">{carSubtitle(top.car, B, L)}</p>
                  {top.car.color && <p className="text-sm">{top.car.color}{top.car.variant && ` · ${top.car.variant}`}</p>}
                  <div className="flex flex-wrap gap-1">
                    {top.car.mini_collection && <Badge>{top.car.mini_collection}</Badge>}
                    {top.car.condition && <Badge>{CONDITION_LABEL[top.car.condition]}</Badge>}
                    {top.car.is_sth && <Badge tone="gold">STH</Badge>}
                    {top.car.is_th && <Badge tone="orange">TH</Badge>}
                  </div>
                </div>
              </Link>
            </section>
            {hits.length > 1 && (
              <>
                <h3 className="font-bold text-muted">Otros resultados</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {hits.slice(1, 13).map((h) => <CarCard key={h.car.id} car={h.car} brands={B} lines={L} urls={urls.data} />)}
                </div>
                {hits.length > 13 && <Link className="block text-center text-blue" to={`/catalogo?q=${encodeURIComponent(dq)}`}>Ver los {hits.length} resultados en el catálogo →</Link>}
              </>
            )}
          </>
        )}
    </div>
  )
}
