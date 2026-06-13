"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type Step = 1 | 2 | 3;

interface Answers {
  name: string;
  interests: string;
  weekend_style: string;
  social_energy: string;
  availability: string;
  preferred_group_size: string;
}

interface OnboardingResult {
  short_bio: string;
  long_bio: string;
  tags: string[];
  social_style: string;
  preferred_group_size: string;
  availability_summary: string;
}

export default function OnboardingProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [answers, setAnswers] = useState<Answers>({
    name: "",
    interests: "",
    weekend_style: "",
    social_energy: "",
    availability: "",
    preferred_group_size: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState<OnboardingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);

  // Pre-fill name from auth metadata (set during signup)
  useEffect(() => {
    const metaName = (user?.user_metadata?.name as string | undefined)?.trim() ?? "";
    if (metaName) {
      setAnswers((prev) => prev.name ? prev : { ...prev, name: metaName });
    }
  }, [user]);

  // Onboarding guard: redirect to dashboard if profile is already complete
  useEffect(() => {
    const checkProfileComplete = async () => {
      if (!user?.id) {
        setCheckingProfile(false);
        return;
      }

      try {
        const res = await fetch("/api/profile/get-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: user.id }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.profile?.profile_complete) {
            // Profile is already complete, redirect to dashboard
            router.replace("/dashboard");
            return;
          }
        }
      } catch (err) {
        // If check fails, allow onboarding to continue
        console.error("Error checking profile:", err);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkProfileComplete();
  }, [user?.id, router]);

  // Show loading while checking profile
  if (checkingProfile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-sm text-slate-400">Loading...</p>
        </div>
      </main>
    );
  }

  const updateAnswer = (field: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const canGoNext = () => {
    if (step === 1) {
      return answers.name.trim().length > 0 && answers.interests.trim().length > 0;
    }
    if (step === 2) {
      return (
        answers.weekend_style.trim().length > 0 &&
        answers.social_energy.trim().length > 0
      );
    }
    if (step === 3) {
      return (
        answers.availability.trim().length > 0 &&
        answers.preferred_group_size.trim().length > 0
      );
    }
    return false;
  };

  const handleNext = () => {
    if (!canGoNext()) return;
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev));
  };

  const handleBack = () => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    setOnboardingResult(null);

    try {
      const res = await fetch("/api/agents/OnboardingAssistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answers,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorMessage = data?.error || "Failed to contact the onboarding assistant";
        
        // Show user-friendly message for quota errors
        if (data?.code === "QUOTA_EXCEEDED" || errorMessage.includes("quota")) {
          throw new Error(
            "The AI service is temporarily unavailable due to usage limits. " +
            "Please try again later, or contact support if this persists."
          );
        }
        
        throw new Error(errorMessage);
      }

      const json = await res.json();
      const data = json.data as OnboardingResult;
      setOnboardingResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong with the onboarding assistant");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalAction = async () => {
    if (!onboardingResult) {
      setError("No onboarding result from assistant yet.");
      return;
    }

    if (!user) {
      setError("You must be logged in to save your profile.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/save-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          name: answers.name.trim(),
          answers,
          onboardingResult,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("Save profile error:", json);
        setError("Couldn't save your profile — please try again.");
        setIsSaving(false);
        return;
      }

      console.log("Saved profile:", json.profile);

      // Redirect to dashboard after successful save
      router.replace('/dashboard');
    } catch (err: any) {
      console.error("Save profile unexpected error:", err);
      setError("Couldn't save your profile — please try again.");
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-xl bg-slate-900 rounded-2xl p-6 md:p-8 shadow-lg border border-slate-800">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
            Gathered Onboarding
          </p>
          <h1 className="text-2xl font-semibold mb-1">Let&apos;s get to know you</h1>
          <p className="text-sm text-slate-400">
            Step {step} of 3
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 rounded-full h-2 mb-6 overflow-hidden">
          <div
            className="h-2 bg-emerald-400 transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Steps */}
        {step === 1 && (
          <section className="space-y-4">
            <h2 className="text-lg font-medium">Tell us about you</h2>
            <p className="text-sm text-slate-400">
              This is how you&apos;ll appear to others in the community.
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Display name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="What should we call you?"
                value={answers.name}
                onChange={(e) => updateAnswer("name", e.target.value)}
              />
              <p className="text-xs text-slate-500">Shown on your posts and profile</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                What are your main interests? <span className="text-red-400">*</span>
              </label>
              <textarea
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={3}
                placeholder="e.g. gym, anime, church, brunch, football, gaming..."
                value={answers.interests}
                onChange={(e) => updateAnswer("interests", e.target.value)}
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h2 className="text-lg font-medium">Your social vibe</h2>
            <p className="text-sm text-slate-400">
              Help us understand what kind of social energy you bring.
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                What does your ideal weekend look like?
              </label>
              <textarea
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={3}
                placeholder="e.g. gym in the morning, church on Sunday, anime or Netflix in the evening..."
                value={answers.weekend_style}
                onChange={(e) => updateAnswer("weekend_style", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                How would you describe your social energy?
              </label>
              <select
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={answers.social_energy}
                onChange={(e) => updateAnswer("social_energy", e.target.value)}
              >
                <option value="">Select one</option>
                <option value="introvert">Introvert</option>
                <option value="ambivert">Ambivert</option>
                <option value="extrovert">Extrovert</option>
                <option value="depends_on_vibes">Depends on the vibes</option>
              </select>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h2 className="text-lg font-medium">Timing & group size</h2>
            <p className="text-sm text-slate-400">
              When are you usually free and what kind of group size do you prefer?
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                When are you usually available?
              </label>
              <textarea
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={2}
                placeholder="e.g. weekday evenings after 6pm, Saturdays, Sunday afternoons..."
                value={answers.availability}
                onChange={(e) => updateAnswer("availability", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                What kind of group size do you prefer?
              </label>
              <select
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={answers.preferred_group_size}
                onChange={(e) =>
                  updateAnswer("preferred_group_size", e.target.value)
                }
              >
                <option value="">Select one</option>
                <option value="1-1">One-on-one</option>
                <option value="3-5">Small group (3–5)</option>
                <option value="6-10">Medium group (6–10)</option>
                <option value="10+">Bigger vibes (10+)</option>
                <option value="no_preference">No preference</option>
              </select>
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <p className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
            className="text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {step < 3 && (
            <button
              type="button"
              disabled={!canGoNext() || isSubmitting}
              onClick={handleNext}
              className="ml-auto text-sm px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              disabled={!canGoNext() || isSubmitting}
              onClick={handleSubmit}
              className="ml-auto text-sm px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Generating your profile..." : "Finish & Generate Profile"}
            </button>
          )}
        </div>

        {/* Generated profile result */}
        {onboardingResult && (
          <div className="mt-8 border-t border-slate-800 pt-6 space-y-3">
            <h2 className="text-lg font-semibold">Here&apos;s your Gathered profile</h2>
            <p className="text-sm text-slate-300">
              <span className="font-medium">Short bio:</span> {onboardingResult.short_bio}
            </p>
            <p className="text-sm text-slate-300">
              <span className="font-medium">Long bio:</span> {onboardingResult.long_bio}
            </p>
            <p className="text-sm text-slate-300">
              <span className="font-medium">Tags:</span> {onboardingResult.tags?.join(", ")}
            </p>
            <p className="text-sm text-slate-300">
              <span className="font-medium">Social style:</span> {onboardingResult.social_style}
            </p>
            <p className="text-sm text-slate-300">
              <span className="font-medium">Availability:</span> {onboardingResult.availability_summary}
            </p>

            <button
              type="button"
              onClick={handleFinalAction}
              disabled={isSaving}
              className="mt-3 w-full text-sm px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
            >
              {isSaving ? "Saving your profile..." : "Save & Continue to Dashboard"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

