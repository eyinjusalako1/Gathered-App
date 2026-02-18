import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/invites/accept
 * 
 * Accept an invite code.
 * 
 * Body: {
 *   invite_code: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in to accept invites" },
        { status: 401 }
      );
    }

    const userId = authUser.userId;
    const body = await req.json();
    const { invite_code } = body;

    if (!invite_code) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      );
    }

    // Get invite
    const { data: invite, error: inviteError } = await supabaseServer
      .from("invites")
      .select("id, invite_code, invite_type, group_id, accepted_at, inviter_user_id")
      .eq("invite_code", invite_code.toUpperCase())
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Invite not found or invalid" },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: "This invite has already been used" },
        { status: 410 }
      );
    }

    // Prevent self-invite
    if (invite.inviter_user_id === userId) {
      return NextResponse.json(
        { error: "You cannot accept your own invite" },
        { status: 400 }
      );
    }

    // Update invite to mark as accepted
    const { error: updateError } = await supabaseServer
      .from("invites")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId,
      })
      .eq("id", invite.id)
      .is("accepted_at", null); // Only update if not already accepted

    if (updateError) {
      console.error("Error updating invite:", updateError);
      return NextResponse.json(
        { error: "Failed to accept invite" },
        { status: 500 }
      );
    }

    let redirectPath = "/dashboard";

    // If group invite, auto-join user to group
    if (invite.invite_type === 'group' && invite.group_id) {
      // Check if user is already a member
      const { data: existingMembership } = await supabaseServer
        .from("group_memberships")
        .select("id")
        .eq("group_id", invite.group_id)
        .eq("user_id", userId)
        .single();

      if (!existingMembership) {
        // Create membership
        const { error: membershipError } = await supabaseServer
          .from("group_memberships")
          .insert({
            group_id: invite.group_id,
            user_id: userId,
            role: "member",
            status: "active",
          });

        if (membershipError) {
          console.error("Error creating group membership:", membershipError);
          // Continue anyway - invite is accepted
          // Note: Member count is automatically updated via trigger
        }
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
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

