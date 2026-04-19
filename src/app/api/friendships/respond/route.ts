import { NextRequest, NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/friendships/respond
 *
 * Accept or decline an incoming friend request.
 * Body: { requester_id: string, action: 'accept' | 'decline' }
 * Only the addressee (current user) can respond.
 */
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await createUserSupabaseClient(req);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: currentUserId } = authResult;
    const body = await req.json();
    const { requester_id, action } = body;

    if (!requester_id || !action) {
      return NextResponse.json({ error: "requester_id and action are required" }, { status: 400 });
    }

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
    }

    const newStatus = action === "accept" ? "accepted" : "declined";

    const { error } = await supabaseServer
      .from("friendships")
      .update({ status: newStatus })
      .eq("requester_id", requester_id)
      .eq("addressee_id", currentUserId)
      .eq("status", "pending");

    if (error) {
      return NextResponse.json({ error: "Failed to respond to friend request" }, { status: 500 });
    }

    return NextResponse.json({ status: newStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
