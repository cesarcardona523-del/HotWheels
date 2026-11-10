import { useQuery } from '@tanstack/react-query'
import { useBrands, useCars, useLines } from '../lib/data'
import { useCollection } from '../context/CollectionContext'
import { supabase } from '../lib/supabase'
import { Empty, ErrorBox, PageHeader, Spinner } from '../components/ui'

export function Export() {
  const { current } = useCollection()
  const cars = useCars(), brands = useBrands(), lines = useLines()
  const members = useQuery({
    queryKey: ['members', current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.from('hw_collection_members').select('*').eq('collection_id', current!.id)
      if (error) throw error
      return data
    },
  })
  if (!current || cars.isLoading) return <Spinner />
  if (cars.error) return <ErrorBox error={cars.error} onRetry={() => cars.refetch()} />
  const list = cars.data ?? []
  const run = async (kind: 'xlsx' | 'csv') => {
    const { carsToRows, exportCsv, exportXlsx } = await import('../lib/export') // xlsx es pesado: carga diferida
    const rows = carsToRows(list, brands.data ?? [], lines.data ?? [],
      Object.fromEntries((members.data ?? []).filter((m) => m.user_id).map((m) => [m.user_id, m.email])))
    if (kind === 'xlsx') exportXlsx(current.name, rows); else exportCsv(current.name, rows)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Exportar" />
      {list.length === 0 ? <Empty title="Nada que exportar">La colección aún no tiene carros.</Empty> : (
        <div className="card space-y-4 p-5">
          <p>Se exportarán los <b>{list.length}</b> carros de <b>{current.name}</b>, con todos sus campos.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn btn-primary" onClick={() => run('xlsx')}>📊 Descargar Excel (.xlsx)</button>
            <button className="btn btn-secondary" onClick={() => run('csv')}>📄 Descargar CSV</button>
          </div>
          <p className="text-xs text-muted">Solo se exporta lo que tu rol te permite ver. El respaldo completo con imágenes (ZIP) llega en la Etapa 2.</p>
        </div>
      )}
    </div>
  )
}
