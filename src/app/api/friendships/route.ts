import { NextRequest, NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/friendships?userId=<other_user_id>
 *
 * Returns friendship status between the authenticated user and userId.
 * Possible statuses: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined'
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await createUserSupabaseClient(req);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: currentUserId } = authResult;
    const otherUserId = req.nextUrl.searchParams.get("userId");

    if (!otherUserId) {
      return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
    }

    if (otherUserId === currentUserId) {
      return NextResponse.json({ status: "self" });
    }

    const { data, error } = await supabaseServer
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .or(
        `and(requester_id.eq.${currentUserId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${currentUserId})`
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Failed to fetch friendship status" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ status: "none" });
    }

    if (data.status === "accepted") {
      return NextResponse.json({ status: "accepted" });
    }

    if (data.status === "declined") {
      return NextResponse.json({ status: "none" });
    }

    // pending
    if (data.requester_id === currentUserId) {
      return NextResponse.json({ status: "pending_sent" });
    } else {
      return NextResponse.json({ status: "pending_received" });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/friendships
 *
 * Sends a friend request from the authenticated user to addressee_id.
 * Body: { addressee_id: string }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await createUserSupabaseClient(req);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: currentUserId } = authResult;
    const body = await req.json();
    const { addressee_id } = body;

    if (!addressee_id) {
      return NextResponse.json({ error: "addressee_id is required" }, { status: 400 });
    }

    if (addressee_id === currentUserId) {
      return NextResponse.json({ error: "Cannot friend yourself" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("friendships")
      .insert({ requester_id: currentUserId, addressee_id, status: "pending" })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Friend request already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to send friend request" }, { status: 500 });
    }

    return NextResponse.json({ friendship: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
