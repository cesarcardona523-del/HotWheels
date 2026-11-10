import { Link } from 'react-router-dom'
import type { Car, NamedItem } from '../lib/types'
import { frontImage } from '../lib/data'
import { CarImage } from './CarImage'
import { Badge } from './ui'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function carSubtitle(car: Car, _brands: NamedItem[], _lines: NamedItem[]) {
  const serie = car.mini_collection ? `${car.mini_collection}${car.mini_number ? ` ${car.mini_number}${car.mini_total ? `/${car.mini_total}` : ''}` : ''}` : null
  return [car.year, serie].filter(Boolean).join(' · ')
}

export function CarCard({ car, brands, lines, urls }: {
  car: Car; brands: NamedItem[]; lines: NamedItem[]; urls: Record<string, string> | undefined
}) {
  return (
    <Link to={`/carro/${car.id}`} className="card group flex flex-col overflow-hidden hover:border-blue/60">
      <CarImage image={frontImage(car)} urls={urls} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 font-bold leading-tight">{car.casting_name}</h3>
        <p className="truncate text-xs text-muted">{carSubtitle(car, brands, lines) || '—'}</p>
        {car.color && <p className="truncate text-xs text-muted">{car.color}{car.variant ? ` · ${car.variant}` : ''}</p>}
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {car.is_sth && <Badge tone="gold">STH</Badge>}
          {car.is_th && <Badge tone="orange">TH</Badge>}
          {car.series_number && <Badge tone="blue">#{car.series_number}{car.series_total ? `/${car.series_total}` : ''}</Badge>}
          {car.user_group && <Badge>{car.user_group}</Badge>}
        </div>
      </div>
    </Link>
  )
}
