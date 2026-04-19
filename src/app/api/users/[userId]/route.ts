import { NextRequest, NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/users/[userId]
 *
 * Returns public profile fields for any user.
 * Requires authentication — shows limited safe fields only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const targetUserId = resolvedParams.userId;

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const authResult = await createUserSupabaseClient(req);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseServer
      .from("user_profiles")
      .select("id, name, avatar_url, role, city, bio")
      .eq("id", targetUserId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
