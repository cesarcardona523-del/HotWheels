import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { IMAGE_BUCKET, supabase } from './supabase'
import type { Car, CarInput, NamedItem } from './types'
import { buildIndex } from './search'
import { useCollection } from '../context/CollectionContext'

const PAGE = 1000

/** Carga toda la colección en memoria (por páginas) para buscar al instante en la tienda. */
export function useCars() {
  const { current } = useCollection()
  return useQuery({
    queryKey: ['cars', current?.id],
    enabled: !!current,
    staleTime: 30_000,
    queryFn: async () => {
      const all: Car[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('hw_cars')
          .select('*, car_images:hw_car_images(*)')
          .eq('collection_id', current!.id)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1)
        if (error) throw error
        all.push(...(data as Car[]))
        if (!data || data.length < PAGE) break
      }
      return all
    },
  })
}

function useNamed(table: 'brands' | 'lines') {
  const { current } = useCollection()
  return useQuery({
    queryKey: [table, current?.id],
    enabled: !!current,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from(`hw_${table}`).select('*').eq('collection_id', current!.id).order('sort').order('name')
      if (error) throw error
      return data as NamedItem[]
    },
  })
}
export const useBrands = () => useNamed('brands')
export const useLines = () => useNamed('lines')

export function useSearchIndex() {
  const cars = useCars()
  const brands = useBrands()
  const lines = useLines()
  const index = useMemo(
    () => buildIndex(cars.data ?? [], brands.data ?? [], lines.data ?? []),
    [cars.data, brands.data, lines.data],
  )
  return { index, cars, brands, lines }
}

export function useInvalidateCars() {
  const qc = useQueryClient()
  const { current } = useCollection()
  return () => qc.invalidateQueries({ queryKey: ['cars', current?.id] })
}

/** URLs firmadas (privadas, de corta vida) para un lote de rutas. */
export function useSignedUrls(paths: (string | null | undefined)[]) {
  const clean = [...new Set(paths.filter((p): p is string => !!p))].sort()
  return useQuery({
    queryKey: ['signed', clean],
    enabled: clean.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(clean, 3600)
      if (error) throw error
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])) as Record<string, string>
    },
  })
}

export async function fetchDuplicates(collectionId: string, input: Pick<CarInput, 'casting_name' | 'year' | 'color'>, excludeId?: string) {
  const { data, error } = await supabase.rpc('hw_find_duplicates', {
    cid: collectionId,
    p_casting: input.casting_name,
    p_year: input.year,
    p_color: input.color,
    p_exclude: excludeId ?? null,
  })
  if (error) throw error
  return (data ?? []) as Omit<Car, 'car_images'>[]
}

export function frontImage(car: Car) {
  return car.car_images?.find((i) => i.side === 'front') ?? car.car_images?.[0] ?? null
}
