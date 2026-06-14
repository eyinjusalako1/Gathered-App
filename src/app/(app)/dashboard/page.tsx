"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/lib/supabase";
import { getDailyWord } from "@/lib/dailyWord";
import FounderMessageModal, {
  FOUNDER_MESSAGE_STORAGE_KEY,
} from "@/components/FounderMessageModal";
import NotificationPrompt from "@/components/NotificationPrompt";
import AddToHomeScreenPrompt from "@/components/AddToHomeScreenPrompt";
import FaithFeed from "@/components/feed/FaithFeed";
import PostComposer from "@/components/feed/PostComposer";
import { Pencil } from "lucide-react";
import {
  BookOpen,
  MapPin,
  Settings,
  X,
  UserCheck,
  XCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

const getCompletionDateKey = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// ─── types ──────────────────────────────────────────────────────────────────

interface IncomingRequest {
  id: string;
  requester_id: string;
  other_user: {
    id: string;
    name: string;
    avatar_url: string | null;
    city: string | null;
  };
}

interface DiscoveredPerson {
  id: string;
  name: string | null;
  city: string | null;
  interests: string[] | null;
  avatar_url?: string | null;
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile();

  const dailyWord = useMemo(
    () => getDailyWord(profile?.growth_focus),
    [profile?.growth_focus]
  );

  // Devotion streak from localStorage
  const [devotionStreak, setDevotionStreak] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const streak = parseInt(localStorage.getItem("devotions_streak") || "0", 10);
    setDevotionStreak(isNaN(streak) ? 0 : streak);
  }, []);

  // People for in-feed follow suggestions
  const [people, setPeople] = useState<DiscoveredPerson[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch("/api/discover/people", {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        setPeople(data.people || []);
      } catch {
        setPeople([]);
      }
    })();
  }, [user]);

  // Incoming connection requests
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch("/api/connections/list", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setIncomingRequests(data.incoming || []);
        }
      } catch { /* ignore */ }
    })();
  }, [user]);

  const handleConnectionRespond = async (
    connectionId: string,
    action: "accept" | "reject"
  ) => {
    setRequestActionLoading(connectionId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/connections/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ connectionId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setIncomingRequests((prev) => prev.filter((r) => r.id !== connectionId));
        if (action === "accept" && data.threadId) {
          router.push(`/chat/dm/${data.threadId}`);
        }
      }
    } catch { /* ignore */ } finally {
      setRequestActionLoading(null);
    }
  };

  // Compose
  const [composerOpen, setComposerOpen] = useState(false);

  // Beta welcome banner — gated by localStorage
  const [showBetaWelcome, setShowBetaWelcome] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowBetaWelcome(
      localStorage.getItem("gathered_beta_welcome_dismissed") !== "true"
    );
  }, []);

  const handleDismissBetaWelcome = () => {
    localStorage.setItem("gathered_beta_welcome_dismissed", "true");
    setShowBetaWelcome(false);
  };

  // Founder message modal
  const [showFounderMessage, setShowFounderMessage] = useState(false);
  useEffect(() => {
    if (profileLoading || !user || typeof window === "undefined") return;
    try {
      if (localStorage.getItem(FOUNDER_MESSAGE_STORAGE_KEY) !== "true") {
        setShowFounderMessage(true);
      }
    } catch { /* ignore */ }
  }, [profileLoading, user]);

  // Derived values
  const firstName = useMemo(() => {
    const name = profile?.name || user?.user_metadata?.name || "";
    return String(name).split(" ")[0];
  }, [profile?.name, user?.user_metadata?.name]);

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    const checks = [
      !!profile.name,
      !!profile.bio,
      !!profile.city,
      (profile.interests?.length || 0) > 0,
      (profile.availability?.length || 0) > 0,
      !!profile.avatar_url,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  const pendingFriendCount = incomingRequests.length;

  // Above-feed slot: only one prompt shown at a time
  // Priority: beta welcome → connection requests → notification/PWA prompts
  const aboveFeedSlot = showBetaWelcome
    ? "beta"
    : incomingRequests.length > 0
    ? "requests"
    : "prompts";

  return (
    <main className="min-h-screen bg-navy-900 text-slate-50 flex justify-center py-8 px-4">
      <div className="w-full max-w-5xl space-y-6">

        {/* ── Greeting header ──────────────────────────────────────────── */}
        <section className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <button
                onClick={() => router.push("/profile")}
                className={`w-10 h-10 rounded-full flex items-center justify-center bg-navy-800 border border-white/10 overflow-hidden ${
                  profileCompletion >= 80
                    ? "ring-2 ring-gold-500/70 ring-offset-2 ring-offset-navy-900"
                    : ""
                }`}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name || "Profile"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-gold-500">
                    {getInitials(profile?.name || firstName || "U")}
                  </span>
                )}
              </button>
              {pendingFriendCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                  {pendingFriendCount > 9 ? "9+" : pendingFriendCount}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">
                Today on Gathered
              </p>
              <p className="text-base font-semibold">
                {firstName ? `Hey, ${firstName} 👋` : "Welcome back 👋"}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/settings")}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors shrink-0"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </section>

        {/* ── Slim daily-word strip ─────────────────────────────────────── */}
        <button
          onClick={() => router.push("/devotions")}
          className="w-full flex items-center gap-3 rounded-xl bg-gold-500/10 border border-gold-500/20 px-4 py-3 hover:bg-gold-500/15 transition-colors text-left"
        >
          <BookOpen className="w-4 h-4 text-gold-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-gold-400 uppercase tracking-wider mr-2">
              Today&apos;s Word
            </span>
            <span className="text-sm font-semibold text-slate-100 mr-1.5">
              {dailyWord.title}
            </span>
            <span className="text-xs text-slate-400">{dailyWord.reference}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {devotionStreak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 border border-gold-500/25 px-2 py-0.5 text-[10px] font-bold text-gold-300">
                🔥 {devotionStreak}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </button>

        {/* ── Above-feed slot — one prompt at a time ───────────────────── */}
        {aboveFeedSlot === "beta" && (
          <section className="rounded-2xl border border-gold-500/30 bg-navy-800/80 p-4 relative">
            <button
              onClick={handleDismissBetaWelcome}
              className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-white mb-2 pr-6">
              Welcome to the Gathered beta 👋
            </p>
            <ul className="space-y-1.5 mb-3">
              <li className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-gold-400 mt-0.5 shrink-0">•</span>
                Start with today&apos;s Word — read, reflect, and mark it complete
                to build your streak
              </li>
              <li className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-gold-400 mt-0.5 shrink-0">•</span>
                Use Discover to find believers in your city and send connection
                requests
              </li>
              <li className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-gold-400 mt-0.5 shrink-0">•</span>
                Join or create a group to share reflections and pray together
              </li>
            </ul>
            <a
              href="https://gathered-app.com/#feedback"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 transition-colors"
            >
              Send feedback →
            </a>
          </section>
        )}

        {aboveFeedSlot === "requests" && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Connection request{incomingRequests.length > 1 ? "s" : ""}
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {incomingRequests.length}
                </span>
              </h2>
              <button
                onClick={() => router.push("/more/connections?tab=incoming")}
                className="text-xs text-gold-500 hover:text-gold-400"
              >
                See all →
              </button>
            </div>
            <div className="space-y-2">
              {incomingRequests.slice(0, 3).map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-gold-500/30 bg-navy-800/50 px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {req.other_user.avatar_url ? (
                      <img
                        src={req.other_user.avatar_url}
                        alt={req.other_user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-gold-500">
                        {getInitials(req.other_user.name)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">
                      {req.other_user.name}
                    </p>
                    {req.other_user.city && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {req.other_user.city}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleConnectionRespond(req.id, "reject")}
                      disabled={requestActionLoading === req.id}
                      className="p-2 rounded-full border border-white/15 text-slate-400 hover:text-red-400 hover:border-red-400/40 transition-colors disabled:opacity-50"
                      aria-label="Decline"
                    >
                      {requestActionLoading === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleConnectionRespond(req.id, "accept")}
                      disabled={requestActionLoading === req.id}
                      className="p-2 rounded-full bg-gold-500 text-navy-900 hover:bg-gold-600 transition-colors disabled:opacity-50"
                      aria-label="Accept"
                    >
                      {requestActionLoading === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {aboveFeedSlot === "prompts" && (
          <>
            <NotificationPrompt />
            <AddToHomeScreenPrompt />
          </>
        )}

        {/* ── Composer prompt row ──────────────────────────────────────── */}
        {user?.id && (
          <button
            onClick={() => setComposerOpen(true)}
            className="w-full text-left rounded-xl border border-white/10 bg-navy-800/50 px-4 py-3 text-sm text-slate-400 hover:border-gold-500/30 hover:text-slate-300 transition-colors"
          >
            What&apos;s God doing in your life today?
          </button>
        )}

        {/* ── Faith Feed ────────────────────────────────────────────────── */}
        {user?.id && (
          <FaithFeed userId={user.id} followSuggestions={people} />
        )}

      </div>

      <FounderMessageModal
        isOpen={showFounderMessage}
        onClose={() => setShowFounderMessage(false)}
      />

      {/* ── Compose FAB ───────────────────────────────────────────────── */}
      {user?.id && (
        <>
          <button
            onClick={() => setComposerOpen(true)}
            aria-label="Share to Faith Feed"
            className="fixed bottom-24 right-4 z-[60] w-14 h-14 rounded-full bg-gradient-to-r from-gold-600 to-gold-500 text-navy-900 shadow-lg flex items-center justify-center hover:from-gold-500 hover:to-gold-400 transition-all focus:outline-none focus:ring-2 focus:ring-gold-500/60"
            style={{ bottom: "calc(5rem + env(safe-area-inset-bottom) + 1rem)" }}
          >
            <Pencil className="w-5 h-5" />
          </button>
          <PostComposer
            isOpen={composerOpen}
            onClose={() => setComposerOpen(false)}
            onPosted={() => setComposerOpen(false)}
            userId={user.id}
          />
        </>
      )}
    </main>
  );
}
