import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createUserSupabaseClient } from "@/lib/server-auth-utils";
import { sendPushToUsers } from "@/lib/notifications";

/**
 * PATCH /api/chat/group/[groupId]
 * Edit an existing group message. Only the original sender may edit.
 * Body: { messageId: string, content: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;

    const body = await req.json();
    const { messageId, content } = body;

    if (!messageId || !content?.trim()) {
      return NextResponse.json({ error: "messageId and content are required" }, { status: 400 });
    }

    const authResult = await createUserSupabaseClient(req);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId } = authResult;

    // Verify the message belongs to this group and this user
    const { data: existing, error: fetchErr } = await supabaseServer
      .from("group_chat_messages")
      .select("id, user_id, metadata")
      .eq("id", messageId)
      .eq("group_id", groupId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (existing.user_id !== userId) {
      return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const updatedMetadata = { ...(existing.metadata || {}), edited_at: now };

    const { data: updated, error: updateErr } = await supabaseServer
      .from("group_chat_messages")
      .update({ content: content.trim(), edited_at: now, metadata: updatedMetadata })
      .eq("id", messageId)
      .select("id, group_id, user_id, content, type, metadata, created_at, edited_at")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
    }

    return NextResponse.json({ message: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/chat/group/[groupId]
 * 
 * Fetches messages for a group chat.
 * 
 * Authorization:
 * - Requires authenticated user
 * - User must be an active member of the group
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      );
    }

    // Create user-authenticated Supabase client (respects RLS)
    const authResult = await createUserSupabaseClient(req);
    
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { client: supabase, userId } = authResult;

    // Defense-in-depth: Verify user is an active member of the group
    // (Using service role for this check only, as it's a read operation for verification)
    const { data: membership, error: membershipError } = await supabaseServer
      .from("group_memberships")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);

    if (membershipError || !membership || membership.length === 0) {
      return NextResponse.json(
        { error: "You must be an active member of this group to view messages" },
        { status: 403 }
      );
    }

    // Step 1: fetch messages
    const { data: messages, error: messagesError } = await supabaseServer
      .from("group_chat_messages")
      .select("id, group_id, user_id, content, type, metadata, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return NextResponse.json(
        {
          error: "Failed to fetch messages",
          details: messagesError.message,
          hint: messagesError.hint || "Check if group_chat_messages table exists",
        },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    // Step 2: fetch profiles for all senders (service role bypasses RLS)
    const userIds = Array.from(new Set(messages.map((m: any) => m.user_id)));
    let profileMap = new Map<string, { name: string | null; email: string | null; avatar_url: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabaseServer
        .from("user_profiles")
        .select("id, name, email, avatar_url")
        .in("id", userIds);

      if (profiles) {
        profileMap = new Map(profiles.map((p: any) => [p.id, p]));
      }
    }

    // Step 3: merge
    const messagesWithProfiles = messages.map((message: any) => {
      const profile = profileMap.get(message.user_id);
      const displayName = profile?.name?.trim() || profile?.email?.split('@')[0] || 'Member';

      return {
        id: message.id,
        group_id: message.group_id,
        user_id: message.user_id,
        content: message.content,
        type: message.type,
        metadata: message.metadata,
        created_at: message.created_at,
        user: {
          id: message.user_id,
          name: displayName,
          avatar_url: profile?.avatar_url || null,
        },
      };
    });

    return NextResponse.json({ messages: messagesWithProfiles });
  } catch (error: any) {
    console.error("Error in GET /api/chat/group/[groupId]:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { 
        error: error.message || "Internal server error",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/group/[groupId]
 * 
 * Posts a new message to a group chat.
 * 
 * Authorization:
 * - Requires authenticated user
 * - User must be an active member of the group
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { content, type = "text", metadata } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Create user-authenticated Supabase client (respects RLS)
    const authResult = await createUserSupabaseClient(req);
    
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { client: supabase, userId } = authResult;

    // Defense-in-depth: Verify user is an active member of the group
    // (Using service role for this check only, as it's a read operation for verification)
    const { data: membership, error: membershipError } = await supabaseServer
      .from("group_memberships")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);

    if (membershipError || !membership || membership.length === 0) {
      return NextResponse.json(
        { error: "You must be an active member of this group to post messages" },
        { status: 403 }
      );
    }

    // Insert message using user-authenticated client (RLS enforces access)
    const { data: messages, error: insertError } = await supabase
      .from("group_chat_messages")
      .insert({
        group_id: groupId,
        user_id: userId,
        content: content.trim(),
        type: type || "text",
        metadata: metadata || null,
      })
      .select(`
        id,
        group_id,
        user_id,
        content,
        type,
        metadata,
        created_at
      `)
      .limit(1);

    if (insertError) {
      console.error("Error inserting message:", insertError);
      console.error("Insert error details:", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });
      return NextResponse.json(
        { 
          error: "Failed to post message", 
          details: insertError.message,
          hint: insertError.hint || "Check if group_chat_messages table exists and RLS policies are set"
        },
        { status: 500 }
      );
    }

    // Get first result (should only be one)
    const newMessage = messages && messages.length > 0 ? messages[0] : null;
    
    if (!newMessage) {
      return NextResponse.json(
        { error: "Message created but could not be retrieved" },
        { status: 500 }
      );
    }

    // Get sender profile via service role (bypasses RLS)
    const { data: profile } = await supabaseServer
      .from("user_profiles")
      .select("name, email, avatar_url")
      .eq("id", userId)
      .single();

    const displayName = profile?.name?.trim() || profile?.email?.split("@")[0] || "Member";

    const messageWithProfile = {
      ...newMessage,
      user: {
        id: userId,
        name: displayName,
        avatar_url: profile?.avatar_url || null,
      },
    };

    // Send push notifications to all other active members.
    // Awaited before returning so Vercel doesn't terminate the function early.
    // Errors are logged but never affect the HTTP response.
    try {
      const [{ data: group }, { data: otherMembers }] = await Promise.all([
        supabaseServer
          .from("fellowship_groups")
          .select("name")
          .eq("id", groupId)
          .single(),
        supabaseServer
          .from("group_memberships")
          .select("user_id")
          .eq("group_id", groupId)
          .eq("status", "active")
          .neq("user_id", userId),
      ]);

      const recipientIds = (otherMembers || []).map((m: any) => m.user_id);

      if (recipientIds.length > 0) {
        const groupName = group?.name || "Group";
        const bodyText = content.trim().slice(0, 100);
        await sendPushToUsers(recipientIds, {
          title: displayName,
          body: `${groupName}: ${bodyText}`,
          url: `/chat/${groupId}`,
        });
      }
    } catch (pushErr: any) {
      console.error("[push] Group chat notification failed:", pushErr?.message);
    }

    return NextResponse.json({ message: messageWithProfile }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/chat/group/[groupId]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

