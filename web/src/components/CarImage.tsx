import type { CarImage as Img } from '../lib/types'

/** Muestra la miniatura si existe; carga diferida. `urls` viene de useSignedUrls. */
export function CarImage({ image, urls, full = false, className = '' }: {
  image: Img | null | undefined
  urls: Record<string, string> | undefined
  full?: boolean
  className?: string
}) {
  const path = image ? (full ? image.storage_path : image.thumb_path ?? image.storage_path) : null
  const src = path ? urls?.[path] : undefined
  if (!image) {
    return (
      <div className={`flex items-center justify-center bg-surface2 text-3xl text-muted ${className}`} aria-label="Sin foto">🚗</div>
    )
  }
  return (
    <div className={`relative bg-surface2 ${className}`}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
      ) : (
        <div className="h-full w-full animate-pulse bg-surface2" />
      )}
      {image.is_reference && (
        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-blue">REFERENCIA</span>
      )}
    </div>
  )
}
