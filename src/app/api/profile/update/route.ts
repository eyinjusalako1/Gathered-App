import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * POST /api/profile/update
 *
 * Updates the authenticated user's own profile.
 * userId in the request body must match the authenticated user's ID.
 * The `role` field is never writable via this endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, ...profileData } = body;

    // Ownership check — userId in body must match the authenticated user
    if (!userId || userId !== authUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Role is not client-writable after onboarding
    if ("role" in profileData) {
      return NextResponse.json(
        { error: "Role changes must be requested through Gathered support" },
        { status: 403 }
      );
    }

    // Prepare update payload (only include fields that are provided)
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    // Map form fields to database columns
    if (profileData.name !== undefined) updatePayload.name = profileData.name || null;
    if (profileData.bio !== undefined) updatePayload.bio = profileData.bio || null;
    if (profileData.city !== undefined) updatePayload.city = profileData.city || null;
    if (profileData.location !== undefined) updatePayload.city = profileData.location || null;
    if (profileData.interests !== undefined) updatePayload.interests = profileData.interests || null;
    if (profileData.availability !== undefined) updatePayload.availability = profileData.availability || null;
    if (profileData.avatar_url !== undefined) updatePayload.avatar_url = profileData.avatar_url || null;
    if (profileData.avatarUrl !== undefined) updatePayload.avatar_url = profileData.avatarUrl || null;
    if (profileData.my_church_id !== undefined) updatePayload.my_church_id = profileData.my_church_id || null;
    if (profileData.discoverable !== undefined) updatePayload.discoverable = profileData.discoverable;
    if (profileData.growth_focus !== undefined) updatePayload.growth_focus = profileData.growth_focus || null;

    // Check if profile exists
    const { data: existing } = await supabaseServer
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    let data, error;
    if (existing) {
      // Profile exists, update it
      const result = await supabaseServer
        .from("user_profiles")
        .update(updatePayload)
        .eq("id", userId)
        .select("*")
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Profile doesn't exist, insert it
      const result = await supabaseServer
        .from("user_profiles")
        .insert({
          id: userId,
          ...updatePayload,
        })
        .select("*")
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error updating profile:", error);
      return NextResponse.json(
        { error: "Failed to update profile", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: data }, { status: 200 });
  } catch (error: any) {
    console.error("Unexpected error updating profile:", error);
    return NextResponse.json(
      { error: "Unexpected error updating profile", details: error.message },
      { status: 500 }
    );
  }
}

