import Fuse from 'fuse.js'
import type { Car, Condition, NamedItem } from './types'
import { digitsOnly, norm } from './normalize'

export interface Filters {
  brandId: string | null
  lineId: string | null
  year: number | null
  group: string | null
  ugroup: string | null
  condition: Condition | null
}
export const NO_FILTERS: Filters = { brandId: null, lineId: null, year: null, group: null, ugroup: null, condition: null }
export const hasFilters = (f: Filters) => Object.values(f).some((v) => v !== null)

interface Indexed {
  car: Car
  name: string
  brand: string
  line: string
  group: string
  ugroup: string
  maker: string
  color: string
  codes: string
  year: string
}

export type MatchKind = 'code' | 'name' | 'text'
export interface SearchHit { car: Car; kind: MatchKind; score: number }

export function buildIndex(cars: Car[], brands: NamedItem[], lines: NamedItem[]) {
  const bName = new Map(brands.map((b) => [b.id, b.name]))
  const lName = new Map(lines.map((l) => [l.id, l.name]))
  const docs: Indexed[] = cars.map((car) => ({
    car,
    name: car.casting_name,
    brand: (car.brand_id && bName.get(car.brand_id)) || '',
    line: (car.line_id && lName.get(car.line_id)) || '',
    group: car.mini_collection ?? '',
    ugroup: car.user_group ?? '',
    maker: [car.real_maker, car.real_model].filter(Boolean).join(' '),
    color: [car.color, car.variant].filter(Boolean).join(' '),
    codes: [car.toy_number, car.barcode].filter(Boolean).join(' '),
    year: car.year?.toString() ?? '',
  }))
  const fuse = new Fuse(docs, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'codes', weight: 2 },
      { name: 'maker', weight: 2 },
      { name: 'group', weight: 1 },
      { name: 'ugroup', weight: 0.7 },
      { name: 'color', weight: 1 },
      { name: 'line', weight: 0.7 },
      { name: 'brand', weight: 0.5 },
      { name: 'year', weight: 0.5 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
    useExtendedSearch: false,
  })
  return { fuse, docs }
}

export type SearchIndex = ReturnType<typeof buildIndex>

export function applyFilters(cars: Car[], f: Filters): Car[] {
  return cars.filter(
    (c) =>
      (!f.brandId || c.brand_id === f.brandId) &&
      (!f.lineId || c.line_id === f.lineId) &&
      (!f.year || c.year === f.year) &&
      (!f.group || norm(c.mini_collection) === norm(f.group)) &&
      (!f.ugroup || norm(c.user_group) === norm(f.ugroup)) &&
      (!f.condition || c.condition === f.condition),
  )
}

/** Coincidencia exacta por código (toy number / código de barras) primero, luego difusa por texto. */
export function search(index: SearchIndex, query: string): SearchHit[] {
  const q = query.trim()
  if (!q) return []
  const qCode = norm(q)
  const qDigits = digitsOnly(q)
  const codeHits = index.docs
    .filter(({ car }) =>
      (qCode.length >= 4 && norm(car.toy_number) === qCode) ||
      (qDigits.length >= 6 && digitsOnly(car.barcode) === qDigits),
    )
    .map(({ car }) => ({ car, kind: 'code' as const, score: 0 }))
  const seen = new Set(codeHits.map((h) => h.car.id))
  // Cada palabra debe aparecer en algún campo; tolera errores de escritura en cada una.
  const textHits = index.fuse
    .search(q)
    .filter((r) => !seen.has(r.item.car.id))
    .map((r) => {
      // Si todas las palabras escritas aparecen en el nombre del casting, es una coincidencia clara por nombre.
      const name = norm(r.item.car.casting_name)
      const words = q.split(/\s+/).map(norm).filter(Boolean)
      const inName = words.length > 0 && words.every((w) => name.includes(w))
      return { car: r.item.car, kind: inName ? ('name' as const) : ('text' as const), score: r.score ?? 1 }
    })
    .sort((a, b) => (a.kind === 'name' ? 0 : 1) - (b.kind === 'name' ? 0 : 1) || a.score - b.score)
  return [...codeHits, ...textHits]
}
