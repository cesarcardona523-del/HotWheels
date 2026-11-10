import * as XLSX from 'xlsx'
import type { Car, NamedItem } from './types'
import { CONDITION_LABEL } from './types'

const HEADERS = [
  'Nombre', 'Año', 'Carro real', 'Marca', 'Línea', 'Serie', 'Número en la serie', 'Total de la serie', 'Color', 'Grupo',
  '#', '# total', 'Marca del juguete', 'Línea de colección',
  'Toy number', 'Código de barras', 'Variante', 'Estado', 'Treasure Hunt', 'Super Treasure Hunt',
  'Precio pagado', 'Tienda', 'Ciudad', 'Fecha de compra', 'Notas', 'Variante confirmada',
  'Foto principal', 'Foto reverso', 'Registrado por', 'Creado', 'Actualizado', 'ID',
] as const

export function carsToRows(cars: Car[], brands: NamedItem[], lines: NamedItem[], people: Record<string, string>) {
  const b = new Map(brands.map((x) => [x.id, x.name]))
  const l = new Map(lines.map((x) => [x.id, x.name]))
  const photo = (c: Car, side: 'front' | 'back') => {
    const i = c.car_images.find((x) => x.side === side)
    return i ? `${i.is_reference ? 'Referencia' : 'Propia'}${i.source_url ? ` (${i.source_url})` : ''}` : ''
  }
  return cars.map((c) => [
    c.casting_name, c.year ?? '', c.is_real == null ? '' : c.is_real ? 'Sí' : 'No', c.real_maker ?? '', c.real_model ?? '',
    c.mini_collection ?? '', c.mini_number ?? '', c.mini_total ?? '', c.color ?? '', c.user_group ?? '',
    c.series_number ?? '', c.series_total ?? '', b.get(c.brand_id ?? '') ?? '', l.get(c.line_id ?? '') ?? '',
    c.toy_number ?? '', c.barcode ?? '', c.variant ?? '', c.condition ? CONDITION_LABEL[c.condition] : '', c.is_th ? 'Sí' : 'No', c.is_sth ? 'Sí' : 'No',
    c.price_paid ?? '', c.store ?? '', c.city ?? '', c.purchased_at ?? '', c.notes ?? '', c.variant_confirmed ? 'Sí' : 'No',
    photo(c, 'front'), photo(c, 'back'), people[c.created_by ?? ''] ?? '',
    new Date(c.created_at).toLocaleString('es-CO'), new Date(c.updated_at).toLocaleString('es-CO'), c.id,
  ])
}

function fileName(collection: string, ext: string) {
  const slug = collection.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'coleccion'
  return `${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`
}

export function exportXlsx(collection: string, rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([[...HEADERS], ...rows])
  ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(10, Math.min(40, h.length + 4)) }))
  ws['!autofilter'] = { ref: ws['!ref']! }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Colección')
  XLSX.writeFile(wb, fileName(collection, 'xlsx'))
}

export function exportCsv(collection: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    let s = String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // evitar inyección de fórmulas al abrir en Excel
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [[...HEADERS], ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName(collection, 'csv')
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
