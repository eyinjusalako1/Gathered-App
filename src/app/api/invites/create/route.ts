import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/invites/create
 * 
 * Create a new invite code for a group or app-wide invite.
 * 
 * Body: {
 *   invite_type: 'group' | 'app',
 *   group_id?: string (required if invite_type is 'group')
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in to create invites" },
        { status: 401 }
      );
    }

    const userId = authUser.userId;
    const body = await req.json();
    const { invite_type, group_id } = body;

    // Validate invite_type
    if (!invite_type || !['group', 'app'].includes(invite_type)) {
      return NextResponse.json(
        { error: "Invalid invite_type. Must be 'group' or 'app'" },
        { status: 400 }
      );
    }

    // Validate group_id for group invites
    if (invite_type === 'group' && !group_id) {
      return NextResponse.json(
        { error: "group_id is required for group invites" },
        { status: 400 }
      );
    }

    // If group invite, verify user has permission (must be member/admin of group)
    if (invite_type === 'group' && group_id) {
      try {
        // Get all memberships for this user/group and filter for active ones
        // There might be multiple records (historical), so we need to check all
        const { data: memberships, error: membershipError } = await supabaseServer
          .from("group_memberships")
          .select("role, status, joined_at")
          .eq("group_id", group_id)
          .eq("user_id", userId);

        // Log for debugging
        if (membershipError) {
          console.error("Error checking membership:", {
            error: membershipError,
            code: membershipError.code,
            message: membershipError.message,
            userId,
            group_id
          });
          return NextResponse.json(
            { error: "Failed to verify membership. Please try again." },
            { status: 500 }
          );
        }

        // Find active membership (there might be multiple historical records)
        const activeMembership = memberships?.find(m => m.status === 'active');

        // Check if active membership exists
        if (!activeMembership) {
          console.error("Membership check failed - no active membership:", { 
            userId, 
            group_id, 
            membershipsCount: memberships?.length || 0,
            allStatuses: memberships?.map(m => m.status) || []
          });
          return NextResponse.json(
            { error: "You must be a member of this group to create invites" },
            { status: 403 }
          );
        }

        console.log("Membership verified:", { userId, group_id, role: activeMembership.role });
      } catch (err: any) {
        console.error("Unexpected error checking membership:", err);
        return NextResponse.json(
          { error: "Failed to verify membership. Please try again." },
          { status: 500 }
        );
      }
    }

    // Generate short invite code (8 characters, alphanumeric)
    const generateInviteCode = (): string => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let inviteCode = generateInviteCode();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure code is unique
    while (attempts < maxAttempts) {
      const { data: existing } = await supabaseServer
        .from("invites")
        .select("id")
        .eq("invite_code", inviteCode)
        .single();

      if (!existing) {
        break; // Code is unique
      }

      inviteCode = generateInviteCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: "Failed to generate unique invite code. Please try again." },
        { status: 500 }
      );
    }

    // Create invite
    const { data: invite, error: createError } = await supabaseServer
      .from("invites")
      .insert({
        invite_code: inviteCode,
        inviter_user_id: userId,
        invite_type: invite_type,
        group_id: invite_type === 'group' ? group_id : null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating invite:", createError);
      return NextResponse.json(
        { error: "Failed to create invite" },
        { status: 500 }
      );
    }

    // Generate full invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gathered-app.vercel.app';
    const inviteUrl = `${baseUrl}/invite/${inviteCode}`;

    return NextResponse.json({
      invite: {
        id: invite.id,
        invite_code: invite.invite_code,
        invite_type: invite.invite_type,
        group_id: invite.group_id,
        created_at: invite.created_at,
        invite_url: inviteUrl,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/invites/create:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

