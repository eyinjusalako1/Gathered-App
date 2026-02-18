"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { FellowshipService } from "@/lib/fellowship-service";
import { FellowshipGroup } from "@/types";
import { supabase } from "@/lib/supabase";
import FounderMessageModal, {
  FOUNDER_MESSAGE_STORAGE_KEY,
} from "@/components/FounderMessageModal";
import {
  MapPin,
  Users,
  MessageCircle,
  Sparkles,
  BookOpen,
  Heart,
  Search,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string | null;
  bio: string | null;
  interests: string[] | null;
  availability: string[] | null;
  city?: string | null;
  avatar_url?: string | null;
  profile_complete?: boolean;
}

interface DiscoveredPerson {
  id: string;
  name: string | null;
  city: string | null;
  interests: string[] | null;
  avatar_url?: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<FellowshipGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [people, setPeople] = useState<DiscoveredPerson[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [showFounderMessage, setShowFounderMessage] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setError("You must be logged in to view your dashboard");
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/profile/get-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: user.id }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Failed to fetch profile");
        }

        setProfile(json.profile as UserProfile);
      } catch (err: any) {
        setError(err.message || "Something went wrong fetching your profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  // Load user's groups
  useEffect(() => {
    if (!user?.id) {
      setGroupsLoading(false);
      return;
    }

    const loadUserGroups = async () => {
      setGroupsLoading(true);
      try {
        const joinedGroups = await FellowshipService.getUserJoinedGroups(user.id);
        setUserGroups(joinedGroups);
      } catch (err: any) {
        console.error("Error loading user groups:", err);
        // Graceful fallback - show empty state
        setUserGroups([]);
      } finally {
        setGroupsLoading(false);
      }
    };

    loadUserGroups();
  }, [user?.id]);

  useEffect(() => {
    const loadPeople = async () => {
      if (!user) {
        setPeople([]);
        setPeopleLoading(false);
        return;
      }

      setPeopleLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch("/api/discover/people", {
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to load people");
        }

        const data = await response.json();
        setPeople(data.people || []);
      } catch (err) {
        console.error("Error loading people:", err);
        setPeople([]);
      } finally {
        setPeopleLoading(false);
      }
    };

    loadPeople();
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(FOUNDER_MESSAGE_STORAGE_KEY) === "true";
      if (!seen) {
        setShowFounderMessage(true);
      }
    } catch {
      // Ignore storage access issues
    }
  }, [loading, user]);


  const handleGoToDiscoverPeople = () => {
    router.push("/discover");
  };

  const handleBrowseGroups = () => {
    router.push("/fellowship");
  };

  const handleGoToChats = () => {
    router.push("/chat");
  };

  const getFirstName = () => {
    const displayName = profile?.name || user?.user_metadata?.name || "";
    if (!displayName) return "";
    return String(displayName).split(" ")[0];
  };

  const firstName = getFirstName();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const getProfileCompletion = () => {
    if (!profile) return 0;
    const checks = [
      !!profile.name,
      !!profile.bio,
      !!profile.city,
      (profile.interests?.length || 0) > 0,
      (profile.availability?.length || 0) > 0,
      !!profile.avatar_url,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  };

  const profileCompletion = getProfileCompletion();
  const showGoldRing = profileCompletion >= 80;
  const devotionStreak = 0;

  const formatRelativeTime = (dateString?: string | null) => {
    if (!dateString) return "Recently";
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const sharedInterests = (personInterests: string[] | null) => {
    if (!profile?.interests || !personInterests) return [];
    const set = new Set(profile.interests.map((i: string) => i.toLowerCase()));
    return personInterests.filter((interest) =>
      set.has(interest.toLowerCase())
    );
  };

  const todaySignal = (() => {
    const signals: Array<{
      message: string;
      cta: string;
      onClick: () => void;
    }> = [];

    if (people.length > 0) {
      const count = people.length;
      signals.push({
        message: `✨ ${count} ${count === 1 ? "person" : "people"} near you joined Gathered today`,
        cta: "Discover people",
        onClick: handleGoToDiscoverPeople,
      });
    }

    if (userGroups.length > 0) {
      const count = userGroups.length;
      signals.push({
        message: `🙏 Today’s devotion is being discussed in ${count} ${count === 1 ? "group" : "groups"}`,
        cta: "View group",
        onClick: () => router.push(`/fellowship/${userGroups[0].id}`),
      });
    }

    if (profile?.city) {
      signals.push({
        message: `👥 Explore groups near ${profile.city}`,
        cta: "Explore groups",
        onClick: handleBrowseGroups,
      });
    }

    signals.push({
      message: "🙏 Open today’s devotion",
      cta: "Open devotion",
      onClick: () => router.push("/devotions"),
    });

    const index = new Date().getDate() % signals.length;
    return signals[index];
  })();

  type SuggestedPerson = {
    id: string;
    name: string;
    city: string;
    interests: string[];
    reason: string;
    avatarUrl?: string | null;
  };

  const suggestedPeople: SuggestedPerson[] = people
    .slice(0, 3)
    .map((person: DiscoveredPerson) => {
    const personName = person.name || "New friend";
    const personCity = person.city || "Near you";
    const personInterests = person.interests || [];
    const overlap = sharedInterests(personInterests).slice(0, 2);
    const interests = overlap.length > 0 ? overlap : personInterests.slice(0, 2);
    const reason =
      overlap.length >= 2
        ? `You both value ${overlap[0]} and ${overlap[1]}`
        : overlap.length === 1
        ? `You both value ${overlap[0]}`
        : person.city
        ? `You both live near ${personCity}`
        : "Suggested based on your profile";

    return {
      id: person.id,
      name: personName,
      city: personCity,
      interests,
      reason,
      avatarUrl: person.avatar_url || null,
    };
    });

  type ConversationItem = {
    id: string;
    name: string;
    preview: string;
    time: string;
    unread: boolean;
  };

  // TODO: Replace with real chat data when available.
  const conversations: ConversationItem[] = userGroups
    .slice(0, 3)
    .map((group: FellowshipGroup, index: number) => ({
    id: group.id,
    name: group.name,
      preview: "Group member · Open to see the latest messages",
      time: formatRelativeTime(group.updated_at || group.created_at),
    unread: index === 0,
    }));

  return (
    <main className="min-h-screen bg-navy-900 text-slate-50 flex justify-center py-8 px-4">
      <div className="w-full max-w-5xl space-y-6">
        {/* Today on Gathered */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-900 via-navy-800 to-purple-900 border border-gold-600/20 hover:border-gold-500/40 shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-colors px-5 py-6 md:px-8 md:py-7">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-10 w-52 h-52 bg-gold-500/15 blur-3xl rounded-full" />
            <div className="absolute -bottom-20 -left-10 w-52 h-52 bg-indigo-500/15 blur-3xl rounded-full" />
          </div>

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center bg-navy-900/60 border border-white/10 ${
                  showGoldRing ? "ring-2 ring-gold-500/70 ring-offset-2 ring-offset-navy-900" : ""
                }`}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name || "Profile"}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-gold-500">
                    {getInitials(profile?.name || firstName || "U")}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-gold-500">
                  Today on Gathered
                </p>
                <h1 className="text-2xl md:text-3xl font-semibold">
                  {firstName ? `Hey, ${firstName} 👋` : "Welcome back 👋"}
                </h1>
                <p className="text-sm md:text-base text-slate-100/80">
                  Ready to show up today?
                </p>
                <p className="text-xs md:text-sm text-slate-300">
                  Your space to grow, connect, and walk with others.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleGoToDiscoverPeople}
                    className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-gold-600 transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Discover people & churches
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 md:mt-0 flex-shrink-0">
              <div className="rounded-2xl bg-navy-900/40 border border-gold-600/20 px-4 py-4 backdrop-blur-md min-w-[220px]">
                {groupsLoading ? (
                  <p className="text-xs text-slate-200/80">Loading today&apos;s update…</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gold-500">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-[11px] uppercase tracking-wide">
                        Today on Gathered
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-50">
                      {todaySignal.message}
                    </p>
                    <button
                      type="button"
                      onClick={todaySignal.onClick}
                      className="mt-2 inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-3 py-1.5 text-[11px] font-semibold hover:bg-gold-600 transition-colors"
                    >
                      {todaySignal.cta}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <p className="text-sm text-slate-200">Loading your dashboard...</p>
        )}

        {error && !loading && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Your conversations */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold">Your conversations</h2>
            <button
              type="button"
              onClick={handleGoToChats}
              className="text-xs text-gold-500 hover:text-gold-600"
            >
              Go to chats →
            </button>
          </div>
          <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-4">
            {groupsLoading ? (
              <p className="text-xs text-slate-400">Loading conversations…</p>
            ) : conversations.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm font-semibold text-slate-100">
                  Start a conversation.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Share a prayer or check in with your group.
                </p>
                <button
                  type="button"
                  onClick={handleBrowseGroups}
                  className="mt-3 inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
                >
                  Browse groups
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className="w-full text-left rounded-xl bg-navy-900/60 border border-white/10 px-4 py-3 hover:border-gold-500/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-500 font-semibold">
                        {getInitials(chat.name)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-100">{chat.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            {chat.unread && (
                              <span className="h-2 w-2 rounded-full bg-gold-500" />
                            )}
                            <span>{chat.time}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          {chat.preview}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Today's devotion */}
        <section className="space-y-4">
          <h2 className="text-base md:text-lg font-semibold">Today&apos;s Devotion</h2>
          <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-5 hover:border-gold-500/40 hover:shadow-[0_0_16px_rgba(245,196,81,0.2)] transition-all">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-gold-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Today&apos;s Devotion</p>
                <p className="text-sm text-slate-300 mt-2 line-clamp-2">
                  &quot;The Lord is my shepherd; I shall not want.&quot;
                </p>
                <p className="text-xs text-slate-400 mt-1">Psalm 23:1–6</p>
                <p className="text-xs text-slate-400 mt-2">
                  What stood out to you today?
                </p>
                {devotionStreak > 0 && (
                  <p className="text-xs text-gold-500 mt-2">🔥 {devotionStreak}-day streak</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/devotions")}
                className="rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
              >
                Read
              </button>
              <button
                type="button"
                onClick={() => router.push("/devotions")}
                className="rounded-full border border-gold-600/40 text-gold-500 px-4 py-2 text-xs font-semibold hover:bg-gold-500/10 transition-colors"
              >
                <Heart className="w-3 h-3 inline-block mr-1" />
                Reflect
              </button>
              <button
                type="button"
                onClick={handleGoToChats}
                disabled={userGroups.length === 0}
                className="rounded-full border border-white/15 text-slate-200 px-4 py-2 text-xs font-semibold hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Share to group
              </button>
            </div>
            {userGroups.length === 0 && (
              <p className="text-[11px] text-slate-500 mt-2">
                Join a group to share devotions with others.
              </p>
            )}
          </div>
        </section>

        {/* People you might like */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold">People you might like</h2>
            <button
              type="button"
              onClick={handleGoToDiscoverPeople}
              className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-100 hover:bg-gold-500/20"
            >
              <Search className="w-3.5 h-3.5" />
              Discover people & churches
            </button>
          </div>
          <div className="space-y-3">
            {peopleLoading ? (
              <p className="text-xs text-slate-400">Finding people near you…</p>
            ) : suggestedPeople.length === 0 ? (
              <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-4 text-center">
                <p className="text-sm text-slate-200">
                  We couldn&apos;t find matches yet.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Add interests to help us suggest the right people.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="mt-3 inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
                >
                  Update profile
                </button>
              </div>
            ) : (
              suggestedPeople.map((person) => (
                <div
                  key={person.id}
                  className="bg-navy-900/40 border border-white/10 rounded-2xl p-4 hover:border-gold-500/40 hover:shadow-[0_0_18px_rgba(245,196,81,0.2)] transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold-500/20 border border-gold-500/40 flex items-center justify-center text-gold-500 font-semibold overflow-hidden">
                      {person.avatarUrl ? (
                        <img
                          src={person.avatarUrl}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(person.name)
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{person.name}</p>
                          <p className="text-xs text-slate-400">{person.city}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleGoToDiscoverPeople}
                          className="rounded-full bg-gold-500 text-navy-900 px-3 py-1.5 text-[11px] font-semibold hover:bg-gold-600 transition-colors"
                        >
                          Connect
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {person.interests.map((interest: string) => (
                          <span
                            key={interest}
                            className="px-2 py-0.5 rounded-full bg-white/5 text-[11px] text-slate-200 border border-white/10"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{person.reason}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Your groups */}
        <section className="space-y-4 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold">Your groups</h2>
            <button
              type="button"
              onClick={handleBrowseGroups}
              className="text-xs text-gold-500 hover:text-gold-600"
            >
              See all groups →
            </button>
          </div>
          <div className="space-y-3">
            {groupsLoading ? (
              <p className="text-xs text-slate-400">Loading your groups…</p>
            ) : userGroups.length === 0 ? (
              <div className="bg-navy-900/40 border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-sm text-slate-300">
                  You haven&apos;t joined a group yet. This is where your people live.
                </p>
                <button
                  type="button"
                  onClick={handleBrowseGroups}
                  className="mt-3 inline-flex items-center rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-xs font-semibold hover:bg-gold-600 transition-colors"
                >
                  Explore groups
                </button>
              </div>
            ) : (
              userGroups.slice(0, 3).map((group: FellowshipGroup) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => router.push(`/fellowship/${group.id}`)}
                  className="w-full text-left bg-navy-900/40 border border-white/10 rounded-2xl p-4 hover:border-gold-500/30 hover:shadow-[0_0_12px_rgba(245,196,81,0.2)] transition-all"
                >
                  <p className="text-sm font-semibold text-slate-100">{group.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {group.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{group.location}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{group.member_count || 0} members</span>
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
      <FounderMessageModal
        isOpen={showFounderMessage}
        onClose={() => setShowFounderMessage(false)}
      />
    </main>
  );
}
