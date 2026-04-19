import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/invites/[code]
 *
 * Resolve an invite by code. Returns 410 if use limit reached.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> | { code: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { code } = resolvedParams;

    if (!code) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const { data: invite, error: inviteError } = await supabaseServer
      .from("invites")
      .select("id, invite_code, invite_type, group_id, created_at, use_count, max_uses")
      .eq("invite_code", code.toUpperCase())
      .maybeSingle();

    if (inviteError) {
      console.error("Error fetching invite:", inviteError);
      return NextResponse.json({ error: "Failed to load invite" }, { status: 500 });
    }

    if (!invite) {
      return NextResponse.json({ error: "Invite not found or invalid" }, { status: 404 });
    }

    // Check if invite has reached its usage limit
    if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
      return NextResponse.json({ error: "This invite link has reached its maximum uses" }, { status: 410 });
    }

    // Get group metadata if it's a group invite
    let groupMetadata = null;
    if (invite.invite_type === 'group' && invite.group_id) {
      const { data: group, error: groupError } = await supabaseServer
        .from("fellowship_groups")
        .select("id, name, description, avatar_url, member_count, is_private")
        .eq("id", invite.group_id)
        .single();

      if (!groupError && group) {
        groupMetadata = {
          id: group.id,
          name: group.name,
          description: group.description,
          avatar_url: group.avatar_url,
          member_count: group.member_count ?? 0,
          is_private: group.is_private,
        };
      }
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        invite_code: invite.invite_code,
        invite_type: invite.invite_type,
        created_at: invite.created_at,
        group: groupMetadata,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/invites/[code]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
