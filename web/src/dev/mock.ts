// SOLO DESARROLLO: simula Supabase en el navegador para revisar el diseño sin backend.
// Se activa con VITE_MOCK=1 en `npm run dev` y nunca se incluye en el build de producción.
const URL_BASE = 'http://mock.localhost'
const CID = '00000000-0000-4000-8000-000000000001'
const UID = '00000000-0000-4000-8000-0000000000aa'
const now = new Date().toISOString()

const brands = ['Hot Wheels', 'Matchbox', 'Fantasía', 'Otra'].map((name, i) => ({ id: `b${i}`, collection_id: CID, name, sort: i }))
const lines = ['Mainline', 'Premium', 'Car Culture', 'Silver Series', 'RLC', 'Treasure Hunt', 'Super Treasure Hunt', 'Otra'].map((name, i) => ({ id: `l${i}`, collection_id: CID, name, sort: i }))
const names = ["DEMO '67 Camaro", 'DEMO Nissan Skyline GT-R (R34)', 'DEMO Porsche 911 GT3', 'DEMO Bone Shaker', 'DEMO Twin Mill', 'DEMO Volkswagen Kombi', 'DEMO Lamborghini Countach', "DEMO '70 Dodge Charger"]
const cars = names.map((casting_name, i) => ({
  id: `00000000-0000-4000-8000-00000000c00${i}`, collection_id: CID, casting_name, brand_id: 'b0',
  line_id: `l${i % 3}`, year: 2020 + (i % 5), series_number: i + 1, series_total: i % 2 ? 250 : null,
  mini_collection: i % 2 ? 'HW Flames' : 'Muscle Mania', toy_number: `DEMO${i}`, barcode: null, color: ['Rojo', 'Azul', 'Negro'][i % 3],
  variant: null, condition: 'carded', is_th: i === 2, is_sth: i === 5, price_paid: null, store: null, city: null, purchased_at: null,
  notes: null, variant_confirmed: false, is_real: i % 2 === 0, real_maker: i % 2 === 0 ? 'Chevrolet' : null, real_model: null,
  mini_number: (i % 5) + 1, mini_total: 5, user_group: i < 3 ? 'Favoritos' : null, created_by: UID, updated_by: UID, created_at: now, updated_at: now, car_images: [],
}))

function fakeJwt() {
  const b = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${b({ alg: 'HS256' })}.${b({ sub: UID, email: 'demo@demo.test', exp: 4102444800, role: 'authenticated' })}.x`
}

export function installMock() {
  const session = {
    access_token: fakeJwt(), refresh_token: 'demo', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
    user: { id: UID, email: 'demo@demo.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now },
  }
  if (!location.search.includes('logout')) localStorage.setItem('sb-mock-auth-token', JSON.stringify(session))
  else localStorage.removeItem('sb-mock-auth-token')

  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(URL_BASE)) return real(input, init)
    const u = new URL(url)
    const j = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    const p = u.pathname
    if (p.includes('/hw_collection_members')) {
      if (u.searchParams.get('select')?.includes('collections'))
        return j([{ role: 'owner', collections: { id: CID, name: 'Colección DEMO', owner_id: UID, currency: 'COP', created_at: now } }])
      return j([{ id: 'm1', collection_id: CID, email: 'demo@demo.test', user_id: UID, role: 'owner', created_at: now },
        { id: 'm2', collection_id: CID, email: 'familiar.con.correo.largo@demo.test', user_id: null, role: 'viewer', created_at: now }])
    }
    if (p.endsWith('/hw_brands')) return j(brands)
    if (p.endsWith('/hw_lines')) return j(lines)
    if (p.endsWith('/hw_cars')) return j(u.searchParams.get('offset') && u.searchParams.get('offset') !== '0' ? [] : cars)
    if (p.includes('/rpc/hw_find_duplicates')) return j([cars[0]])
    if (p.includes('/storage/')) return j([])
    return j([])
  }
}
