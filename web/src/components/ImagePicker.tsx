import { useRef, useState } from 'react'
import { importImageFromUrl, validateImageFile, type PendingImage } from '../lib/images'
import type { CarImage as Img, ImageSide } from '../lib/types'
import { CarImage } from './CarImage'

/** Dos formas activas en Etapa 1: subir archivo y pegar URL. "Buscar imagen" (Google) llega en Etapa 2. */
export function ImagePicker({ side, collectionId, carId, existing, existingUrls, pending, onChange }: {
  side: ImageSide
  collectionId: string
  carId: string
  existing: Img | undefined
  existingUrls: Record<string, string> | undefined
  pending: PendingImage | null
  onChange: (p: PendingImage | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'none' | 'url'>('none')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const title = side === 'front' ? 'Foto' : 'Foto del reverso'

  function onFile(f: File | undefined) {
    setErr(null)
    if (!f) return
    const v = validateImageFile(f)
    if (v) return setErr(v)
    onChange({ side, source: 'upload', isReference: false, file: f, previewUrl: URL.createObjectURL(f) })
  }

  async function onImport() {
    setErr(null)
    let u: URL
    try { u = new URL(url.trim()) } catch { return setErr('URL no válida.') }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return setErr('La URL debe empezar por https://')
    setBusy(true)
    try {
      const path = await importImageFromUrl(collectionId, carId, side, u.toString())
      onChange({ side, source: 'url', isReference: true, importedPath: path, sourceUrl: u.toString(), previewUrl: u.toString() })
      setMode('none'); setUrl('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo importar la imagen.')
    } finally { setBusy(false) }
  }

  return (
    <div className="card space-y-3 p-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{title}</span>
        {pending && <button type="button" className="text-sm text-muted" onClick={() => onChange(null)}>Quitar cambio</button>}
      </div>
      <div className="aspect-[4/3] overflow-hidden rounded-xl">
        {pending ? <img src={pending.previewUrl} alt="" className="h-full w-full bg-surface2 object-contain" referrerPolicy="no-referrer" />
          : <CarImage image={existing} urls={existingUrls} full className="h-full w-full" />}
      </div>
      {pending && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-orange" checked={!pending.isReference}
            onChange={(e) => onChange({ ...pending, isReference: !e.target.checked })} />
          Es una foto propia de mi ejemplar (no de referencia)
        </label>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="btn btn-secondary min-h-14 !flex-col !gap-0 !px-1 text-xs" onClick={() => fileRef.current?.click()}><span className="text-lg" aria-hidden>📷</span>Cámara / galería</button>
        <button type="button" className="btn btn-secondary min-h-14 !flex-col !gap-0 !px-1 text-xs" onClick={() => setMode(mode === 'url' ? 'none' : 'url')}><span className="text-lg" aria-hidden>🔗</span>Pegar URL</button>
        <button type="button" className="btn btn-secondary min-h-14 !flex-col !gap-0 !px-1 text-xs" disabled title="Disponible en la Etapa 2"><span className="text-lg" aria-hidden>🔎</span>Buscar (pronto)</button>
      </div>
      {mode === 'url' && (
        <div className="flex gap-2">
          <input className="field" inputMode="url" placeholder="https://…/imagen.jpg" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" className="btn btn-primary shrink-0" disabled={busy || !url} onClick={onImport}>{busy ? '…' : 'Importar'}</button>
        </div>
      )}
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
    </div>
  )
}
