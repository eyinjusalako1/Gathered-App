import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/connections/respond
 * 
 * Respond to a connection request (accept or reject).
 * Body: { connectionId: string, action: 'accept' | 'reject' }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { connectionId, action } = body;

    if (!connectionId || !action) {
      return NextResponse.json(
        { error: "Connection ID and action are required" },
        { status: 400 }
      );
    }

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json(
        { error: "Action must be 'accept' or 'reject'" },
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

    // Get the connection
    const { data: connection, error: fetchError } = await supabaseServer
      .from("user_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Verify user is the recipient
    if (connection.recipient_id !== userId) {
      return NextResponse.json(
        { error: "You can only respond to connection requests sent to you" },
        { status: 403 }
      );
    }

    // Verify status is pending
    if (connection.status !== 'pending') {
      return NextResponse.json(
        { error: "Connection request has already been responded to" },
        { status: 400 }
      );
    }

    // Update connection status
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    const { data: updatedConnection, error: updateError } = await supabaseServer
      .from("user_connections")
      .update({ status: newStatus })
      .eq("id", connectionId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating connection:", updateError);
      return NextResponse.json(
        { error: "Failed to update connection" },
        { status: 500 }
      );
    }

    // If connection was accepted, create or get DM thread
    let threadId = null;
    if (action === 'accept') {
      const otherUserId = connection.requester_id === userId 
        ? connection.recipient_id 
        : connection.requester_id;

      try {
        // Check if thread exists
        const { data: existingThreads } = await supabaseServer
          .from("dm_thread_members")
          .select("thread_id")
          .eq("user_id", userId);

        if (existingThreads && existingThreads.length > 0) {
          const threadIds = existingThreads.map((t: any) => t.thread_id);
          const { data: sharedThreads } = await supabaseServer
            .from("dm_thread_members")
            .select("thread_id")
            .in("thread_id", threadIds)
            .eq("user_id", otherUserId)
            .limit(1);

          if (sharedThreads && sharedThreads.length > 0) {
            threadId = sharedThreads[0].thread_id;
          }
        }

        // Create thread if it doesn't exist
        if (!threadId) {
          const { data: newThread, error: createError } = await supabaseServer
            .from("dm_threads")
            .insert({})
            .select()
            .single();

          if (!createError && newThread) {
            threadId = newThread.id;
            await supabaseServer
              .from("dm_thread_members")
              .insert([
                { thread_id: threadId, user_id: userId },
                { thread_id: threadId, user_id: otherUserId },
              ]);
          }
        }
      } catch (dmError) {
        console.error("Error creating DM thread:", dmError);
        // Don't fail the connection acceptance if DM creation fails
      }
    }

    return NextResponse.json({
      connection: updatedConnection,
      message: `Connection request ${action}ed`,
      threadId: threadId, // Include threadId if created
    });
  } catch (error: any) {
    console.error("Error in POST /api/connections/respond:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

