import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCollection } from '../context/CollectionContext'
import { ROLE_LABEL } from '../lib/types'
import { Logo, LogoMark } from './Logo'

const NAV = [
  { to: '/', label: 'Buscar', icon: '🔍', end: true },
  { to: '/catalogo', label: 'Catálogo', icon: '🗂️' },
  { to: '/nuevo', label: 'Agregar', icon: '➕', editor: true },
  { to: '/exportar', label: 'Exportar', icon: '📤' },
  { to: '/colecciones', label: 'Más', icon: '⚙️' },
]

export function Layout() {
  const { collections, current, setCurrentId, canEdit } = useCollection()
  const nav = useNavigate()
  const items = NAV.filter((n) => !n.editor || canEdit)
  // En el formulario la barra inferior se reemplaza por los botones Guardar/Cancelar.
  const inForm = /^\/(nuevo|carro\/[^/]+\/editar)$/.test(useLocation().pathname)
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex">
        <div className="mb-6"><Logo size="sm" /></div>
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold ${isActive ? 'bg-orange/15 text-orange' : 'text-muted hover:bg-surface2 hover:text-ink'}`}>
            <span aria-hidden>{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center gap-2.5 px-4">
          <LogoMark className="h-9 w-9 shrink-0 md:hidden" />
          {collections.length > 1 ? (
            <select aria-label="Colección actual" className="field min-w-0 flex-1 !py-2 font-semibold" value={current?.id ?? ''}
              onChange={(e) => { setCurrentId(e.target.value); nav('/') }}>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <span className="min-w-0 flex-1 truncate text-lg font-bold">{current?.name}</span>
          )}
          {current && <span className="shrink-0 rounded-md bg-surface2 px-2 py-1 text-xs text-muted">{ROLE_LABEL[current.role]}</span>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 md:pb-10">
          <Outlet />
        </main>
      </div>
      {!inForm && <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {items.map((n) => (
          n.editor ? (
            <NavLink key={n.to} to={n.to} aria-label="Agregar carro" className="flex flex-1 items-start justify-center">
              <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-orange text-3xl font-bold text-black shadow-lg shadow-orange/30 ring-4 ring-bg">+</span>
            </NavLink>
          ) : (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-orange' : 'text-muted'}`}>
            <span className="text-xl" aria-hidden>{n.icon}</span>{n.label}
          </NavLink>
          )
        ))}
      </nav>}
    </div>
  )
}
