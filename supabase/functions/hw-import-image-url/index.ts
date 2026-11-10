// Descarga una imagen desde una URL pública y la guarda en el bucket privado
// `hw-car-images`. La subida se hace con el JWT del usuario, así las políticas de
// almacenamiento (rol editor o dueño) se aplican igual que desde la app.
import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Bloquea direcciones internas (SSRF): loopback, privadas, link-local, CGNAT, multicast, etc.
function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase()
    if (v === '::' || v === '::1') return true
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v)
  }
  const [a, b] = ip.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Solo se aceptan URLs http(s).')
  if (url.username || url.password) throw new Error('URL no permitida.')
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Puerto no permitido.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Host no permitido.')
  const literal = /^[\d.]+$/.test(host) || host.includes(':')
  const ips = literal ? [host] : [
    ...(await Deno.resolveDns(host, 'A').catch(() => [] as string[])),
    ...(await Deno.resolveDns(host, 'AAAA').catch(() => [] as string[])),
  ]
  if (ips.length === 0) throw new Error('No se pudo resolver el dominio.')
  if (ips.some(isPrivateIp)) throw new Error('Host no permitido.')
}

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

async function download(start: URL): Promise<{ bytes: Uint8Array; type: string }> {
  let url = start
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertPublicHost(url)
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'MiColeccionHW/1.0 (+image import)', Accept: 'image/jpeg,image/png,image/webp' },
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) throw new Error('Redirección inválida.')
      url = new URL(loc, url)
      continue
    }
    if (!res.ok || !res.body) throw new Error(`El servidor de la imagen respondió ${res.status}.`)
    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared > MAX_BYTES) throw new Error('La imagen supera 5 MB.')
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > MAX_BYTES) { await reader.cancel(); throw new Error('La imagen supera 5 MB.') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let off = 0
    for (const c of chunks) { bytes.set(c, off); off += c.length }
    const type = sniff(bytes)
    if (!type) throw new Error('El enlace no apunta a una imagen JPG, PNG o WEBP.')
    return { bytes, type }
  }
  throw new Error('Demasiadas redirecciones.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'No autenticado' }, 401)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Sesión inválida' }, 401)

  let body: { collectionId?: string; carId?: string; side?: string; url?: string }
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  const { collectionId, carId, side, url } = body
  if (!collectionId || !UUID.test(collectionId) || !carId || !UUID.test(carId) || (side !== 'front' && side !== 'back') || !url)
    return json({ error: 'Parámetros inválidos' }, 400)

  const { data: allowed, error: roleErr } = await supabase.rpc('hw_has_role', { cid: collectionId, min_role: 'editor' })
  if (roleErr || !allowed) return json({ error: 'No tienes permiso para editar esta colección' }, 403)

  let parsed: URL
  try { parsed = new URL(url) } catch { return json({ error: 'URL no válida' }, 400) }

  try {
    const { bytes, type } = await download(parsed)
    const path = `${collectionId}/${carId}/${side}-${crypto.randomUUID()}.${TYPES[type]}`
    const { error } = await supabase.storage.from('hw-car-images').upload(path, bytes, { contentType: type })
    if (error) return json({ error: `No se pudo guardar: ${error.message}` }, 500)
    return json({ path })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo descargar la imagen' }, 422)
  }
})
