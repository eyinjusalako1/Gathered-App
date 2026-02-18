import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";
import { getBlockDirection } from "@/lib/blocking";

/**
 * POST /api/chat/dm/get-or-create
 * 
 * Get or create a DM thread between the current user and another user.
 * Body: { otherUserId: string }
 * 
 * Returns: { threadId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { otherUserId } = body;

    if (!otherUserId) {
      return NextResponse.json(
        { error: "Other user ID is required" },
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

    // Prevent self-DM
    if (userId === otherUserId) {
      return NextResponse.json(
        { error: "Cannot create DM with yourself" },
        { status: 400 }
      );
    }

    const direction = await getBlockDirection(userId, otherUserId);
    if (direction !== "none") {
      return NextResponse.json(
        { error: "You cannot start a conversation with a blocked user." },
        { status: 403 }
      );
    }

    // Check if a thread already exists between these two users
    // Find threads where both users are members
    const { data: existingThreads, error: threadsError } = await supabaseServer
      .from("dm_thread_members")
      .select("thread_id")
      .eq("user_id", userId);

    if (threadsError) {
      console.error("Error fetching user threads:", threadsError);
      return NextResponse.json(
        { error: "Failed to fetch threads" },
        { status: 500 }
      );
    }

    if (existingThreads && existingThreads.length > 0) {
      const threadIds = existingThreads.map((t: any) => t.thread_id);

      // Check if any of these threads also has the other user as a member
      const { data: sharedThreads, error: sharedError } = await supabaseServer
        .from("dm_thread_members")
        .select("thread_id")
        .in("thread_id", threadIds)
        .eq("user_id", otherUserId)
        .limit(1);

      if (sharedError) {
        console.error("Error checking shared threads:", sharedError);
      } else if (sharedThreads && sharedThreads.length > 0) {
        // Thread exists, return it
        return NextResponse.json({
          threadId: sharedThreads[0].thread_id,
        });
      }
    }

    // No existing thread found, create a new one
    // Create the thread
    const { data: newThread, error: createThreadError } = await supabaseServer
      .from("dm_threads")
      .insert({})
      .select()
      .single();

    if (createThreadError || !newThread) {
      console.error("Error creating thread:", createThreadError);
      return NextResponse.json(
        { error: "Failed to create DM thread" },
        { status: 500 }
      );
    }

    // Add both users as members
    const { error: membersError } = await supabaseServer
      .from("dm_thread_members")
      .insert([
        { thread_id: newThread.id, user_id: userId },
        { thread_id: newThread.id, user_id: otherUserId },
      ]);

    if (membersError) {
      console.error("Error adding members:", membersError);
      // Clean up the thread if member insertion fails
      await supabaseServer
        .from("dm_threads")
        .delete()
        .eq("id", newThread.id);
      
      return NextResponse.json(
        { error: "Failed to create DM thread" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      threadId: newThread.id,
    });
  } catch (error: any) {
    console.error("Error in POST /api/chat/dm/get-or-create:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}



