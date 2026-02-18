import { NextRequest, NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";
import { isUserSteward } from "@/lib/server-auth";

/**
 * POST /api/fellowship/[id]/members/actions
 * 
 * Handle member management actions:
 * - approve: Approve pending member (status: pending -> active)
 * - reject: Reject pending member (status: pending -> rejected)
 * - remove: Remove active member (delete membership)
 * - promote: Promote member to admin (role: member -> admin)
 * - demote: Demote admin to member (role: admin -> member)
 * 
 * Only accessible by group admins or stewards.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const groupId = resolvedParams.id;
    const body = await req.json();
    const { action, membershipId, userId } = body;

    if (!groupId || !action) {
      return NextResponse.json(
        { error: "Group ID and action are required" },
        { status: 400 }
      );
    }

    if (!membershipId && !userId) {
      return NextResponse.json(
        { error: "Either membershipId or userId is required" },
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

    const { userId: currentUserId } = authResult;

    // Check if user is admin of this group or a steward
    const { data: membership, error: membershipError } = await supabaseServer
      .from("group_memberships")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", currentUserId)
      .eq("status", "active")
      .single();

    const isSteward = await isUserSteward(currentUserId);
    const isAdmin = membership?.role === "admin";

    if (membershipError || (!isAdmin && !isSteward)) {
      return NextResponse.json(
        { error: "You must be an admin of this group or a steward to perform this action" },
        { status: 403 }
      );
    }

    // Find the membership record
    let targetMembership;
    if (membershipId) {
      const { data, error } = await supabaseServer
        .from("group_memberships")
        .select("*")
        .eq("id", membershipId)
        .eq("group_id", groupId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Membership not found" },
          { status: 404 }
        );
      }
      targetMembership = data;
    } else if (userId) {
      const { data, error } = await supabaseServer
        .from("group_memberships")
        .select("*")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Membership not found" },
          { status: 404 }
        );
      }
      targetMembership = data;
    }

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 }
      );
    }

    // Prevent self-removal or self-demotion (unless steward)
    if (!isSteward && targetMembership.user_id === currentUserId) {
      if (action === "remove" || action === "demote") {
        return NextResponse.json(
          { error: "You cannot remove or demote yourself" },
          { status: 403 }
        );
      }
    }

    // Perform the action
    switch (action) {
      case "approve": {
        if (targetMembership.status !== "pending") {
          return NextResponse.json(
            { error: "Only pending members can be approved" },
            { status: 400 }
          );
        }

        const { error } = await supabaseServer
          .from("group_memberships")
          .update({ status: "active" })
          .eq("id", targetMembership.id);

        if (error) {
          console.error("Error approving member:", error);
          return NextResponse.json(
            { error: "Failed to approve member" },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, message: "Member approved" });
      }

      case "reject": {
        if (targetMembership.status !== "pending") {
          return NextResponse.json(
            { error: "Only pending members can be rejected" },
            { status: 400 }
          );
        }

        const { error } = await supabaseServer
          .from("group_memberships")
          .update({ status: "rejected" })
          .eq("id", targetMembership.id);

        if (error) {
          console.error("Error rejecting member:", error);
          return NextResponse.json(
            { error: "Failed to reject member" },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, message: "Member rejected" });
      }

      case "remove": {
        if (targetMembership.status !== "active") {
          return NextResponse.json(
            { error: "Only active members can be removed" },
            { status: 400 }
          );
        }

        const { error } = await supabaseServer
          .from("group_memberships")
          .delete()
          .eq("id", targetMembership.id);

        if (error) {
          console.error("Error removing member:", error);
          return NextResponse.json(
            { error: "Failed to remove member" },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, message: "Member removed" });
      }

      case "promote": {
        if (targetMembership.role === "admin") {
          return NextResponse.json(
            { error: "User is already an admin" },
            { status: 400 }
          );
        }

        const { error } = await supabaseServer
          .from("group_memberships")
          .update({ role: "admin" })
          .eq("id", targetMembership.id);

        if (error) {
          console.error("Error promoting member:", error);
          return NextResponse.json(
            { error: "Failed to promote member" },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, message: "Member promoted to admin" });
      }

      case "demote": {
        if (targetMembership.role === "member") {
          return NextResponse.json(
            { error: "User is already a member" },
            { status: 400 }
          );
        }

        // Prevent demoting the last admin (unless steward)
        if (!isSteward) {
          const { count: adminCount } = await supabaseServer
            .from("group_memberships")
            .select("id", { count: "exact", head: true })
            .eq("group_id", groupId)
            .eq("role", "admin")
            .eq("status", "active");

          if (adminCount === 1) {
            return NextResponse.json(
              { error: "Cannot demote the last admin" },
              { status: 400 }
            );
          }
        }

        const { error } = await supabaseServer
          .from("group_memberships")
          .update({ role: "member" })
          .eq("id", targetMembership.id);

        if (error) {
          console.error("Error demoting admin:", error);
          return NextResponse.json(
            { error: "Failed to demote admin" },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, message: "Admin demoted to member" });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Error in POST /api/fellowship/[id]/members/actions:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

