import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type GroupResult = {
  id: string;
  name: string;
  description: string | null;
  group_type: string;
  location: string | null;
  member_count: number;
  max_members: number | null;
  tags: string[];
  is_private: boolean;
  join_status: "none" | "pending" | "member";
};

const GROUP_TYPE_LABELS: Record<string, string> = {
  bible_study: "Bible Study",
  prayer_group: "Prayer Group",
  fellowship: "Fellowship",
  youth_group: "Youth Group",
  senior_group: "Senior Group",
  mixed: "Mixed",
};

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.userId;

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();
    const city = (searchParams.get("city") || "").trim().toLowerCase();

    // Load user's existing memberships and pending requests in parallel
    const [{ data: memberships }, { data: pendingRequests }] = await Promise.all([
      supabaseServer
        .from("group_memberships")
        .select("group_id, status")
        .eq("user_id", userId)
        .in("status", ["active", "pending"]),
      supabaseServer
        .from("join_requests")
        .select("group_id, status")
        .eq("user_id", userId)
        .eq("status", "pending"),
    ]);

    const memberGroupIds = new Set<string>();
    const pendingMembershipIds = new Set<string>();
    (memberships || []).forEach((m: any) => {
      if (m.status === "active") memberGroupIds.add(m.group_id);
      if (m.status === "pending") pendingMembershipIds.add(m.group_id);
    });
    const pendingRequestIds = new Set<string>(
      (pendingRequests || []).map((r: any) => r.group_id)
    );

    // Fetch all active public groups (plus private groups user is already in)
    let groupsQuery = supabaseServer
      .from("fellowship_groups")
      .select(
        "id, name, description, group_type, location, member_count, max_members, tags, is_private, created_at"
      )
      .eq("is_active", true)
      .order("member_count", { ascending: false })
      .limit(100);

    // Show public groups + private groups user is already a member of
    if (memberGroupIds.size > 0) {
      groupsQuery = groupsQuery.or(
        `is_private.eq.false,id.in.(${Array.from(memberGroupIds).join(",")})`
      );
    } else {
      groupsQuery = groupsQuery.eq("is_private", false);
    }

    const { data: groups, error } = await groupsQuery;
    if (error) {
      console.error("Error loading groups:", error);
      return NextResponse.json({ error: "Failed to load groups" }, { status: 500 });
    }

    const results: GroupResult[] = (groups || [])
      .filter((g: any) => {
        if (!g?.id) return false;
        if (query) {
          const matchName = g.name?.toLowerCase().includes(query);
          const matchDesc = g.description?.toLowerCase().includes(query);
          const matchLocation = g.location?.toLowerCase().includes(query);
          const matchTags = (g.tags || []).some((t: string) =>
            t.toLowerCase().includes(query)
          );
          const matchType = GROUP_TYPE_LABELS[g.group_type]
            ?.toLowerCase()
            .includes(query);
          if (!matchName && !matchDesc && !matchLocation && !matchTags && !matchType)
            return false;
        }
        if (city) {
          const groupCity = (g.location || "").toLowerCase();
          if (!groupCity.includes(city)) return false;
        }
        return true;
      })
      .map((g: any) => {
        let join_status: "none" | "pending" | "member" = "none";
        if (memberGroupIds.has(g.id)) join_status = "member";
        else if (pendingMembershipIds.has(g.id) || pendingRequestIds.has(g.id))
          join_status = "pending";

        return {
          id: g.id,
          name: g.name,
          description: g.description || null,
          group_type: GROUP_TYPE_LABELS[g.group_type] || g.group_type || "Fellowship",
          location: g.location || null,
          member_count: g.member_count || 0,
          max_members: g.max_members || null,
          tags: Array.isArray(g.tags) ? g.tags : [],
          is_private: !!g.is_private,
          join_status,
        };
      });

    return NextResponse.json({ groups: results });
  } catch (error: any) {
    console.error("Error in GET /api/discover/groups:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
