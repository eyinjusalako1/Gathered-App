import { NextRequest, NextResponse } from "next/server";
import { AGENTS } from "@/agents/config";
import OpenAI from "openai";

// Lazy client creation - only create if API key exists
function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  try {
    return new OpenAI({ apiKey });
  } catch {
    return null;
  }
}

const MOCK_MODE = process.env.GATHERED_MOCK_AGENTS === "true";

/**
 * Simple mock responses for dev mode and fallback.
 * You can tweak these to match what you expect each agent to return.
 */
function getMockResponse(agentName: string, body: any) {
  switch (agentName) {
    case "OnboardingAssistant":
      return {
        short_bio: "Weekend gym, anime, church & chill hangs.",
        long_bio:
          "I'm into gym, anime, church and chilled social vibes. I like meeting new people in small groups, exploring food spots and having good conversations on weekends.",
        tags: ["gym", "anime", "church", "brunch", "chilled vibes"],
        social_style: body?.answers?.social_energy || "ambivert",
        preferred_group_size: body?.answers?.preferred_group_size || "3-5",
        availability_summary:
          body?.answers?.availability ||
          "Weekends and some weekday evenings.",
      };

    case "DiscoveryAssistant":
      return {
        intent: "mixed",
        interests: ["anime", "gym"],
        location_hint: "Stratford, London",
        time_preferences: "Sunday afternoons",
        other_constraints: ["faith-based"],
      };

    case "ContentEngine":
      return {
        content_type: body?.content_type || "tiktok_script",
        hooks: [
          "POV: You moved cities and your social life disappeared overnight.",
          "Adulting is wild: busy calendar, zero real friends.",
          "London is packed, but somehow you still feel alone?",
        ],
        script_outline: [
          "Relatable intro about struggling to make friends after uni.",
          "Show quick cuts of being at home vs going out alone.",
          "Introduce Gathered as the app that helps you find your people.",
          "End with CTA to join the waitlist / download.",
        ],
        cta: "Download Gathered and find your people in your city.",
        hashtags: ["#gatheredapp", "#newfriends", "#londonlife"],
      };

    case "DevOpsAssistant":
      return {
        diagnosis:
          "Likely an undefined or null value being accessed in the component based on the stack trace.",
        proposed_fix_explanation:
          "Add a defensive check before using the value and ensure the expected prop/state is set before render.",
        patch_suggestion:
          "// Example: if (!props.user) return null; // then safely use props.user below.",
        pr_title: "Add null-check to prevent runtime error in component",
        pr_description:
          "Adds a null-check around the user prop in the component to prevent crashes when the user object is not yet loaded.",
      };

    case "ActivityPlanner":
      const desc = (body?.description || "").toLowerCase();
      
      // Extract location from description
      let locationHint = body?.location_hint || "";
      const locationPatterns = [
        /(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s*,\s*[A-Z][a-z]+)?)/g,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,\s*([A-Z][a-z]+)/g,
      ];
      for (const pattern of locationPatterns) {
        const match = desc.match(pattern);
        if (match) {
          locationHint = match[0].replace(/^(?:in|near|at)\s+/i, "").trim();
          break;
        }
      }
      if (!locationHint) {
        locationHint = "local coffee shop or casual venue";
      }
      
      // Extract group size from description
      let groupSize = 6; // default
      const sizePatterns = [
        /(\d+)\s*-\s*(\d+)\s*people?/i,
        /(\d+)\s*people?/i,
        /small\s+group/i,
        /medium\s+group/i,
        /large\s+group|big\s+group/i,
      ];
      for (const pattern of sizePatterns) {
        const match = desc.match(pattern);
        if (match) {
          if (match[1] && match[2]) {
            // Range like "10-15"
            const min = parseInt(match[1]);
            const max = parseInt(match[2]);
            groupSize = Math.round((min + max) / 2); // Use middle of range
          } else if (match[1]) {
            // Single number
            groupSize = parseInt(match[1]);
          } else if (match[0].includes("small")) {
            groupSize = 4;
          } else if (match[0].includes("large") || match[0].includes("big")) {
            groupSize = 10;
          }
          break;
        }
      }
      if (body?.comfort_level?.includes("small")) groupSize = 4;
      if (body?.comfort_level?.includes("big")) groupSize = 10;
      
      // Extract time hint
      let timeHint = body?.time_hint || "";
      const timePatterns = [
        /(friday|saturday|sunday|monday|tuesday|wednesday|thursday)\s+(evening|afternoon|morning|night)/i,
        /(weekend|weekday)/i,
      ];
      for (const pattern of timePatterns) {
        const match = desc.match(pattern);
        if (match) {
          timeHint = match[0];
          break;
        }
      }
      if (!timeHint) {
        timeHint = "Friday evening or weekend";
      }
      
      return {
        suggested_title: desc.includes("anime") 
          ? "Anime & Board Games Night" 
          : desc.includes("coffee") 
          ? "Coffee & Chat Hangout"
          : desc.includes("games")
          ? "Games Night"
          : "Chill Hangout",
        suggested_description: body?.description 
          ? `A relaxed ${body.description} where we can connect and have a good time. All welcome!`
          : "A casual hangout where we can connect and have a good time. All welcome!",
        suggested_group_size: groupSize,
        suggested_tags: desc.split(" ").filter((w: string) => w.length > 3 && !["with", "that", "this", "have", "will", "from", "near", "in"].includes(w)).slice(0, 4) || ["casual", "hangout", "social"],
        suggested_location_hint: locationHint,
        suggested_time_hint: timeHint,
      };

    case "GroupPlanner": {
      const goal = (body?.goal || "").toLowerCase();
      const groupLocationHint = body?.location_hint || "";
      const audience = body?.audience || "";
      const meetingFreq = body?.meeting_frequency || "weekly";
      const tone = body?.tone || "chill";

      // Generate name based on goal and context
      let groupName = "Fellowship Group";
      if (goal.includes("bible") || goal.includes("study")) {
        if (groupLocationHint) {
          groupName = `${groupLocationHint.split(',')[0]} Bible Study`;
        } else if (audience) {
          groupName = `${audience} Bible Study`;
        } else {
          groupName = "Word & Worship";
        }
      } else if (goal.includes("prayer")) {
        groupName = groupLocationHint ? `${groupLocationHint.split(',')[0]} Prayer Circle` : "Prayer Circle";
      } else if (goal.includes("young adults") || goal.includes("youth")) {
        groupName = groupLocationHint ? `${groupLocationHint.split(',')[0]} Young Adults` : "Young Adults Fellowship";
      } else if (goal.includes("worship")) {
        groupName = "Worship & Fellowship";
      } else {
        // Extract key words from goal
        const words = goal.split(' ').filter((w: string) => w.length > 4).slice(0, 2);
        if (words.length > 0) {
          groupName = words.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + " Group";
        }
      }

      // Generate short description
      const shortDesc = goal.length > 120 
        ? goal.substring(0, 117) + "..."
        : goal || "A welcoming fellowship group for connection and growth.";

      // Generate full description
      const fullDesc = `${goal || "A welcoming fellowship group"}. We meet ${meetingFreq} to connect, grow, and support each other. ${audience ? `This group is designed for ${audience}.` : ""} All are welcome to join us on this journey.`;

      // Generate tags
      const tagWords = [
        ...(goal.split(' ').filter((w: string) => w.length > 3 && !["with", "that", "this", "have", "will", "from", "near", "in", "the", "and", "for", "are"].includes(w.toLowerCase())).slice(0, 3)),
        ...(audience ? [audience.toLowerCase()] : []),
        ...(tone === "chill" ? ["casual"] : tone === "structured" ? ["structured"] : tone === "deep" ? ["deep study"] : ["social"]),
        "fellowship"
      ];
      const uniqueTags = Array.from(new Set(tagWords.map((t: string) => t.toLowerCase()))).slice(0, 6);

      // Generate meeting schedule
      const schedule = meetingFreq === "weekly" 
        ? "Every Saturday 7pm"
        : meetingFreq === "biweekly"
        ? "First and third Sunday of each month at 6:30pm"
        : meetingFreq === "monthly"
        ? "First Sunday of each month at 6pm"
        : `Every ${meetingFreq} at 7pm`;

      // Generate rules
      const rules = [
        "Be respectful and kind to all members",
        "Commit to regular attendance when possible",
        "Keep discussions confidential and supportive",
        "Come with an open heart and willingness to grow",
        "Respect different perspectives and backgrounds"
      ].slice(0, 5);

      // Generate welcome message
      const welcomeMsg = `Welcome! We're excited to have you join our ${groupName.toLowerCase()}. We're here to support each other and grow together. Feel free to introduce yourself and jump into the conversation!`;

      return {
        suggested_name: groupName,
        suggested_short_description: shortDesc,
        suggested_full_description: fullDesc,
        suggested_meeting_schedule: schedule,
        suggested_tags: uniqueTags,
        suggested_privacy: goal.includes("private") ? "private" : "public",
        suggested_group_rules: rules,
        suggested_welcome_message: welcomeMsg,
      };
    }

    default:
      return { note: "No mock defined for this agent yet." };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const agentName = params.name as keyof typeof AGENTS;
  const agent = AGENTS[agentName];

  if (!agent) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }

  const body = await req.json();

  // 1) If dev mock mode is on, always return mock
  if (MOCK_MODE) {
    const mock = getMockResponse(agentName, body);
    return NextResponse.json({ 
      agent: agentName, 
      data: mock,
      _mock: true // Flag to indicate this is mock data
    });
  }

  const userContent = JSON.stringify(body);

  let llmResponseText: string;
  try {
    // 2) Try real LLM call
    llmResponseText = await callLLM({
      systemPrompt: agent.systemPrompt,
      userContent,
    });
  } catch (error: any) {
    console.error("LLM error for agent", agentName, error?.message || error);

    // 3) If API quota or error => fall back to mock
    const mock = getMockResponse(agentName, body);
    return NextResponse.json(
      {
        agent: agentName,
        data: mock,
        warning:
          "LLM call failed, returned mock response instead. Check API billing/limits.",
        _mock: true,
        _fallback: true
      },
      { status: 200 }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(llmResponseText || "{}");
  } catch (e) {
    // If parsing fails, also fall back to mock so the UI doesn't die
    const mock = getMockResponse(agentName, body);
    return NextResponse.json(
      {
        agent: agentName,
        data: mock,
        warning:
          "Agent did not return valid JSON, returned mock instead. Check prompt formatting.",
        _mock: true,
        _fallback: true
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    agent: agentName,
    data: parsed,
  });
}

async function callLLM(args: { systemPrompt: string; userContent: string }) {
  const { systemPrompt, userContent } = args;

  const client = getClient();
  if (!client) {
    throw new Error("OpenAI API key not configured");
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.4,
  });

  const message = completion.choices[0]?.message?.content;
  if (!message) {
    throw new Error("No response from language model");
  }

  return message;
}
