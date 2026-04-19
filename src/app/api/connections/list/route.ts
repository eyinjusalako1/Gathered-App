import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

type UserProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  interests: string[] | null;
};

const formatDisplayName = (profile?: UserProfile | null) => {
  if (!profile) return "User";
  return profile.name?.trim() || "User";
};

/**
 * GET /api/connections/list
 *
 * Returns incoming, outgoing, and accepted connections for the current user.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.userId;
    const { data: connections, error } = await supabaseServer
      .from("user_connections")
      .select("id, requester_id, recipient_id, status, created_at")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

    if (error) {
      console.error("Error loading connections:", error);
      return NextResponse.json(
        { error: "Failed to load connections" },
        { status: 500 }
      );
    }

    const otherUserIds = Array.from(
      new Set(
        (connections || [])
          .map((conn: any) =>
            conn.requester_id === userId
              ? conn.recipient_id
              : conn.requester_id
          )
          .filter(Boolean)
      )
    );

    let profiles: UserProfile[] = [];
    if (otherUserIds.length > 0) {
      const { data: profileData, error: profileError } = await supabaseServer
        .from("user_profiles")
        .select("id, name, avatar_url, city, bio, interests")
        .in("id", otherUserIds);

      if (profileError) {
        console.error("Error loading connection profiles:", profileError);
        return NextResponse.json(
          { error: "Failed to load connections" },
          { status: 500 }
        );
      }
      profiles = profileData || [];
    }

    const profileMap = new Map<string, UserProfile>();
    profiles.forEach((profile: UserProfile) => {
      profileMap.set(profile.id, profile);
    });

    const normalizeConnection = (conn: any) => {
      const otherUserId =
        conn.requester_id === userId ? conn.recipient_id : conn.requester_id;
      const profile = profileMap.get(otherUserId);
      return {
        ...conn,
        other_user: {
          id: otherUserId,
          name: formatDisplayName(profile),
          avatar_url: profile?.avatar_url || null,
          city: profile?.city || null,
          bio: profile?.bio || null,
          interests: profile?.interests || [],
        },
      };
    };

    const incoming = (connections || [])
      .filter(
        (conn: any) => conn.status === "pending" && conn.recipient_id === userId
      )
      .map(normalizeConnection);

    const outgoing = (connections || [])
      .filter(
        (conn: any) => conn.status === "pending" && conn.requester_id === userId
      )
      .map(normalizeConnection);

    const accepted = (connections || [])
      .filter((conn: any) => conn.status === "accepted")
      .map(normalizeConnection);

    return NextResponse.json({ incoming, outgoing, accepted });
  } catch (error: any) {
    console.error("Error in GET /api/connections/list:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

