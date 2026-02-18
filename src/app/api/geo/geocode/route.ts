import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/osm";

export const dynamic = "force-dynamic";

type CacheEntry = {
  expiresAt: number;
  data: any;
};

const cache = new Map<string, CacheEntry>();

const getCacheKey = (query: string) => query.toLowerCase();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const cacheKey = getCacheKey(query);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ results: cached.data });
    }

    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "5",
    });

    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          "User-Agent": "GatheredApp/1.0 (https://gathered-app.vercel.app)",
          Referer: process.env.NEXT_PUBLIC_SITE_URL || "https://gathered-app.vercel.app",
          "Accept-Language": "en",
        },
      },
      8000
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to geocode this location right now." },
        { status: response.status }
      );
    }

    const data = (await response.json()) as Array<any>;
    const results = data.map((item) => ({
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon,
      city: item.address?.city || item.address?.town || item.address?.village || null,
      county: item.address?.county || null,
      country: item.address?.country || null,
      postcode: item.address?.postcode || null,
    }));

    cache.set(cacheKey, {
      data: results,
      expiresAt: Date.now() + 1000 * 60 * 10,
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Error in GET /api/geo/geocode:", error);
    return NextResponse.json(
      { error: "Unable to geocode this location right now." },
      { status: 500 }
    );
  }
}




