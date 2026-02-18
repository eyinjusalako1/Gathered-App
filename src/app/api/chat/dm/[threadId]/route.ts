import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";
import { getBlockDirection } from "@/lib/blocking";

/**
 * GET /api/chat/dm/[threadId]
 * 
 * Get all messages in a DM thread.
 * Returns messages with sender profile info.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> | { threadId: string } }
) {
  try {
    const { threadId } = await Promise.resolve(params);

    if (!threadId) {
      return NextResponse.json(
        { error: "Thread ID is required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const userId = authUser.userId;

    // Verify user is a member of the thread (RLS will also enforce this)
    const { data: membership, error: membershipError } = await supabaseServer
      .from("dm_thread_members")
      .select("thread_id")
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "You don't have access to this thread" },
        { status: 403 }
      );
    }

    // Check if thread is blocked
    const { data: otherMember } = await supabaseServer
      .from("dm_thread_members")
      .select("user_id")
      .eq("thread_id", threadId)
      .neq("user_id", userId)
      .limit(1)
      .single();

    const otherUserId = otherMember?.user_id || null;
    if (otherUserId) {
      const direction = await getBlockDirection(userId, otherUserId);
      if (direction !== "none") {
        return NextResponse.json(
          { error: "This conversation is unavailable because one of you is blocked." },
          { status: 403 }
        );
      }
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabaseServer
      .from("dm_messages")
      .select("id, thread_id, user_id, content, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    // Get user profiles for message senders
    const userIds = Array.from(new Set((messages || []).map((m: any) => m.user_id)));
    let profileMap = new Map();
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseServer
        .from("user_profiles")
        .select("id, name, email, avatar_url")
        .in("id", userIds);

      // Fetch auth.users for name fallback
      const { data: authUsers } = await supabaseServer.auth.admin.listUsers();
      
      if (profiles) {
        // Create a map of auth users by id for name fallback
        const authUsersMap = new Map();
        if (authUsers?.users) {
          authUsers.users.forEach((u: any) => {
            authUsersMap.set(u.id, {
              name: u.user_metadata?.name || u.user_metadata?.full_name || null,
              email: u.email || null,
            });
          });
        }

        profileMap = new Map(profiles.map((p: any) => {
          const authUser = authUsersMap.get(p.id);
          return [p.id, {
            ...p,
            // Use profile name, fallback to auth user metadata name, then email prefix, then "User"
            name: p.name?.trim() || authUser?.name?.trim() || p.email?.split('@')[0] || authUser?.email?.split('@')[0] || "User",
          }];
        }));
      }
    }

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    // Get other user info (the one who is not the current user)
    let otherUser = null;

    if (otherMember) {
      const { data: otherProfile } = await supabaseServer
        .from("user_profiles")
        .select("id, name, email, avatar_url, city")
        .eq("id", otherMember.user_id)
        .single();

      // Get name with fallback to auth.users
      let displayName = otherProfile?.name?.trim();
      if (!displayName) {
        try {
          const { data: authUser } = await supabaseServer.auth.admin.getUserById(otherMember.user_id);
          displayName = authUser?.user?.user_metadata?.name?.trim() || 
                       authUser?.user?.user_metadata?.full_name?.trim() || 
                       otherProfile?.email?.split('@')[0] || 
                       authUser?.user?.email?.split('@')[0] || 
                       "User";
        } catch {
          displayName = otherProfile?.email?.split('@')[0] || "User";
        }
      }

      otherUser = {
        id: otherProfile?.id || otherMember.user_id,
        name: displayName || "User",
        avatar_url: otherProfile?.avatar_url || null,
        city: otherProfile?.city || null,
      };
    }

    // Format messages with sender info
    const formattedMessages = (messages || []).map((msg: any) => {
      const profile = profileMap.get(msg.user_id) || {};
      return {
        id: msg.id,
        thread_id: msg.thread_id,
        user_id: msg.user_id,
        content: msg.content,
        created_at: msg.created_at,
        sender: {
          id: profile.id || msg.user_id,
          name: profile.name?.trim() || "User",
          avatar_url: profile.avatar_url || null,
        },
      };
    });

    return NextResponse.json({
      messages: formattedMessages,
      otherUser,
    });
  } catch (error: any) {
    console.error("Error in GET /api/chat/dm/[threadId]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/dm/[threadId]
 * 
 * Send a message in a DM thread.
 * Body: { content: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> | { threadId: string } }
) {
  try {
    const { threadId } = await Promise.resolve(params);
    const body = await req.json();
    const { content } = body;

    if (!threadId) {
      return NextResponse.json(
        { error: "Thread ID is required" },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const userId = authUser.userId;

    // Verify user is a member of the thread
    const { data: membership, error: membershipError } = await supabaseServer
      .from("dm_thread_members")
      .select("thread_id")
      .eq("thread_id", threadId)
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "You don't have access to this thread" },
        { status: 403 }
      );
    }

    const { data: otherMember } = await supabaseServer
      .from("dm_thread_members")
      .select("user_id")
      .eq("thread_id", threadId)
      .neq("user_id", userId)
      .limit(1)
      .single();

    const otherUserId = otherMember?.user_id || null;
    if (otherUserId) {
      const direction = await getBlockDirection(userId, otherUserId);
      if (direction !== "none") {
        return NextResponse.json(
          { error: "You cannot send messages to a blocked user." },
          { status: 403 }
        );
      }
    }

    // Insert message (RLS will verify user_id = auth.uid())
    const { data: newMessage, error: insertError } = await supabaseServer
      .from("dm_messages")
      .insert({
        thread_id: threadId,
        user_id: userId,
        content: content.trim(),
      })
      .select("id, thread_id, user_id, content, created_at")
      .single();

    if (insertError) {
      console.error("Error inserting message:", insertError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // Get sender profile
    const { data: profile } = await supabaseServer
      .from("user_profiles")
      .select("id, name, email, avatar_url")
      .eq("id", userId)
      .single();

    // Get auth user for name fallback
    let displayName = profile?.name?.trim();
    if (!displayName) {
      try {
        const { data: authUser } = await supabaseServer.auth.admin.getUserById(userId);
        displayName = authUser?.user?.user_metadata?.name?.trim() || 
                     authUser?.user?.user_metadata?.full_name?.trim() || 
                     profile?.email?.split('@')[0] || 
                     authUser?.user?.email?.split('@')[0] || 
                     "User";
      } catch {
        displayName = profile?.email?.split('@')[0] || "User";
      }
    }

    // Format message with sender info
    const formattedMessage = {
      id: newMessage.id,
      thread_id: newMessage.thread_id,
      user_id: newMessage.user_id,
      content: newMessage.content,
      created_at: newMessage.created_at,
      sender: {
        id: profile?.id || newMessage.user_id,
        name: displayName || "User",
        avatar_url: profile?.avatar_url || null,
      },
    };

    return NextResponse.json({
      message: formattedMessage,
    });
  } catch (error: any) {
    console.error("Error in POST /api/chat/dm/[threadId]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

