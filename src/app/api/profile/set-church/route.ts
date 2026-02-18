import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, church, church_id } = body || {};

    if (!action || !["set", "unset"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    let targetChurchId: string | null = null;

    if (action === "set") {
      if (church) {
        const {
          id,
          name,
          lat,
          lng,
          address,
          city,
          postcode,
          denomination,
          website,
          source = "osm",
        } = church;

        if (!id || !name || typeof lat !== "number" || typeof lng !== "number") {
          return NextResponse.json(
            { error: "Invalid church payload" },
            { status: 400 }
          );
        }

        const { error: upsertError } = await supabaseServer
          .from("churches")
          .upsert(
            {
              id,
              name,
              lat,
              lng,
              address: address || null,
              city: city || null,
              postcode: postcode || null,
              denomination: denomination || null,
              website: website || null,
              source,
            },
            { onConflict: "id" }
          );

        if (upsertError) {
          console.error("Error upserting church:", upsertError);
          return NextResponse.json(
            {
              error: "Failed to save church",
              details: upsertError.message,
              hint: "Ensure churches.id is TEXT (e.g., node:123).",
            },
            { status: 500 }
          );
        }

        targetChurchId = id;
      } else if (church_id) {
        targetChurchId = church_id;
      } else {
        return NextResponse.json(
          { error: "Church is required" },
          { status: 400 }
        );
      }
    }

    const { error: updateError } = await supabaseServer
      .from("user_profiles")
      .update({ my_church_id: action === "set" ? targetChurchId : null })
      .eq("id", authUser.userId);

    if (updateError) {
      console.error("Error updating my_church_id:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ my_church_id: action === "set" ? targetChurchId : null });
  } catch (error: any) {
    console.error("Error in POST /api/profile/set-church:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

