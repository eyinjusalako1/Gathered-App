import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  city: string | null;
};

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

    const userId = authUser.userId;
    const { data: blockedRows, error } = await supabaseServer
      .from("blocked_users")
      .select("blocked_id, created_at")
      .eq("blocker_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading blocked users:", error);
      return NextResponse.json(
        { error: "Failed to load blocked users" },
        { status: 500 }
      );
    }

    const blockedIds = (blockedRows || [])
      .map((row: any) => row.blocked_id)
      .filter(Boolean);

    let profiles: UserProfile[] = [];
    if (blockedIds.length > 0) {
      const { data: profileData, error: profileError } = await supabaseServer
        .from("user_profiles")
        .select("id, name, email, avatar_url, city")
        .in("id", blockedIds);

      if (profileError) {
        console.error("Error loading blocked profiles:", profileError);
        return NextResponse.json(
          { error: "Failed to load blocked users" },
          { status: 500 }
        );
      }
      profiles = profileData || [];
    }

    const profileMap = new Map<string, UserProfile>();
    profiles.forEach((profile) => profileMap.set(profile.id, profile));

    const blocked = (blockedRows || []).map((row: any) => {
      const profile = profileMap.get(row.blocked_id);
      return {
        ...row,
        profile: profile
          ? {
              id: profile.id,
              name: formatDisplayName(profile),
              avatar_url: profile.avatar_url || null,
              city: profile.city || null,
            }
          : null,
      };
    });

    return NextResponse.json({ blocked });
  } catch (error: any) {
    console.error("Error in GET /api/safety/blocked:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

