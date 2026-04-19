import { NextRequest, NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/friendships/pending-count
 *
 * Returns the count of incoming pending friend requests for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await createUserSupabaseClient(req);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: currentUserId } = authResult;

    const { count, error } = await supabaseServer
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("addressee_id", currentUserId)
      .eq("status", "pending");

    if (error) {
      return NextResponse.json({ error: "Failed to fetch pending count" }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
