"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUserProfile } from "@/hooks/useUserProfile";
import { FellowshipService } from "@/lib/fellowship-service";
import { FellowshipGroup } from "@/types";
import { supabase } from "@/lib/supabase";
import { getDailyWord } from "@/lib/dailyWord";
import FounderMessageModal, {
  FOUNDER_MESSAGE_STORAGE_KEY,
} from "@/components/FounderMessageModal";
import NotificationPrompt from "@/components/NotificationPrompt";
import AddToHomeScreenPrompt from "@/components/AddToHomeScreenPrompt";
import ActivityFeed from "@/components/ActivityFeed";
import FaithFeed from "@/components/feed/FaithFeed";
import PostComposer from "@/components/feed/PostComposer";
import { Pencil } from "lucide-react";
import {
  BookOpen,
  MapPin,
  Users,
  Search,
  CheckCircle,
  Crown,
  CalendarPlus,
  ArrowRight,
  Settings,
  X,
  UserCheck,
  XCircle,
  Loader2,
} from "lucide-react"
import { Skeleton, SkeletonText, SkeletonAvatar } from "@/components/ui/Skeleton";

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

const formatRelativeTime = (dateString?: string | null) => {
  if (!dateString) return "Recently";
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

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
  why_suggested?: string | null;
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, isSteward, isLoading: profileLoading } = useUserProfile();

  const dailyWord = useMemo(
    () => getDailyWord(profile?.growth_focus),
    [profile?.growth_focus]
  );

  // Devotion state from localStorage
  const [devotionStreak, setDevotionStreak] = useState(0);
  const [devotionComplete, setDevotionComplete] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const streak = parseInt(localStorage.getItem("devotions_streak") || "0", 10);
    const completedKey = `gathered_devotion_completed_${getCompletionDateKey()}`;
    const completed = localStorage.getItem(completedKey) === "true";
    setDevotionStreak(isNaN(streak) ? 0 : streak);
    setDevotionComplete(completed);
  }, []);

  // Groups
  const [userGroups, setUserGroups] = useState<FellowshipGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setGroupsLoading(false); return; }
    FellowshipService.getUserJoinedGroups(user.id)
      .then(setUserGroups)
      .catch(() => setUserGroups([]))
      .finally(() => setGroupsLoading(false));
  }, [user?.id]);

  // People
  const [people, setPeople] = useState<DiscoveredPerson[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);

  useEffect(() => {
    if (!user) { setPeople([]); setPeopleLoading(false); return; }
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
      } finally {
        setPeopleLoading(false);
      }
    })();
  }, [user]);

  // Incoming connection requests (drives the badge count + inline card)
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

  const pendingFriendCount = incomingRequests.length;

  const handleConnectionRespond = async (connectionId: string, action: "accept" | "reject") => {
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

  // Compose FAB
  const [composerOpen, setComposerOpen] = useState(false);

  // Beta welcome banner
  const [showBetaWelcome, setShowBetaWelcome] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowBetaWelcome(localStorage.getItem("gathered_beta_welcome_dismissed") !== "true");
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
      !!profile.name, !!profile.bio, !!profile.city,
      (profile.interests?.length || 0) > 0,
      (profile.availability?.length || 0) > 0,
      !!profile.avatar_url,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  const suggestedPeople = useMemo(() => {
    const userInterestSet = new Set(
      (profile?.interests || []).map((i: string) => i.toLowerCase())
    );
    return people.slice(0, 3).map((p) => {
      const interests = p.interests || [];
      const shared = interests.filter((i) => userInterestSet.has(i.toLowerCase()));
      return { ...p, displayInterests: (shared.length > 0 ? shared : interests).slice(0, 2) };
    });
  }, [people, profile?.interests]);

  const conversations = useMemo(
    () =>
      userGroups.slice(0, 3).map((g, i) => ({
        id: g.id,
        name: g.name,
        preview: "Tap to open group chat",
        time: formatRelativeTime(g.updated_at || g.created_at),
        unread: i === 0,
      })),
    [userGroups]
  );

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
                  {pendingFriendCount > 9 ? '9+' : pendingFriendCount}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Today on Gathered</p>
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

        {/* ── Faith Feed ────────────────────────────────────────────────── */}
        {user?.id && (
          <FaithFeed userId={user.id} />
        )}

        {/* ── Beta welcome banner ───────────────────────────────────────── */}
        {showBetaWelcome && (
          <section className="rounded-2xl border border-gold-500/30 bg-navy-800/80 p-4 relative">
            <button
              onClick={handleDismissBetaWelcome}
              className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-white mb-2 pr-6">Welcome to the Gathered beta 👋</p>
            <ul className="space-y-1.5 mb-3">
              <li className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-gold-400 mt-0.5 shrink-0">•</span>
                Start with today&apos;s Word — read, reflect, and mark it complete to build your streak
              </li>
              <li className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-gold-400 mt-0.5 shrink-0">•</span>
                Use Discover to find believers in your city and send connection requests
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

        {/* ── Notification + PWA prompts (shown after beta card dismissed) ── */}
        {!showBetaWelcome && <NotificationPrompt />}
        {!showBetaWelcome && <AddToHomeScreenPrompt />}

        {/* ── Incoming connection requests ──────────────────────────────── */}
        {incomingRequests.length > 0 && (
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

        {/* ── Activity feed ─────────────────────────────────────────────── */}
        {user?.id && userGroups.length > 0 && (
          <ActivityFeed
            userId={user.id}
            groupIds={userGroups.map((g) => g.id)}
          />
        )}

        {/* ── Devotion hero ─────────────────────────────────────────────── */}
        <section
          className="rounded-3xl border border-gold-600/30 bg-gradient-to-br from-navy-800/80 to-navy-900/80 p-5 md:p-7 hover:border-gold-500/50 hover:shadow-[0_0_28px_rgba(212,175,55,0.15)] transition-all cursor-pointer"
          onClick={() => router.push("/devotions")}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gold-400 uppercase tracking-wide">
                  Today&apos;s Word for You
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{dailyWord.reference}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {devotionStreak > 0 && (
                <span className="rounded-full bg-gold-500/15 border border-gold-500/30 px-2.5 py-1 text-[11px] font-semibold text-gold-300">
                  🔥 {devotionStreak}-day streak
                </span>
              )}
              <span className="rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-1 text-[11px] font-semibold text-gold-200">
                {dailyWord.focusLabel}
              </span>
            </div>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            {dailyWord.title}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed line-clamp-2 mb-3">
            {dailyWord.text}
          </p>
          <p className="text-xs text-slate-400 italic mb-5">
            {dailyWord.reflectionPrompt}
          </p>

          {devotionComplete ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-gold-500/15 border border-gold-500/30 px-4 py-2 text-sm font-semibold text-gold-300">
              <CheckCircle className="w-4 h-4" />
              Completed today
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); router.push("/devotions"); }}
              className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors"
            >
              Open today&apos;s devotion
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </section>

        {/* ── Conversations ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Your conversations</h2>
            <button
              onClick={() => router.push("/chat")}
              className="text-xs text-gold-500 hover:text-gold-400"
            >
              Go to chats →
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-navy-900/40 p-4">
            {groupsLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-navy-900/60 px-4 py-3 flex items-center gap-3">
                    <SkeletonAvatar size="sm" />
                    <div className="flex-1 space-y-1.5">
                      <SkeletonText width="1/2" />
                      <SkeletonText width="2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-slate-300">
                  Share a prayer or check in with your group.
                </p>
                <button
                  onClick={() => router.push("/fellowship")}
                  className="inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
                >
                  Browse groups
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className="w-full text-left rounded-xl border border-white/10 bg-navy-900/60 px-4 py-3 hover:border-gold-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-500 text-xs font-semibold shrink-0">
                        {getInitials(chat.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100 truncate">
                            {chat.name}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {chat.unread && (
                              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                            )}
                            <span className="text-[11px] text-slate-400">{chat.time}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{chat.preview}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── People you might like ─────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">People you might like</h2>
            <button
              onClick={() => router.push("/discover")}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-200 hover:bg-gold-500/20 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Discover
            </button>
          </div>
          {peopleLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-navy-900/40 p-4">
                  <div className="flex items-start gap-3">
                    <SkeletonAvatar size="md" />
                    <div className="flex-1 space-y-2">
                      <SkeletonText width="1/3" />
                      <SkeletonText width="1/4" />
                      <div className="flex gap-1.5 mt-1">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : suggestedPeople.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-navy-900/40 p-4 text-center space-y-3">
              <p className="text-sm text-slate-300">
                Add interests to find people who share your faith journey.
              </p>
              <button
                onClick={() => router.push("/profile")}
                className="inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
              >
                Update profile
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestedPeople.map((person) => (
                <div
                  key={person.id}
                  className="rounded-2xl border border-white/10 bg-navy-900/40 p-4 hover:border-gold-500/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-500 text-sm font-semibold shrink-0 overflow-hidden">
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={person.name || "Person"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(person.name || "?")
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">
                            {person.name || "New friend"}
                          </p>
                          {person.city && (
                            <p className="text-xs text-slate-400">{person.city}</p>
                          )}
                        </div>
                        <button
                          onClick={() => router.push("/discover")}
                          className="rounded-full bg-gold-500 text-navy-900 px-3 py-1 text-[11px] font-semibold hover:bg-gold-600 transition-colors shrink-0"
                        >
                          Connect
                        </button>
                      </div>
                      {person.displayInterests.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {person.displayInterests.map((interest) => (
                            <span
                              key={interest}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                      {person.why_suggested && (
                        <p className="text-xs text-slate-400 mt-1.5">{person.why_suggested}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Your groups ───────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Your groups</h2>
            <button
              onClick={() => router.push("/fellowship")}
              className="text-xs text-gold-500 hover:text-gold-400"
            >
              See all →
            </button>
          </div>
          {groupsLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-navy-900/40 p-4">
                  <SkeletonText width="1/2" className="mb-2" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : userGroups.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-navy-900/40 p-5 text-center space-y-3">
              <p className="text-sm text-slate-300">
                This is where your people live. Join a group to get started.
              </p>
              <button
                onClick={() => router.push("/fellowship")}
                className="inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
              >
                Explore groups
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {userGroups.slice(0, 3).map((group) => (
                <button
                  key={group.id}
                  onClick={() => router.push(`/fellowship/${group.id}`)}
                  className="w-full text-left rounded-2xl border border-white/10 bg-navy-900/40 p-4 hover:border-gold-500/30 transition-colors"
                >
                  <p className="text-sm font-semibold text-slate-100">{group.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {group.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {group.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {group.member_count || 0} members
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Steward section ───────────────────────────────────────────── */}
        {isSteward && (
          <section className="rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/10 to-navy-800/40 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">You&apos;re leading a group</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage members, approve requests, and grow your community.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push("/fellowship")}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
              >
                Manage groups
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => router.push("/events/create")}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 text-gold-300 px-4 py-2 text-xs font-semibold hover:bg-gold-500/10 transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Create event
              </button>
            </div>
          </section>
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
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom) + 1rem)' }}
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
