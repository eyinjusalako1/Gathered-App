import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";
import { getBlockedUserIds } from "@/lib/blocking";

type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

/**
 * GET /api/chat/dm/threads
 *
 * Returns DM threads for the current user with the other user's info
 * and the most recent message in each thread.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const userId = authUser.userId;
    const blockedUserIds = await getBlockedUserIds(userId);

    const { data: memberships, error: membershipsError } = await supabaseServer
      .from("dm_thread_members")
      .select("thread_id")
      .eq("user_id", userId);

    if (membershipsError) {
      console.error("Error fetching DM memberships:", membershipsError);
      return NextResponse.json(
        { error: "Failed to fetch threads" },
        { status: 500 }
      );
    }

    const threadIds = (memberships || []).map((m: any) => m.thread_id);
    if (threadIds.length === 0) {
      return NextResponse.json({ threads: [] });
    }

    const { data: threads, error: threadsError } = await supabaseServer
      .from("dm_threads")
      .select("id, updated_at")
      .in("id", threadIds)
      .order("updated_at", { ascending: false });

    if (threadsError) {
      console.error("Error fetching DM threads:", threadsError);
      return NextResponse.json(
        { error: "Failed to fetch threads" },
        { status: 500 }
      );
    }

    const { data: otherMembers, error: otherMembersError } = await supabaseServer
      .from("dm_thread_members")
      .select("thread_id, user_id")
      .in("thread_id", threadIds)
      .neq("user_id", userId);

    if (otherMembersError) {
      console.error("Error fetching DM thread members:", otherMembersError);
      return NextResponse.json(
        { error: "Failed to fetch threads" },
        { status: 500 }
      );
    }

    const otherUserIdByThread = new Map<string, string>();
    (otherMembers || []).forEach((row: any) => {
      if (!otherUserIdByThread.has(row.thread_id)) {
        otherUserIdByThread.set(row.thread_id, row.user_id);
      }
    });

    const otherUserIds = Array.from(
      new Set(
        Array.from(otherUserIdByThread.values()).filter(
          (id) => !blockedUserIds.has(id)
        )
      )
    );

    const { data: profiles, error: profilesError } = await supabaseServer
      .from("user_profiles")
      .select("id, name, email, avatar_url")
      .in("id", otherUserIds);

    if (profilesError) {
      console.error("Error fetching DM profiles:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch threads" },
        { status: 500 }
      );
    }

    const profileMap = new Map<string, UserProfile>();
    (profiles || []).forEach((p: UserProfile) => {
      profileMap.set(p.id, p);
    });

    const threadResults = await Promise.all(
      (threads || []).map(async (thread: any) => {
        const otherUserId = otherUserIdByThread.get(thread.id);
        if (!otherUserId || blockedUserIds.has(otherUserId)) {
          return null;
        }

        const { data: lastMessages } = await supabaseServer
          .from("dm_messages")
          .select("id, thread_id, user_id, content, created_at")
          .eq("thread_id", thread.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastMessage = lastMessages && lastMessages.length > 0
          ? lastMessages[0]
          : null;

        const profile = profileMap.get(otherUserId);
        const displayName =
          profile?.name?.trim() ||
          profile?.email?.split("@")[0] ||
          "User";

        return {
          id: thread.id,
          otherUser: {
            id: otherUserId,
            name: displayName,
            avatar_url: profile?.avatar_url || null,
          },
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                created_at: lastMessage.created_at,
                user_id: lastMessage.user_id,
              }
            : null,
          updated_at: thread.updated_at,
        };
      })
    );

    const filteredThreads = threadResults.filter(Boolean);

    return NextResponse.json({
      threads: filteredThreads,
    });
  } catch (error: any) {
    console.error("Error in GET /api/chat/dm/threads:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

