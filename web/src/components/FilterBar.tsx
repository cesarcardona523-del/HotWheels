import { useEffect, useMemo, useState } from 'react'
import type { Car, Condition, NamedItem } from '../lib/types'
import { CONDITION_LABEL } from '../lib/types'
import { type Filters, NO_FILTERS, hasFilters } from '../lib/search'

/** Botón "Filtros" + hoja inferior en el celular; los filtros activos se ven como chips que se quitan con un toque. */
export function FilterBar({ filters, onChange, cars, brands, lines }: {
  filters: Filters; onChange: (f: Filters) => void; cars: Car[]; brands: NamedItem[]; lines: NamedItem[]
}) {
  const [open, setOpen] = useState(false)
  const years = useMemo(() => [...new Set(cars.map((c) => c.year).filter((y): y is number => !!y))].sort((a, b) => b - a), [cars])
  const groups = useMemo(() => [...new Set(cars.map((c) => c.mini_collection?.trim()).filter((g): g is string => !!g))].sort((a, b) => a.localeCompare(b, 'es')), [cars])
  const ugroups = useMemo(() => [...new Set(cars.map((c) => c.user_group?.trim()).filter((g): g is string => !!g))].sort((a, b) => a.localeCompare(b, 'es')), [cars])
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v })
  const active = Object.values(filters).filter((v) => v !== null).length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])

  const chips: { label: string; clear: () => void }[] = [
    filters.brandId && { label: brands.find((b) => b.id === filters.brandId)?.name ?? 'Marca', clear: () => set('brandId', null) },
    filters.lineId && { label: lines.find((l) => l.id === filters.lineId)?.name ?? 'Línea', clear: () => set('lineId', null) },
    filters.year && { label: String(filters.year), clear: () => set('year', null) },
    filters.group && { label: filters.group, clear: () => set('group', null) },
    filters.ugroup && { label: filters.ugroup, clear: () => set('ugroup', null) },
    filters.condition && { label: CONDITION_LABEL[filters.condition], clear: () => set('condition', null) },
  ].filter(Boolean) as { label: string; clear: () => void }[]

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(true)}
          className={`btn !min-h-10 !px-3 text-sm ${active ? 'btn-primary' : 'btn-secondary'}`}>
          ⚙︎ Filtros{active ? ` (${active})` : ''}
        </button>
        {chips.map((c) => (
          <button key={c.label} type="button" onClick={c.clear} aria-label={`Quitar filtro ${c.label}`}
            className="inline-flex min-h-10 max-w-[45vw] items-center gap-1 rounded-full border border-orange/50 bg-orange/10 px-3 text-sm text-orange">
            <span className="truncate">{c.label}</span><span aria-hidden>✕</span>
          </button>
        ))}
        {active > 1 && <button type="button" className="min-h-10 px-2 text-sm text-muted underline" onClick={() => onChange(NO_FILTERS)}>Limpiar</button>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 md:items-center md:justify-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="filters-title" onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:max-w-md md:rounded-3xl md:border">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line md:hidden" aria-hidden />
            <h2 id="filters-title" className="mb-4 text-xl font-bold">Filtros</h2>
            <div className="space-y-3">
              <Select label="Marca del juguete" value={filters.brandId ?? ''} onChange={(v) => set('brandId', v || null)}
                options={brands.map((b) => [b.id, b.name])} />
              <Select label="Línea de colección" value={filters.lineId ?? ''} onChange={(v) => set('lineId', v || null)}
                options={lines.map((l) => [l.id, l.name])} />
              <Select label="Año" value={filters.year?.toString() ?? ''} onChange={(v) => set('year', v ? Number(v) : null)}
                options={years.map((y) => [String(y), String(y)])} />
              <Select label="Serie" value={filters.group ?? ''} onChange={(v) => set('group', v || null)}
                options={groups.map((g) => [g, g])} />
              <Select label="Grupo (tuyo)" value={filters.ugroup ?? ''} onChange={(v) => set('ugroup', v || null)}
                options={ugroups.map((g) => [g, g])} />
              <div>
                <span className="label">Estado</span>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
                    <button key={c} type="button" onClick={() => set('condition', filters.condition === c ? null : c)}
                      className={`btn !px-1 text-sm ${filters.condition === c ? 'btn-primary' : 'btn-secondary'}`}>{CONDITION_LABEL[c]}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-secondary" disabled={!hasFilters(filters)} onClick={() => onChange(NO_FILTERS)}>Limpiar</button>
              <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>Ver resultados</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const id = `f-${label}`
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} disabled={options.length === 0}>
        <option value="">{options.length ? 'Todos' : 'Sin datos aún'}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}
