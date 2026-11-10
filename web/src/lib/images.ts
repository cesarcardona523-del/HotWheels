import imageCompression from 'browser-image-compression'
import { IMAGE_BUCKET, supabase } from './supabase'
import type { ImageSide, ImageSource } from './types'

export const MAX_INPUT_MB = 15
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))
    return 'Formato no válido. Usa JPG, PNG, WEBP o HEIC.'
  if (file.size > MAX_INPUT_MB * 1024 * 1024) return `La imagen supera ${MAX_INPUT_MB} MB.`
  return null
}

export async function compressImage(file: File) {
  const [main, thumb] = await Promise.all([
    imageCompression(file, { maxWidthOrHeight: 1600, maxSizeMB: 0.8, fileType: 'image/webp', useWebWorker: true, initialQuality: 0.82 }),
    imageCompression(file, { maxWidthOrHeight: 480, maxSizeMB: 0.08, fileType: 'image/webp', useWebWorker: true, initialQuality: 0.75 }),
  ])
  return { main, thumb }
}

export interface PendingImage {
  side: ImageSide
  source: ImageSource
  isReference: boolean
  file?: File // subida desde cámara o galería
  importedPath?: string // ya guardada por la Edge Function import-image-url
  sourceUrl?: string
  previewUrl: string
}

/** Sube (o registra) la imagen y reemplaza la anterior de ese lado. */
export async function saveCarImage(collectionId: string, carId: string, img: PendingImage) {
  const base = `${collectionId}/${carId}/${img.side}-${crypto.randomUUID()}`
  let storagePath: string
  let thumbPath: string | null = null
  if (img.file) {
    const { main, thumb } = await compressImage(img.file)
    storagePath = `${base}.webp`
    thumbPath = `${base}-thumb.webp`
    const up1 = await supabase.storage.from(IMAGE_BUCKET).upload(storagePath, main, { contentType: 'image/webp' })
    if (up1.error) throw up1.error
    const up2 = await supabase.storage.from(IMAGE_BUCKET).upload(thumbPath, thumb, { contentType: 'image/webp' })
    if (up2.error) thumbPath = null
  } else if (img.importedPath) {
    storagePath = img.importedPath
  } else {
    return
  }

  const { data: old } = await supabase.from('hw_car_images').select('id, storage_path, thumb_path').eq('car_id', carId).eq('side', img.side)
  if (old?.length) {
    await supabase.from('hw_car_images').delete().in('id', old.map((o) => o.id))
    const paths = old.flatMap((o) => [o.storage_path, o.thumb_path]).filter((p): p is string => !!p && p !== storagePath)
    if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths)
  }

  let domain: string | null = null
  try { domain = img.sourceUrl ? new URL(img.sourceUrl).hostname : null } catch { /* sin dominio */ }
  const { error } = await supabase.from('hw_car_images').insert({
    car_id: carId,
    collection_id: collectionId,
    side: img.side,
    source: img.source,
    is_reference: img.isReference,
    storage_path: storagePath,
    thumb_path: thumbPath,
    source_url: img.sourceUrl ?? null,
    source_domain: domain,
  })
  if (error) throw error
}

/** Llama a la Edge Function que descarga una URL y la guarda en el bucket privado. */
export async function importImageFromUrl(collectionId: string, carId: string, side: ImageSide, url: string) {
  const { data, error } = await supabase.functions.invoke<{ path: string }>('hw-import-image-url', {
    body: { collectionId, carId, side, url },
  })
  if (error) {
    let detail = ''
    try { detail = (await (error as { context?: Response }).context?.json())?.error ?? '' } catch { /* ignorar */ }
    throw new Error(detail || 'No se pudo importar la imagen. Verifica la URL o que la función hw-import-image-url esté desplegada.')
  }
  if (!data?.path) throw new Error('Respuesta inválida del servidor')
  return data.path
}

export async function removeCarStorage(paths: (string | null)[]) {
  const p = paths.filter((x): x is string => !!x)
  if (p.length) await supabase.storage.from(IMAGE_BUCKET).remove(p)
}
