import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

type ChurchStats = {
  id: string;
  members_count: number;
  connections_count: number;
  is_my_church: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids") || "";
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ stats: [] });
    }

    const userId = authUser.userId;

    const { data: currentProfile, error: profileError } = await supabaseServer
      .from("user_profiles")
      .select("my_church_id")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error loading user profile:", profileError);
      return NextResponse.json(
        { error: "Failed to load profile" },
        { status: 500 }
      );
    }

    const { data: memberRows, error: membersError } = await supabaseServer
      .from("user_profiles")
      .select("my_church_id")
      .in("my_church_id", ids)
      .eq("discoverable", true);

    if (membersError) {
      console.error("Error loading church members:", membersError);
      return NextResponse.json(
        { error: "Failed to load church stats" },
        { status: 500 }
      );
    }

    const membersCountByChurch = new Map<string, number>();
    (memberRows || []).forEach((row: any) => {
      if (!row?.my_church_id) return;
      membersCountByChurch.set(
        row.my_church_id,
        (membersCountByChurch.get(row.my_church_id) || 0) + 1
      );
    });

    const { data: connections, error: connectionsError } = await supabaseServer
      .from("user_connections")
      .select("requester_id, recipient_id, status")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

    if (connectionsError) {
      console.error("Error loading connections:", connectionsError);
      return NextResponse.json(
        { error: "Failed to load church stats" },
        { status: 500 }
      );
    }

    const connectionUserIds = new Set<string>();
    (connections || []).forEach((conn: any) => {
      const otherUserId =
        conn.requester_id === userId ? conn.recipient_id : conn.requester_id;
      if (otherUserId) {
        connectionUserIds.add(otherUserId);
      }
    });

    const connectionsCountByChurch = new Map<string, number>();
    if (connectionUserIds.size > 0) {
      const { data: connectedProfiles, error: connectedError } =
        await supabaseServer
          .from("user_profiles")
          .select("id, my_church_id")
          .in("id", Array.from(connectionUserIds));

      if (connectedError) {
        console.error("Error loading connection profiles:", connectedError);
        return NextResponse.json(
          { error: "Failed to load church stats" },
          { status: 500 }
        );
      }

      (connectedProfiles || []).forEach((profile: any) => {
        if (!profile?.my_church_id) return;
        connectionsCountByChurch.set(
          profile.my_church_id,
          (connectionsCountByChurch.get(profile.my_church_id) || 0) + 1
        );
      });
    }

    const stats: ChurchStats[] = ids.map((id) => ({
      id,
      members_count: membersCountByChurch.get(id) || 0,
      connections_count: connectionsCountByChurch.get(id) || 0,
      is_my_church: currentProfile?.my_church_id === id,
    }));

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error("Error in GET /api/churches/stats:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

