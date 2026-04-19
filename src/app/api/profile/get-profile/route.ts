import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/profile/get-profile
 *
 * Returns the authenticated user's own profile only.
 * The userId in the request body must match the authenticated user's ID.
 * Only safe, non-sensitive fields are returned.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const userId = body.userId as string | undefined;

    // Ownership check — only allow fetching your own profile
    if (!userId || userId !== authUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseServer
      .from("user_profiles")
      .select(
        "id, name, avatar_url, cover_image_url, bio, city, role, interests, availability, " +
        "growth_focus, discoverable, my_church_id, preferred_fellowship_id, " +
        "onboarding_completed, onboarding_version, profile_complete, " +
        "notif_cadence, notif_channel, quiet_hours_start, quiet_hours_end, " +
        "personalization_enabled, accessibility, life_stage, church_background, " +
        "gathering_intentions, reflection_preference, engagement_frequency, " +
        "created_at, updated_at"
      )
      .eq("id", userId)
      .limit(1);

    if (error) {
      console.error("Get profile error:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile", details: error.message },
        { status: 500 }
      );
    }

    const profile = data && data.length > 0 ? data[0] : null;

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (err: any) {
    console.error("Unexpected get-profile error:", err);
    return NextResponse.json(
      { error: "Unexpected error fetching profile", details: err.message },
      { status: 500 }
    );
  }
}



