/** Debe coincidir con public.norm() en la base de datos. */
export function norm(t: string | null | undefined): string {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function dupKey(casting: string, year: number | null, color: string | null): string {
  return `${norm(casting)}|${year ?? ''}|${norm(color)}`
}

export function digitsOnly(t: string | null | undefined): string {
  return (t ?? '').replace(/\D+/g, '')
}
