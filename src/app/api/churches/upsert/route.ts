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
    } = body || {};

    if (!id || !name || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "Invalid church payload" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
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
      )
      .select("*")
      .single();

    if (error) {
      console.error("Error upserting church:", error);
      return NextResponse.json(
        {
          error: "Failed to save church",
          details: error.message,
          hint: "Ensure churches.id is TEXT (e.g., node:123).",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ church: data });
  } catch (error: any) {
    console.error("Error in POST /api/churches/upsert:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

