import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { CollectionProvider, useCollection } from './context/CollectionContext'
import { Layout } from './components/Layout'
import { ErrorBox, Spinner } from './components/ui'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Catalog } from './pages/Catalog'
import { CarDetail } from './pages/CarDetail'
import { CarForm } from './pages/CarForm'
import { Collections } from './pages/Collections'
import { Lists } from './pages/Lists'
import { Export } from './pages/Export'
import { FirstCollection } from './pages/FirstCollection'

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Login />
  return (
    <CollectionProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </CollectionProvider>
  )
}

function Gate() {
  const { collections, loading, error, refetch } = useCollection()
  if (loading) return <Spinner label="Cargando colecciones…" />
  if (error) return <div className="p-4"><ErrorBox error={error} onRetry={refetch} /></div>
  if (collections.length === 0) return <FirstCollection />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="catalogo" element={<Catalog />} />
        <Route path="nuevo" element={<CarForm key="new" />} />
        <Route path="carro/:id" element={<CarDetail />} />
        <Route path="carro/:id/editar" element={<CarForm />} />
        <Route path="colecciones" element={<Collections />} />
        <Route path="listas" element={<Lists />} />
        <Route path="exportar" element={<Export />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
