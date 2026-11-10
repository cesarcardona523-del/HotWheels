import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { fetchDuplicates, useBrands, useCars, useInvalidateCars, useLines, useSignedUrls } from '../lib/data'
import { useCollection } from '../context/CollectionContext'
import { saveCarImage, type PendingImage } from '../lib/images'
import { errorMessage, supabase } from '../lib/supabase'
import { dupKey } from '../lib/normalize'
import { CONDITION_LABEL, EMPTY_CAR, type Car, type CarInput, type Condition } from '../lib/types'
import { ImagePicker } from '../components/ImagePicker'
import { Empty, PageHeader, Spinner } from '../components/ui'

type Dup = Omit<Car, 'car_images'>

const trimOrNull = (s: string | null) => (s && s.trim() ? s.trim() : null)

export function CarForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { current, canEdit } = useCollection()
  const cars = useCars(), brands = useBrands(), lines = useLines()
  const invalidate = useInvalidateCars()
  const existing = id ? cars.data?.find((c) => c.id === id) : undefined
  const carId = useMemo(() => id ?? crypto.randomUUID(), [id])

  const [form, setForm] = useState<CarInput>(() => ({ ...EMPTY_CAR, casting_name: params.get('nombre') ?? '' }))
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [front, setFront] = useState<PendingImage | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [dups, setDups] = useState<Dup[] | null>(null)

  useEffect(() => {
    if (existing && loadedId !== existing.id) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _i, collection_id: _c, created_by: _cb, updated_by: _ub, created_at: _ca, updated_at: _ua, car_images: _im, ...rest } = existing
      setForm(rest)
      setLoadedId(existing.id)
    }
  }, [existing, loadedId])

  const imgUrls = useSignedUrls((existing?.car_images ?? []).map((i) => i.storage_path))
  const suggest = useMemo(() => {
    const all = cars.data ?? []
    const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es'))
    return {
      makers: uniq(all.map((c) => c.real_maker)),
      models: uniq(all.filter((c) => !form.real_maker || c.real_maker?.trim().toLowerCase() === form.real_maker.trim().toLowerCase()).map((c) => c.real_model)),
      fantasy: uniq(all.filter((c) => c.is_real === false).map((c) => c.casting_name)),
      series: uniq(all.map((c) => c.mini_collection)),
      colors: uniq(all.map((c) => c.color)),
      groups: uniq(all.map((c) => c.user_group)),
    }
  }, [cars.data, form.real_maker])

  if (!current || cars.isLoading) return <Spinner />
  if (!canEdit) return <Empty title="Solo lectura">Tu rol en esta colección es lector: puedes consultar pero no agregar ni editar.</Empty>
  if (id && !existing) return <Empty title="Carro no encontrado" action={<Link to="/catalogo" className="btn btn-secondary">Catálogo</Link>} />

  const set = <K extends keyof CarInput>(k: K, v: CarInput[K]) => {
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Carro real: el nombre se arma con Marca + Línea.
      if (next.is_real) next.casting_name = [next.real_maker?.trim(), next.real_model?.trim()].filter(Boolean).join(' ')
      else if (k === 'is_real' && f.is_real) next.casting_name = ''
      // Si cambia la clave de duplicado, la confirmación anterior ya no aplica.
      if ((k === 'casting_name' || k === 'year' || k === 'color') && dupKey(f.casting_name, f.year, f.color) !== dupKey(next.casting_name, next.year, next.color))
        next.variant_confirmed = false
      return next
    })
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const num = (v: string) => (v === '' ? null : Number(v))

  function validate(f: CarInput) {
    const e: Record<string, string> = {}
    if (f.is_real === null) e.is_real = 'Indica si es un carro real o de fantasía.'
    else if (f.is_real) {
      if (!f.real_maker?.trim()) e.real_maker = 'Escribe la marca.'
      if (!f.real_model?.trim()) e.real_model = 'Escribe la línea.'
    } else if (!f.casting_name.trim()) e.casting_name = 'Escribe el nombre.'
    if (f.mini_number && f.mini_total && f.mini_number > f.mini_total) e.mini_number = 'No puede ser mayor que el total.'
    if (f.year != null && (f.year < 1950 || f.year > 2100 || !Number.isInteger(f.year))) e.year = 'Año entre 1950 y 2100.'
    if (f.series_number != null && f.series_number < 1) e.series_number = 'Debe ser 1 o más.'
    if (f.series_total != null && f.series_total < 1) e.series_total = 'Debe ser 1 o más.'
    if (f.series_number && f.series_total && f.series_number > f.series_total) e.series_number = 'No puede ser mayor que el total.'
    if (f.price_paid != null && f.price_paid < 0) e.price_paid = 'No puede ser negativo.'
    return e
  }

  async function save(confirmVariant = false) {
    if (!current) return
    const clean: CarInput = {
      ...form,
      casting_name: form.casting_name.trim(),
      real_maker: form.is_real ? trimOrNull(form.real_maker) : null, real_model: form.is_real ? trimOrNull(form.real_model) : null,
      mini_collection: trimOrNull(form.mini_collection), user_group: trimOrNull(form.user_group),
      toy_number: trimOrNull(form.toy_number), barcode: trimOrNull(form.barcode), color: trimOrNull(form.color),
      variant: trimOrNull(form.variant), store: trimOrNull(form.store), city: trimOrNull(form.city), notes: trimOrNull(form.notes),
      variant_confirmed: form.variant_confirmed || confirmVariant,
    }
    const e = validate(clean)
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    setSaving(true); setSaveErr(null)
    try {
      if (!clean.variant_confirmed) {
        const found = await fetchDuplicates(current.id, clean, id)
        if (found.length) { setDups(found); setSaving(false); return }
      }
      const res = id
        ? await supabase.from('hw_cars').update(clean).eq('id', id)
        : await supabase.from('hw_cars').insert({ ...clean, id: carId, collection_id: current.id })
      if (res.error) {
        if (res.error.message.includes('DUPLICATE_CAR')) {
          setDups(await fetchDuplicates(current.id, clean, id)); setSaving(false); return
        }
        throw res.error
      }
      setDups(null)
      const imgErrors: string[] = []
      for (const p of [front]) {
        if (!p) continue
        try { await saveCarImage(current.id, carId, p) } catch (err) { imgErrors.push(errorMessage(err)) }
      }
      await invalidate()
      if (imgErrors.length) {
        setSaveErr(`El carro se guardó, pero falló una imagen: ${imgErrors[0]}`)
        if (!id) nav(`/carro/${carId}/editar`, { replace: true })
        setSaving(false)
        return
      }
      nav(`/carro/${carId}`, { replace: true })
    } catch (err) {
      setSaveErr(errorMessage(err))
      setSaving(false)
    }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); save() }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-4" noValidate>
      <PageHeader title={id ? 'Editar carro' : 'Agregar carro'} />

      {/* 1. Año */}
      <div className="card space-y-4 p-4">
        <Field label="Año" error={errors.year}>
          <input className="field text-lg" type="number" inputMode="numeric" autoFocus={!id} value={form.year ?? ''}
            onChange={(e) => set('year', num(e.target.value))} placeholder={String(new Date().getFullYear())} />
        </Field>

        {/* 2. ¿Carro real? */}
        <div>
          <span className="label">¿Es un carro real?</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="¿Es un carro real?">
            {([[true, 'Sí, real'], [false, 'No, fantasía']] as const).map(([v, l]) => (
              <button key={l} type="button" role="radio" aria-checked={form.is_real === v} onClick={() => set('is_real', v)}
                className={`btn min-h-12 ${form.is_real === v ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>
            ))}
          </div>
          {errors.is_real && <p className="mt-1 text-sm text-danger" role="alert">{errors.is_real}</p>}
        </div>

        {/* 3. Real: Marca + Línea · Fantasía: Nombre */}
        {form.is_real === true && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca *" error={errors.real_maker}>
              <input className="field" list="makers" autoCapitalize="words" value={form.real_maker ?? ''} onChange={(e) => set('real_maker', e.target.value)} placeholder="Chevrolet" />
            </Field>
            <Field label="Línea *" error={errors.real_model}>
              <input className="field" list="models" autoCapitalize="words" value={form.real_model ?? ''} onChange={(e) => set('real_model', e.target.value)} placeholder="Camaro" />
            </Field>
          </div>
        )}
        {form.is_real === false && (
          <Field label="Nombre *" error={errors.casting_name}>
            <input className="field" list="fantasy" autoCapitalize="words" value={form.casting_name} onChange={(e) => set('casting_name', e.target.value)} placeholder="Bone Shaker" maxLength={120} />
          </Field>
        )}

        {form.is_real !== null && (
          <>
            {/* 4. Serie: cuál y número */}
            <Field label="Serie">
              <input className="field" list="series" value={form.mini_collection ?? ''} onChange={(e) => set('mini_collection', e.target.value)} placeholder="HW Flames" />
            </Field>
            <NumberOf label="Número en la serie" n={form.mini_number} total={form.mini_total} error={errors.mini_number}
              onN={(v) => set('mini_number', v)} onTotal={(v) => set('mini_total', v)} placeholder={['3', '10']} />

            {/* 5. Color */}
            <Field label="Color">
              <input className="field" list="colors" autoCapitalize="sentences" value={form.color ?? ''} onChange={(e) => set('color', e.target.value)} placeholder="Rojo" />
            </Field>

            {/* 6. Grupo personal */}
            <Field label="Grupo (tu agrupación)">
              <input className="field" list="ugroups" value={form.user_group ?? ''} onChange={(e) => set('user_group', e.target.value)} placeholder="Ej. Muscle cars, Para regalar…" />
            </Field>

            {/* 7. # del año */}
            <NumberOf label="# (número del carro en el año)" n={form.series_number} total={form.series_total} error={errors.series_number}
              onN={(v) => set('series_number', v)} onTotal={(v) => set('series_total', v)} placeholder={['5', '250']} />
          </>
        )}
        <datalist id="makers">{suggest.makers.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="models">{suggest.models.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="fantasy">{suggest.fantasy.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="series">{suggest.series.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="colors">{suggest.colors.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="ugroups">{suggest.groups.map((v) => <option key={v} value={v} />)}</datalist>
      </div>

      <div className="sm:max-w-sm">
        <ImagePicker side="front" collectionId={current.id} carId={carId} existing={existing?.car_images.find((i) => i.side === 'front')}
          existingUrls={imgUrls.data} pending={front} onChange={setFront} />
      </div>

      <Section title="Más detalles (opcional)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marca del juguete">
            <select className="field" value={form.brand_id ?? ''} onChange={(e) => set('brand_id', e.target.value || null)}>
              <option value="">—</option>{brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Línea de colección">
            <select className="field" value={form.line_id ?? ''} onChange={(e) => set('line_id', e.target.value || null)}>
              <option value="">—</option>{lines.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Variante (ruedas, detalles)">
          <input className="field" value={form.variant ?? ''} onChange={(e) => set('variant', e.target.value)} />
        </Field>
        <Field label="Estado">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
              <button type="button" key={c} onClick={() => set('condition', form.condition === c ? null : c)}
                className={`btn !px-1 text-sm ${form.condition === c ? 'btn-primary' : 'btn-secondary'}`}>{CONDITION_LABEL[c]}</button>
            ))}
          </div>
        </Field>
        <div className="flex gap-6">
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-orange" checked={form.is_th} onChange={(e) => set('is_th', e.target.checked)} />Treasure Hunt</label>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-orange" checked={form.is_sth} onChange={(e) => set('is_sth', e.target.checked)} />Super TH</label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Toy number"><input className="field" value={form.toy_number ?? ''} onChange={(e) => set('toy_number', e.target.value)} placeholder="HKG12" /></Field>
          <Field label="Código de barras"><input className="field" inputMode="numeric" value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} /></Field>
          <Field label={`Precio (${current.currency})`} error={errors.price_paid}>
            <input className="field" type="number" inputMode="decimal" min={0} value={form.price_paid ?? ''} onChange={(e) => set('price_paid', num(e.target.value))} />
          </Field>
          <Field label="Fecha de compra"><input className="field" type="date" value={form.purchased_at ?? ''} onChange={(e) => set('purchased_at', e.target.value || null)} /></Field>
          <Field label="Tienda"><input className="field" value={form.store ?? ''} onChange={(e) => set('store', e.target.value)} /></Field>
          <Field label="Ciudad"><input className="field" value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Field>
        </div>
        <Field label="Notas"><textarea className="field min-h-24" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </Section>

      {saveErr && <p className="card border-danger/40 p-3 text-sm text-danger" role="alert">{saveErr}</p>}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:sticky md:-mx-4 md:rounded-t-2xl">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>Cancelar</button>
          <button className="btn btn-primary flex-1" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>

      {dups && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="dup-title">
          <div className="card max-h-[85dvh] w-full max-w-md overflow-y-auto border-orange p-5">
            <h2 id="dup-title" className="text-xl font-black text-orange">⚠️ Posible duplicado</h2>
            <p className="mt-1 text-sm text-muted">Ya tienes {dups.length === 1 ? 'un carro' : `${dups.length} carros`} con el mismo casting, año y color:</p>
            <ul className="my-3 space-y-2">
              {dups.map((d) => (
                <li key={d.id} className="rounded-xl bg-surface2 p-3 text-sm">
                  <Link to={`/carro/${d.id}`} target="_blank" className="font-bold text-blue">{d.casting_name}</Link>
                  <div className="text-muted">{[d.year, d.color, d.variant, d.toy_number, d.condition && CONDITION_LABEL[d.condition]].filter(Boolean).join(' · ')}</div>
                </li>
              ))}
            </ul>
            <p className="text-sm">Si es una variante distinta (otras ruedas, otro tampo, otra edición), puedes guardarlo igualmente.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(true)}>Es una variante distinta, guardar</button>
              <button type="button" className="btn btn-secondary" onClick={() => setDups(null)}>No guardar, revisar</button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="card group">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-bold">
        {title}<span className="text-muted transition group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </details>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-sm text-danger" role="alert">{error}</p>}
    </div>
  )
}

function NumberOf({ label, n, total, onN, onTotal, error, placeholder }: {
  label: string; n: number | null; total: number | null; error?: string
  onN: (v: number | null) => void; onTotal: (v: number | null) => void; placeholder: [string, string]
}) {
  const toNum = (v: string) => (v === '' ? null : Math.max(1, Math.trunc(Number(v))))
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input aria-label={`${label}: número`} className="field text-center" type="number" inputMode="numeric" min={1}
          value={n ?? ''} onChange={(e) => onN(toNum(e.target.value))} placeholder={placeholder[0]} />
        <span className="shrink-0 text-muted">de</span>
        <input aria-label={`${label}: total`} className="field text-center" type="number" inputMode="numeric" min={1}
          value={total ?? ''} onChange={(e) => onTotal(toNum(e.target.value))} placeholder={placeholder[1]} />
      </div>
      {error && <p className="mt-1 text-sm text-danger" role="alert">{error}</p>}
    </div>
  )
}
