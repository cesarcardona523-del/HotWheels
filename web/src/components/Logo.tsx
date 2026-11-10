/**
 * Logo propio de la app, inspirado en el estilo Hot Wheels (llama, naranja y azul).
 * No es el logo oficial: el logotipo de Hot Wheels es marca registrada de Mattel.
 * Si tienes permiso para usar otro logo, guárdalo en web/public/logo.svg y pon USE_CUSTOM_LOGO = true.
 */
import { useId } from 'react'

const USE_CUSTOM_LOGO = false

export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  // id único: si el mismo id existe dentro de un contenedor oculto, el degradado no se pinta.
  const gid = `lm-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Mi Colección">
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff2d00" />
          <stop offset=".55" stopColor="#ff6b00" />
          <stop offset="1" stopColor="#ffb000" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0f1115" />
      {/* llama */}
      <path d="M6 44C14 40 18 30 30 24c-3 5-2 8 1 9 4-8 13-14 27-15-8 5-12 10-13 15 4-2 8-2 12-1-9 3-14 9-17 14H6z" fill={`url(#${gid})`} />
      {/* carro */}
      <path d="M10 46c3-6 9-9 17-9h9l7 5h6c3 0 5 2 5 4v3H10z" fill="#f3f5f8" />
      <circle cx="21" cy="50" r="5" fill="#1e88ff" stroke="#0f1115" strokeWidth="2" />
      <circle cx="45" cy="50" r="5" fill="#1e88ff" stroke="#0f1115" strokeWidth="2" />
    </svg>
  )
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  if (USE_CUSTOM_LOGO) {
    const h = { sm: 'h-8', md: 'h-12', lg: 'h-20' }[size]
    return <img src="/logo.svg" alt="Mi Colección Hot Wheels" className={`${h} w-auto`} />
  }
  const mark = { sm: 'h-8 w-8', md: 'h-11 w-11', lg: 'h-16 w-16' }[size]
  const title = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl' }[size]
  const sub = { sm: 'text-[9px]', md: 'text-[10px]', lg: 'text-xs' }[size]
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className={`${mark} shrink-0`} />
      <div className="leading-none">
        <div className={`${title} -skew-x-12 font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#ffb000] via-orange to-[#ff2d00]`}>
          Mi Colección
        </div>
        <div className={`${sub} mt-1 -skew-x-12 font-extrabold uppercase tracking-[.25em] text-blue`}>Hot Wheels</div>
      </div>
    </div>
  )
}
