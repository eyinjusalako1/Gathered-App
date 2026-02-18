export interface Church {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  distance_miles?: number | null
  city?: string | null
  postcode?: string | null
  denomination?: string | null
  website?: string | null
  source: 'osm'
}

export interface ChurchStats {
  id: string
  members_count: number
  connections_count: number
  is_my_church: boolean
}

