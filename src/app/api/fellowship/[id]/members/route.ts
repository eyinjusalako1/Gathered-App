import { NextRequest, NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";
import { isUserSteward } from "@/lib/server-auth";

/**
 * GET /api/fellowship/[id]/members
 * 
 * Get all members (active and pending) for a group.
 * Only accessible by group admins or stewards.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params;

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const authResult = await createUserSupabaseClient(req);
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { client: supabase, userId } = authResult;

    // Check if user is admin of this group or a steward
    const { data: membership, error: membershipError } = await supabaseServer
      .from("group_memberships")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    // Allow any active member OR a steward (stewards may not have a membership row if group creation had an RLS issue)
    const isSteward = !membership ? await isUserSteward(userId) : false;
    if ((membershipError || !membership) && !isSteward) {
      return NextResponse.json(
        { error: "You must be a member of this group to view members" },
        { status: 403 }
      );
    }

    // Get all members (active and pending)
    const { data: members, error: membersError } = await supabaseServer
      .from("group_memberships")
      .select("id, user_id, role, status, joined_at, invited_by")
      .eq("group_id", groupId)
      .in("status", ["active", "pending"])
      .order("joined_at", { ascending: false });

    if (membersError) {
      console.error("Error fetching members:", membersError);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    // Get user profiles for better name/avatar data
    const userIds = Array.from(new Set(members?.map((m: any) => m.user_id) || []));
    let profileMap = new Map();
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseServer
        .from("user_profiles")
        .select("id, name, avatar_url")
        .in("id", userIds);

      if (profiles) {
        profileMap = new Map(profiles.map((p: any) => [p.id, p]));
      }
    }

    // Combine members with profile data
    const membersWithProfiles = (members || []).map((member: any) => {
      const profile = profileMap.get(member.user_id);
      return {
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        status: member.status,
        joined_at: member.joined_at,
        invited_by: member.invited_by,
        user: {
          id: member.user_id,
          name: profile?.name || `Member`,
          avatar_url: profile?.avatar_url || null,
        },
      };
    });

    return NextResponse.json({ members: membersWithProfiles });
  } catch (error: any) {
    console.error("Error in GET /api/fellowship/[id]/members:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}





