import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";
import { getBlockedUserIds } from "@/lib/blocking";

type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  interests: string[] | null;
  discoverable: boolean | null;
  created_at: string | null;
};

type PersonResult = {
  id: string;
  name: string;
  city: string | null;
  bio: string | null;
  interests: string[];
  avatar_url: string | null;
  why_suggested: string | null;
  connection_status: "none";
  score: number;
};

const normalizeCity = (value?: string | null) =>
  value ? value.trim().toLowerCase() : "";

const formatDisplayName = (profile?: UserProfile | null) => {
  if (!profile) return "User";
  return profile.name?.trim() || profile.email?.split("@")[0] || "User";
};

const isRecentJoin = (createdAt: string | null): boolean => {
  if (!createdAt) return false;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() > thirtyDaysAgo;
};

async function reverseGeocodeCity(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: { "User-Agent": "Gathered-App/1.0" },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!resp.ok) return "";
    const geo = await resp.json();
    return (
      geo.address?.city ||
      geo.address?.town ||
      geo.address?.village ||
      geo.address?.county ||
      ""
    );
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();
    const cityParam = (searchParams.get("city") || "").trim();
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");

    const lat = latParam ? parseFloat(latParam) : null;
    const lng = lngParam ? parseFloat(lngParam) : null;

    // If coordinates provided without a city, reverse-geocode to get the city
    let resolvedCity = cityParam;
    if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && !cityParam) {
      resolvedCity = await reverseGeocodeCity(lat, lng);
    }

    const userId = authUser.userId;

    const { data: currentProfile, error: currentProfileError } =
      await supabaseServer
        .from("user_profiles")
        .select("id, city, interests")
        .eq("id", userId)
        .single();

    if (currentProfileError) {
      console.error("Error loading current profile:", currentProfileError);
      return NextResponse.json(
        { error: "Failed to load profile" },
        { status: 500 }
      );
    }

    const blockedUserIds = await getBlockedUserIds(userId);

    const { data: connections, error: connectionsError } = await supabaseServer
      .from("user_connections")
      .select("requester_id, recipient_id, status")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

    if (connectionsError) {
      console.error("Error loading connections:", connectionsError);
      return NextResponse.json(
        { error: "Failed to load people" },
        { status: 500 }
      );
    }

    const excludedIds = new Set<string>([userId]);
    (connections || []).forEach((conn: any) => {
      if (conn.status === "pending" || conn.status === "accepted") {
        excludedIds.add(conn.requester_id);
        excludedIds.add(conn.recipient_id);
      }
    });

    const userCity = normalizeCity(currentProfile?.city);
    const userInterests = Array.isArray(currentProfile?.interests)
      ? currentProfile!.interests
      : [];
    const userInterestSet = new Set(
      userInterests.map((interest: string) => interest.toLowerCase())
    );

    // ── fetch helpers ─────────────────────────────────────────────────────────

    const fetchProfiles = async (cityConstraint: string | null) => {
      const q = supabaseServer
        .from("user_profiles")
        .select("id, name, email, avatar_url, city, bio, interests, discoverable, created_at")
        .eq("discoverable", true)
        .neq("id", userId)
        .limit(200);
      return cityConstraint
        ? q.ilike("city", `%${cityConstraint}%`)
        : q;
    };

    const scoreProfiles = (
      profiles: UserProfile[],
      applyCityFilter: boolean
    ): PersonResult[] => {
      const cityFilter = applyCityFilter ? normalizeCity(resolvedCity) : "";
      return (profiles || [])
        .filter((profile: UserProfile) => {
          if (!profile?.id) return false;
          if (excludedIds.has(profile.id)) return false;
          if (blockedUserIds.has(profile.id)) return false;
          if (cityFilter) {
            const candidateCity = normalizeCity(profile.city);
            if (!candidateCity.includes(cityFilter)) return false;
          }
          if (query) {
            const matchName = profile.name?.toLowerCase().includes(query) ||
              profile.email?.toLowerCase().includes(query);
            const matchCity = profile.city?.toLowerCase().includes(query);
            const matchInterest = (profile.interests || []).some((interest: string) =>
              interest.toLowerCase().includes(query)
            );
            if (!matchName && !matchCity && !matchInterest) return false;
          }
          return true;
        })
        .map((profile: UserProfile) => {
          const candidateCity = normalizeCity(profile.city);
          const sameCity = userCity && candidateCity && candidateCity.includes(userCity);
          const interests = Array.isArray(profile.interests) ? profile.interests : [];
          const sharedInterests = interests.filter((interest: string) =>
            userInterestSet.has(interest.toLowerCase())
          );
          const sharedCount = sharedInterests.length;

          let score = 0;
          if (sameCity) score += 2;
          if (sharedCount > 0) score += sharedCount;

          const cityName = profile.city?.trim() || null;
          const firstShared = sharedInterests[0] || null;
          const extraShared = sharedCount - 1;

          let interestReason: string | null = null;
          if (firstShared) {
            interestReason = extraShared > 0
              ? `Shares your interest in ${firstShared} and ${extraShared} other${extraShared === 1 ? "" : "s"}`
              : `Shares your interest in ${firstShared}`;
          }

          let whySuggested: string | null = null;
          if (sameCity && interestReason) {
            whySuggested = `Lives in ${cityName} · ${interestReason}`;
          } else if (sameCity && cityName) {
            whySuggested = `Lives in ${cityName}`;
          } else if (interestReason) {
            whySuggested = interestReason;
          } else if (isRecentJoin(profile.created_at)) {
            whySuggested = "Joined recently";
          }

          return {
            id: profile.id,
            name: formatDisplayName(profile),
            city: profile.city || null,
            bio: profile.bio || null,
            interests,
            avatar_url: profile.avatar_url || null,
            why_suggested: whySuggested,
            connection_status: "none" as const,
            score,
          };
        });
    };

    // ── primary fetch (city-filtered if we have a city) ───────────────────────

    const { data: profiles, error: profilesError } = await fetchProfiles(
      resolvedCity || null
    );

    if (profilesError) {
      console.error("Error loading people:", profilesError);
      return NextResponse.json(
        { error: "Failed to load people" },
        { status: 500 }
      );
    }

    let results = scoreProfiles(profiles, !!resolvedCity);

    // ── fallback: if city filter produced nothing, retry without it ───────────

    if (results.length === 0 && resolvedCity) {
      const { data: fallbackProfiles, error: fallbackError } = await fetchProfiles(null);
      if (!fallbackError && fallbackProfiles) {
        results = scoreProfiles(fallbackProfiles, false);
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      people: results.map(({ score, ...person }) => person),
    });
  } catch (error: any) {
    console.error("Error in GET /api/discover/people:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
