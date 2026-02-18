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

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();
    const cityParam = (searchParams.get("city") || "").trim();

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

    const baseQuery = supabaseServer
      .from("user_profiles")
      .select("id, name, email, avatar_url, city, bio, interests, discoverable")
      .eq("discoverable", true)
      .neq("id", userId)
      .limit(200);

    const { data: profiles, error: profilesError } = cityParam
      ? await baseQuery.ilike("city", `%${cityParam}%`)
      : await baseQuery;

    if (profilesError) {
      console.error("Error loading people:", profilesError);
      return NextResponse.json(
        { error: "Failed to load people" },
        { status: 500 }
      );
    }

    const userCity = normalizeCity(currentProfile?.city);
    const userInterests = Array.isArray(currentProfile?.interests)
      ? currentProfile!.interests
      : [];
    const userInterestSet = new Set(
      userInterests.map((interest: string) => interest.toLowerCase())
    );
    const cityFilter = normalizeCity(cityParam);

    const results: PersonResult[] = (profiles || [])
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

        let whySuggested: string | null = null;
        if (sameCity && sharedCount > 0) {
          whySuggested = `Same city and ${sharedCount} shared interest${sharedCount === 1 ? "" : "s"}`;
        } else if (sameCity) {
          whySuggested = "Same city";
        } else if (sharedCount > 0) {
          whySuggested = `${sharedCount} shared interest${sharedCount === 1 ? "" : "s"}`;
        }

        return {
          id: profile.id,
          name: formatDisplayName(profile),
          city: profile.city || null,
          bio: profile.bio || null,
          interests,
          avatar_url: profile.avatar_url || null,
          why_suggested: whySuggested,
          connection_status: "none",
          score,
        };
      });

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

