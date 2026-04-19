import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { createClient } from "@supabase/supabase-js";

// Lazy initialization of Supabase admin client (only when needed)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set in environment variables."
    );
  }

  if (!serviceRoleKey) {
    // More helpful error message
    const errorMsg = 
      "SUPABASE_SERVICE_ROLE_KEY is not set in environment variables. " +
      "Please add it to your Vercel project settings and redeploy. " +
      "If you just added it, you may need to trigger a new deployment.";
    throw new Error(errorMsg);
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, answers, onboardingResult } = body;

    // Ownership check — userId in body must match the authenticated user
    if (!userId || userId !== authUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!onboardingResult) {
      return NextResponse.json(
        { error: "Onboarding result is required" },
        { status: 400 }
      );
    }

    // Parse interests from answers
    const interestsArray = answers?.interests
      ? answers.interests
          .split(",")
          .map((i: string) => i.trim())
          .filter((i: string) => i.length > 0)
      : [];

    // Combine AI-generated tags with parsed interests
    const allTags = [
      ...(onboardingResult.tags || []),
      ...interestsArray,
    ];
    const uniqueTags = Array.from(new Set(allTags));

    // Parse availability from answers
    const availabilityArray = answers?.availability
      ? answers.availability
          .split(",")
          .map((a: string) => a.trim())
          .filter((a: string) => a.length > 0)
      : [];

    // Prepare profile update payload
    const profileUpdate = {
      id: userId,
      bio: onboardingResult.long_bio || onboardingResult.short_bio || null,
      interests: uniqueTags.length > 0 ? uniqueTags : null,
      availability: availabilityArray.length > 0 ? availabilityArray : null,
      profile_complete: true,
      updated_at: new Date().toISOString(),
    };

    // Save to Supabase using admin client (bypasses RLS)
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .upsert(profileUpdate, {
        onConflict: "id",
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving profile to Supabase:", error);
      return NextResponse.json(
        {
          error: "Failed to save profile to database",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: data,
      message: "Profile saved successfully",
    });
  } catch (error: any) {
    console.error("Unexpected error saving profile:", error);
    
    // Provide more helpful error messages
    let errorMessage = error.message || "Unknown error";
    let errorDetails = error.message;
    
    if (error.message?.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      errorMessage = "Server configuration error";
      errorDetails = "The SUPABASE_SERVICE_ROLE_KEY environment variable is not set. Please add it to your Vercel project settings.";
    } else if (error.message?.includes("NEXT_PUBLIC_SUPABASE_URL")) {
      errorMessage = "Server configuration error";
      errorDetails = "The NEXT_PUBLIC_SUPABASE_URL environment variable is not set.";
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}

