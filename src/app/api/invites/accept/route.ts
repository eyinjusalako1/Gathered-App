import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/invites/accept
 *
 * Accept an invite code. Multi-use: increments use_count, blocked only when
 * use_count >= max_uses AND max_uses IS NOT NULL.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized - Please log in to accept invites" }, { status: 401 });
    }

    const userId = authUser.userId;
    const body = await req.json();
    const { invite_code } = body;

    if (!invite_code) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    // Fetch invite with multi-use columns
    const { data: invite, error: inviteError } = await supabaseServer
      .from("invites")
      .select("id, invite_code, invite_type, group_id, use_count, max_uses, inviter_user_id")
      .eq("invite_code", invite_code.toUpperCase())
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invite not found or invalid" }, { status: 404 });
    }

    // Check usage limit (null = unlimited)
    if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
      return NextResponse.json({ error: "This invite link has reached its maximum uses" }, { status: 410 });
    }

    // Prevent self-invite
    if (invite.inviter_user_id === userId) {
      return NextResponse.json({ error: "You cannot accept your own invite" }, { status: 400 });
    }

    // Increment use_count
    await supabaseServer
      .from("invites")
      .update({ use_count: invite.use_count + 1 })
      .eq("id", invite.id);

    let redirectPath = "/dashboard";

    // If group invite, join the group (invite = trusted, always active membership)
    if (invite.invite_type === 'group' && invite.group_id) {
      // Check if user already has an active membership
      const { data: existingMembership } = await supabaseServer
        .from("group_memberships")
        .select("id, status")
        .eq("group_id", invite.group_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingMembership?.status === 'active') {
        // Already a member — nothing to do
      } else if (existingMembership) {
        // Has a pending/rejected row — upgrade to active
        await supabaseServer
          .from("group_memberships")
          .update({ status: "active", joined_at: new Date().toISOString() })
          .eq("id", existingMembership.id);
      } else {
        // No row — create fresh active membership
        await supabaseServer
          .from("group_memberships")
          .insert({
            group_id: invite.group_id,
            user_id: userId,
            role: "member",
            status: "active",
            joined_at: new Date().toISOString(),
            invited_by: invite.inviter_user_id,
          });
      }

      redirectPath = `/fellowship/${invite.group_id}`;
    }

    return NextResponse.json({
      success: true,
      invite_type: invite.invite_type,
      group_id: invite.group_id,
      redirect_path: redirectPath,
    });
  } catch (error: any) {
    console.error("Error in POST /api/invites/accept:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
