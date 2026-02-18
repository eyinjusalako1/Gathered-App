import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/connections/request
 * 
 * Send a connection request to another user.
 * Body: { recipientId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientId } = body;

    if (!recipientId) {
      return NextResponse.json(
        { error: "Recipient ID is required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const authUser = await getAuthenticatedUser(req);
    if (!authUser || !authUser.userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in to send connection requests" },
        { status: 401 }
      );
    }

    const userId = authUser.userId;

    // Prevent self-connection
    if (userId === recipientId) {
      return NextResponse.json(
        { error: "Cannot send connection request to yourself" },
        { status: 400 }
      );
    }

    // Check if connection already exists (in either direction)
    const { data: existingConnections } = await supabaseServer
      .from("user_connections")
      .select("id, status")
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);
    
    const existingConnection = existingConnections?.find(
      (conn: any) =>
        (conn.requester_id === userId && conn.recipient_id === recipientId) ||
        (conn.requester_id === recipientId && conn.recipient_id === userId)
    );

    if (existingConnection) {
      if (existingConnection.status === 'pending') {
        return NextResponse.json(
          { error: "Connection request already exists" },
          { status: 400 }
        );
      }
      if (existingConnection.status === 'accepted') {
        return NextResponse.json(
          { error: "You are already connected" },
          { status: 400 }
        );
      }
    }

    // Create connection request
    const { data: connection, error: insertError } = await supabaseServer
      .from("user_connections")
      .insert({
        requester_id: userId,
        recipient_id: recipientId,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating connection request:", insertError);
      return NextResponse.json(
        { error: "Failed to send connection request" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { connection, message: "Connection request sent" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/connections/request:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

