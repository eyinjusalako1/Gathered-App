import { NextRequest, NextResponse } from "next/server";
import { fetchChurchesFromOverpass, geocodeCity, searchChurchesByText } from "@/lib/osm";

export const dynamic = "force-dynamic";

type CacheEntry = {
  expiresAt: number;
  data: any;
};

const cache = new Map<string, CacheEntry>();

const getCacheKey = (params: Record<string, string | number | null | undefined>) => {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("&");
};

const buildAddress = (tags: Record<string, string>) => {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const city = searchParams.get("city");
    const radiusMiles = searchParams.get("radius_miles");
    const radiusMeters = searchParams.get("radius_m");
    const query = searchParams.get("q")?.trim() || "";

    const cacheKey = getCacheKey({ lat, lng, city, radiusMiles, radiusMeters, query });
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ churches: cached.data });
    }

    let coords: { lat: number; lng: number } | null = null;
    if (lat && lng) {
      coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
    } else if (city) {
      try {
        coords = await geocodeCity(city);
      } catch (error) {
        console.warn("Failed to geocode city:", error);
        coords = null;
      }
    }

    if (!coords) {
      if (query) {
        const textMatches = await searchChurchesByText(query);
        return NextResponse.json({ churches: textMatches });
      }
      return NextResponse.json({ churches: [] });
    }

    const parsedRadiusMiles = radiusMiles ? parseFloat(radiusMiles) : null;
    const fallbackMeters = radiusMeters ? parseInt(radiusMeters, 10) : 16093;
    const safeRadiusMeters = Number.isFinite(parsedRadiusMiles)
      ? Math.round((parsedRadiusMiles as number) * 1609.34)
      : Number.isFinite(fallbackMeters)
        ? fallbackMeters
        : 16093;

    let raw: any = null;
    let overpassFailed = false;
    try {
      const needsLargeRadius = safeRadiusMeters > 40234; // ~25 miles
      const queryTimeout = needsLargeRadius ? 40 : 25;
      const fetchTimeout = needsLargeRadius ? 20000 : 12000;
      raw = await fetchChurchesFromOverpass(
        coords.lat,
        coords.lng,
        safeRadiusMeters,
        queryTimeout,
        fetchTimeout
      );
    } catch (error) {
      console.warn("Overpass fetch failed:", error);
      overpassFailed = true;
    }

    const elements = raw?.elements || [];
    const churches = elements
      .map((element: any) => {
        const tags = element.tags || {};
        const name = tags.name || "Christian Church";
        const latValue = element.lat ?? element.center?.lat ?? null;
        const lngValue = element.lon ?? element.center?.lon ?? null;
        const address = buildAddress(tags);
        const churchCity = tags["addr:city"] || null;
        const postcode = tags["addr:postcode"] || null;
        const denomination = tags.denomination || null;
        const website = tags.website || tags["contact:website"] || null;
        const distance = latValue && lngValue
          ? haversineMiles(coords.lat, coords.lng, latValue, lngValue)
          : null;

        return {
          id: `${element.type}:${element.id}`,
          name,
          address,
          lat: latValue,
          lng: lngValue,
          distance_miles: distance,
          city: churchCity,
          postcode,
          denomination,
          website,
          source: "osm",
        };
      })
      .filter((church: any) => church.lat && church.lng);

    let filtered = query
      ? churches.filter((church: any) => {
          const haystack = [
            church.name,
            church.address,
            church.city,
            church.postcode,
            church.denomination,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(query.toLowerCase());
        })
      : churches;

    if (query && (overpassFailed || filtered.length === 0)) {
      const textMatches = await searchChurchesByText(
        query,
        coords,
        safeRadiusMeters
      );
      const byId = new Map<string, any>();
      filtered.forEach((church: any) => byId.set(church.id, church));
      textMatches.forEach((church) => {
        const withDistance = church.lat && church.lng
          ? {
              ...church,
              distance_miles: haversineMiles(
                coords.lat,
                coords.lng,
                church.lat,
                church.lng
              ),
            }
          : church;
        byId.set(church.id, withDistance);
      });
      filtered = Array.from(byId.values());
    } else if ((overpassFailed || elements.length === 0) && !query) {
      // Overpass failed or returned nothing — fall back to Nominatim text search
      try {
        const nominatimResults = await searchChurchesByText("church", coords, safeRadiusMeters);
        const withDistance = nominatimResults
          .map((church) =>
            church.lat && church.lng
              ? { ...church, distance_miles: haversineMiles(coords.lat, coords.lng, church.lat, church.lng) }
              : church
          )
          .filter((c) => c.lat && c.lng)
          .sort((a: any, b: any) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999))
          .slice(0, 25);

        cache.set(cacheKey, { data: withDistance, expiresAt: Date.now() + 1000 * 60 * 8 });
        return NextResponse.json({ churches: withDistance });
      } catch {
        return NextResponse.json({ churches: [] });
      }
    }

    const sorted = filtered
      .filter((church: any) => typeof church.distance_miles === "number")
      .sort((a: any, b: any) => a.distance_miles - b.distance_miles)
      .concat(
        filtered.filter((church: any) => typeof church.distance_miles !== "number")
      )
      .slice(0, 25);

    cache.set(cacheKey, {
      data: sorted,
      expiresAt: Date.now() + 1000 * 60 * 8,
    });

    return NextResponse.json({ churches: sorted });
  } catch (error: any) {
    console.error("Error in GET /api/discover/churches:", error);
    return NextResponse.json(
      { error: "Unable to load churches right now." },
      { status: 500 }
    );
  }
}


