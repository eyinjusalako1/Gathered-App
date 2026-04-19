# CLAUDE.md

This file provides guidance to Claude Code when working on the Gathered codebase.

## About Gathered

Gathered is a Christian community + spiritual growth app. It is NOT just a church app or Bible app.

**Core positioning:** Community + Real-life connection + Spiritual growth

**Core retention loop:**
Open app → Today's Word → Reflect → Mark complete → Share/Connect → Return tomorrow

**Current build phase:** Activation + Retention (80–85% to strong MVP)
The remaining work is polish, flow, and emotional experience — NOT more features.

---

## Commands
```bash
npm run dev            # Start dev server (http://localhost:3000)
npm run build          # Production build
npm run lint           # ESLint
npm run type-check     # TypeScript strict check (no emit)
npm run deploy         # Deploy to Vercel production
npm run deploy:preview # Deploy to Vercel preview
```

> `next.config.js` sets `ignoreBuildErrors: true` — TypeScript and ESLint errors won't fail builds.
> Always run `npm run type-check` and `npm run lint` explicitly before deploying.

---

## Environment

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000`)
- `OPENAI_API_KEY` (required for AI features)

---

## Architecture

**Stack:** Next.js 14 App Router · TypeScript · Supabase · Tailwind CSS · Vercel

### Route Groups
- `src/app/(auth)/` — unauthenticated pages (login, signup, email callback)
- `src/app/(app)/` — protected pages with bottom nav (dashboard, fellowship, events, feed, chat)
- `src/app/api/` — serverless API routes (15+ groups); run with Supabase service role key to bypass RLS

### Data Flow
1. **Client hooks** (`src/hooks/`) — SWR + localStorage caching for instant UI
2. **API routes** (`src/app/api/`) — handle mutations via `lib/*-service.ts` or direct Supabase
3. **Service layer** (`src/lib/*-service.ts`) — all Supabase queries and business logic
4. **Auth** — `src/lib/auth-context.tsx`; `usePrefs()` provides role (`disciple` | `steward`)

### Supabase Client
`src/lib/supabase.ts` exports a Proxy-wrapped lazy client — only instantiates when first accessed.
- Use `supabase` for client-side (anon key)
- Import `createClient` with service role key directly in API routes for privileged operations

### Role System
- **Disciple** = regular member → renders `DiscipleHome`
- **Steward** = group leader/admin → renders `StewardHome`

### AI Agents
Configs in `src/agents/config.ts`. Eight agents:
- User-facing: `OnboardingAssistant`, `ActivityPlanner`, `DiscoveryAssistant`, `GroupPlanner`
- Internal: `ContentEngine`, `QAEngine`, `InsightsEngine`, `DevOpsAssistant`

API endpoints under `src/app/api/agents/` invoke via OpenAI SDK.

### Key Patterns
- Pages using client hooks → `export const dynamic = 'force-dynamic'`
- User profile cached in `localStorage` under `gathered_user_profile`; SWR keeps it fresh
- `src/types/index.ts` is the central type registry — all new shared types go here
- Tailwind custom palette: `gold`, `navy`, `beige` color families (see `tailwind.config.js`)

---

## Critical Product Decisions (Do Not Reverse)

- **`user_profiles`** is the single source of truth for user data — NOT `profiles`
- **Signup = auth only** — spiritual personalisation happens in onboarding, not signup
- **Daily word = deterministic** — selected via `dailyWord.ts` using focus + date, no DB call
- **Streaks = localStorage** for MVP — no DB streak table yet
- **`growth_focus`** drives everything: daily word selection, reflection prompt, prayer tone

---

## Known Issues (Fix Before Adding Features)

1. **Schema inconsistency** — `profiles` references may still exist in old code. Everything must use `user_profiles`. Search and replace any remaining `profiles` table references.
2. **Devotions code fragility** — old mock data is partially present alongside the new dynamic system. All devotion content must flow through `dailyWord.ts` only. Remove all mock/hardcoded devotion content.
3. **Vercel deploy instability** — caused by type mismatches and schema inconsistencies. Always run `npm run type-check` before deploying. Work on feature branches, not `main`.
4. **No activation moment** — users finish onboarding and drop into the app with no guided action. The `/welcome` first connection flow is the fix for this.

---

## Current Feature Status

### ✅ Devotions (most developed)
- Dynamic daily word engine (`dailyWord.ts`) ✅
- Verse pools by growth focus ✅
- Deterministic selection (focus + date) ✅
- Reflection prompts → adaptive ✅
- Reflection autosave ✅
- Private vs shared reflection ✅
- Share to group ✅
- Growth focus editing ✅
- Date offset support (yesterday's word) ✅
- **Streak logic** ⚠️ started, not finalised
- **Yesterday's Word UI** ⚠️ started, needs polish
- **Completion logic** ⚠️ partially implemented

### ✅ Onboarding
- Full guided spiritual onboarding flow ✅
- Writes to `user_profiles` ✅
- Forced onboarding for existing users ✅

### ⚠️ Discover / Groups / Chat
- Groups, group chat, reflection sharing, church discovery — working
- No first connection flow, no invite loop, no prayer request system

### ⚠️ Home Screen
- Functional but missing clear next action and strong devotions entry point

### ❌ Not Built Yet
- Invite system / referral loop
- Prayer request feature
- Social expansion / viral mechanics

---

## MVP Build Priority (Follow This Order)

1. **Finish devotion completion system**
   - Date-based completion key
   - Streak calculation
   - Completion UI state
   - Prevent duplicate completion

2. **Stabilise devotions code**
   - Remove all mock content
   - Unify everything to `dailyWord.ts`
   - Fix all related TypeScript types
   - Ensure clean build

3. **Build `/welcome` — First Connection Flow**
   - Onboarding → connect → join group

4. **Verify full user journey**
   - Signup → Onboarding → Welcome → Devotions → Complete → Return tomorrow

5. **Home screen prioritisation**
   - Clear next action
   - Strong devotions entry point

---

## What NOT to Build Right Now
- New feature categories (social expansion, referral loops, prayer requests)
- Any new tables or schema changes unless directly required by the priority list above
- Redesigning onboarding (it works)
- New AI agent configurations
