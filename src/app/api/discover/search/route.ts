import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth-utils";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Request body for discovery search
 */
export interface DiscoverySearchRequest {
  intent: "find_events" | "find_people" | "find_groups" | "mixed";
  interests?: string[];
  location_hint?: string;
  time_preferences?: string;
  other_constraints?: string[];
}

/**
 * Event result from discovery search
 */
export interface DiscoveryEventResult {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location?: string;
  tags: string[];
  event_type: string;
  is_virtual: boolean;
  virtual_link?: string;
  created_by: string;
  rsvp_count: number;
  max_attendees?: number;
}

/**
 * Response from discovery search
 */
export interface DiscoverySearchResponse {
  events: DiscoveryEventResult[];
}

/**
 * POST /api/discover/search
 * 
 * Searches for events matching DiscoveryAssistant filters.
 * For v1, focuses on events only.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: DiscoverySearchRequest = await req.json();

    // Validate request
    if (!body.intent) {
      return NextResponse.json(
        { error: "Intent is required" },
        { status: 400 }
      );
    }

    // For v1, only handle events (or mixed with events)
    if (body.intent !== "find_events" && body.intent !== "mixed") {
      return NextResponse.json(
        { 
          events: [],
          message: "People and groups search coming soon" 
        },
        { status: 200 }
      );
    }

    const now = new Date().toISOString();
    
    // Start building the query - only future, active events
    let query = supabaseServer
      .from("events")
      .select("*")
      .eq("is_active", true)
      .gte("start_time", now)
      .order("start_time", { ascending: true })
      .limit(50); // Limit results for performance

    // Execute the base query (future, active events)
    // We'll do interest filtering in memory for better flexibility
    const { data: events, error } = await query;

    if (error) {
      console.error("Discovery search error:", error);
      return NextResponse.json(
        { error: "Failed to search events", details: error.message },
        { status: 500 }
      );
    }

    if (!events || events.length === 0) {
      return NextResponse.json<DiscoverySearchResponse>(
        { events: [] },
        { status: 200 }
      );
    }

    // Filter results in memory for better matching
    let filteredEvents = events;

    // Apply interest filters (tags and text matching)
    if (body.interests && body.interests.length > 0) {
      const interestFilters = body.interests
        .map((interest) => interest.toLowerCase().trim())
        .filter((interest) => interest.length > 0);

      filteredEvents = filteredEvents.filter((event) => {
        // Check tags array overlap
        const eventTags = ((event.tags || []) as string[]).map((tag: string) => tag.toLowerCase());
        const hasTagMatch = interestFilters.some((interest) =>
          eventTags.some((tag: string) => tag.includes(interest) || interest.includes(tag))
        );

        // Check title/description text match
        const titleLower = (event.title || "").toLowerCase();
        const descLower = (event.description || "").toLowerCase();
        const hasTextMatch = interestFilters.some((interest) =>
          titleLower.includes(interest) || descLower.includes(interest)
        );

        return hasTagMatch || hasTextMatch;
      });
    }

    // Apply location filter if provided
    if (body.location_hint && body.location_hint.trim().length > 0) {
      const locationHint = body.location_hint.toLowerCase().trim();
      filteredEvents = filteredEvents.filter((event) => {
        if (!event.location) return false;
        return event.location.toLowerCase().includes(locationHint);
      });
    }

    // Map to response format
    const results: DiscoveryEventResult[] = filteredEvents.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      start_time: event.start_time,
      end_time: event.end_time,
      location: event.location || undefined,
      tags: event.tags || [],
      event_type: event.event_type,
      is_virtual: event.is_virtual,
      virtual_link: event.virtual_link || undefined,
      created_by: event.created_by,
      rsvp_count: event.rsvp_count || 0,
      max_attendees: event.max_attendees || undefined,
    }));

    return NextResponse.json<DiscoverySearchResponse>(
      { events: results },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Unexpected discovery search error:", error);
    return NextResponse.json(
      { error: "Unexpected error during search", details: error.message },
      { status: 500 }
    );
  }
}

