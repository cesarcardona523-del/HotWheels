export type Role = 'owner' | 'editor' | 'viewer'
export type Condition = 'carded' | 'loose' | 'damaged_card'
export type ImageSide = 'front' | 'back'
export type ImageSource = 'upload' | 'google' | 'url'

export const ROLE_LABEL: Record<Role, string> = { owner: 'Dueño', editor: 'Editor', viewer: 'Lector' }
export const CONDITION_LABEL: Record<Condition, string> = {
  carded: 'En blíster',
  loose: 'Suelto',
  damaged_card: 'Blíster dañado',
}

export interface Collection {
  id: string
  name: string
  owner_id: string
  currency: string
  created_at: string
}

export interface Membership {
  id: string
  collection_id: string
  email: string
  user_id: string | null
  role: Role
  created_at: string
}

export interface NamedItem {
  id: string
  collection_id: string
  name: string
  sort: number
}

export interface CarImage {
  id: string
  car_id: string
  collection_id: string
  side: ImageSide
  source: ImageSource
  is_reference: boolean
  storage_path: string
  thumb_path: string | null
  source_url: string | null
  source_domain: string | null
}

export interface Car {
  id: string
  collection_id: string
  casting_name: string
  brand_id: string | null
  real_maker: string | null
  is_real: boolean | null
  real_model: string | null
  mini_number: number | null
  mini_total: number | null
  user_group: string | null
  line_id: string | null
  year: number | null
  series_number: number | null
  series_total: number | null
  mini_collection: string | null
  toy_number: string | null
  barcode: string | null
  color: string | null
  variant: string | null
  condition: Condition | null
  is_th: boolean
  is_sth: boolean
  price_paid: number | null
  store: string | null
  city: string | null
  purchased_at: string | null
  notes: string | null
  variant_confirmed: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  car_images: CarImage[]
}

export type CarInput = Omit<Car, 'id' | 'collection_id' | 'created_by' | 'updated_by' | 'created_at' | 'updated_at' | 'car_images'>

export const EMPTY_CAR: CarInput = {
  casting_name: '', brand_id: null, real_maker: null, is_real: null, real_model: null, mini_number: null, mini_total: null, user_group: null, line_id: null, year: null,
  series_number: null, series_total: null, mini_collection: null, toy_number: null, barcode: null,
  color: null, variant: null, condition: null, is_th: false, is_sth: false, price_paid: null,
  store: null, city: null, purchased_at: null, notes: null, variant_confirmed: false,
}
