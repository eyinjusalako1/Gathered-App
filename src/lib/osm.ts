const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

const DEFAULT_HEADERS = {
  'User-Agent': 'GatheredApp/1.0 (https://gathered-app.vercel.app)',
  'Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://gathered-app.vercel.app',
  'Accept-Language': 'en',
}

export async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

export async function geocodeCity(city: string) {
  const params = new URLSearchParams({
    q: city,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  })

  const response = await fetchWithTimeout(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: DEFAULT_HEADERS,
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as Array<{ lat: string; lon: string }>
  if (!data[0]) return null
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  }
}

export async function fetchChurchesFromOverpass(
  lat: number,
  lng: number,
  radiusMeters: number,
  queryTimeoutSeconds = 25,
  fetchTimeoutMs = 12000
) {
  const query = `
    [out:json][timeout:${queryTimeoutSeconds}];
    (
      node["amenity"="place_of_worship"]["religion"="christian"](around:${radiusMeters},${lat},${lng});
      node["building"="church"](around:${radiusMeters},${lat},${lng});
      way["amenity"="place_of_worship"]["religion"="christian"](around:${radiusMeters},${lat},${lng});
      way["building"="church"](around:${radiusMeters},${lat},${lng});
      relation["amenity"="place_of_worship"]["religion"="christian"](around:${radiusMeters},${lat},${lng});
      relation["building"="church"](around:${radiusMeters},${lat},${lng});
    );
    out tags center;
  `

  const response = await fetchWithTimeout(OVERPASS_URL, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'Content-Type': 'text/plain',
    },
    body: query,
  }, fetchTimeoutMs)

  if (!response.ok) {
    throw new Error('Failed to fetch churches from Overpass')
  }

  return response.json()
}

type NominatimResult = {
  lat: string
  lon: string
  class?: string
  type?: string
  osm_id?: number
  osm_type?: string
  display_name?: string
  address?: Record<string, string>
  namedetails?: Record<string, string>
  extratags?: Record<string, string>
}

const buildAddressFromNominatim = (address: Record<string, string> | undefined) => {
  if (!address) return null
  const parts = [
    address.house_number,
    address.road,
    address.suburb,
    address.neighbourhood,
    address.city || address.town || address.village || address.hamlet,
    address.postcode,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

const shouldIncludeNominatimResult = (result: NominatimResult, query: string) => {
  const resultClass = (result.class || '').toLowerCase()
  const resultType = (result.type || '').toLowerCase()
  const extratags = result.extratags || {}
  const religion = (extratags.religion || '').toLowerCase()
  const denom = (extratags.denomination || '').toLowerCase()
  const isPlaceOfWorship = resultClass === 'amenity' && resultType === 'place_of_worship'
  const isChurchBuilding = resultClass === 'building' && resultType === 'church'
  const isChristian = religion === 'christian' || denom.length > 0

  if (isPlaceOfWorship || isChurchBuilding || isChristian) return true

  const queryLower = query.toLowerCase()
  return queryLower.includes('church') || queryLower.includes('chapel')
}

export async function searchChurchesByText(
  query: string,
  coords?: { lat: number; lng: number },
  radiusMeters?: number
) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '15',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
  })

  if (coords && radiusMeters) {
    const latDelta = radiusMeters / 111320
    const lngDelta = radiusMeters / (111320 * Math.cos((coords.lat * Math.PI) / 180))
    const left = coords.lng - lngDelta
    const right = coords.lng + lngDelta
    const top = coords.lat + latDelta
    const bottom = coords.lat - latDelta
    params.set('viewbox', `${left},${top},${right},${bottom}`)
    params.set('bounded', '1')
  }

  const response = await fetchWithTimeout(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: DEFAULT_HEADERS,
  }, 10000)

  if (!response.ok) {
    return []
  }

  const data = (await response.json()) as NominatimResult[]
  return data
    .filter((result) => shouldIncludeNominatimResult(result, query))
    .map((result) => {
      const latValue = result.lat ? parseFloat(result.lat) : null
      const lngValue = result.lon ? parseFloat(result.lon) : null
      const address = buildAddressFromNominatim(result.address)
      const name =
        result.namedetails?.name ||
        result.extratags?.name ||
        result.display_name?.split(',')[0] ||
        query
      const city =
        result.address?.city ||
        result.address?.town ||
        result.address?.village ||
        result.address?.hamlet ||
        null
      const postcode = result.address?.postcode || null
      const denomination = result.extratags?.denomination || null
      const website = result.extratags?.website || result.extratags?.contact_website || null

      return {
        id: `${result.osm_type}:${result.osm_id}`,
        name,
        address,
        lat: latValue,
        lng: lngValue,
        city,
        postcode,
        denomination,
        website,
        source: 'osm' as const,
      }
    })
}

