'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { cacheProfile, getCachedProfile } from '@/lib/prefs'
import { ArrowLeft, Loader2, MessageCircle } from 'lucide-react'

type GrowthIntent =
  | 'I’m doing okay, but I want to grow'
  | 'I feel spiritually stuck'
  | 'I’m anxious / overwhelmed'
  | 'I’m coming back to faith'
  | 'I’m just exploring'

type GrowthFocus =
  | 'Peace'
  | 'Discipline'
  | 'Identity'
  | 'Purpose'
  | 'Relationships'
  | 'Understanding the Bible'

type ReflectionPreference =
  | 'Quiet time (just me + God)'
  | 'With community encouragement'
  | 'A mix of both'

type EngagementFrequency =
  | 'Daily (5–10 mins)'
  | 'A few times a week'
  | 'Occasionally'

type StepValue = GrowthIntent | GrowthFocus | ReflectionPreference | EngagementFrequency | string

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const toast = useToast()

  const [step, setStep] = useState(1)
  const [growthIntent, setGrowthIntent] = useState<GrowthIntent | ''>('')
  const [growthFocus, setGrowthFocus] = useState<GrowthFocus | ''>('')
  const [reflectionPreference, setReflectionPreference] = useState<ReflectionPreference | ''>('')
  const [engagementFrequency, setEngagementFrequency] = useState<EngagementFrequency | ''>('')
  const [firstName, setFirstName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showFinal, setShowFinal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login')
    }
  }, [authLoading, user, router])

  const steps = useMemo(
    () => [
      {
        prompt: 'Where are you at in your walk right now?',
        options: [
          'I’m doing okay, but I want to grow',
          'I feel spiritually stuck',
          'I’m anxious / overwhelmed',
          'I’m coming back to faith',
          'I’m just exploring',
        ] as GrowthIntent[],
      },
      {
        prompt: 'What do you want God to grow in you in this season?',
        options: [
          'Peace',
          'Discipline',
          'Identity',
          'Purpose',
          'Relationships',
          'Understanding the Bible',
        ] as GrowthFocus[],
      },
      {
        prompt: 'How would you like to grow?',
        options: [
          'Quiet time (just me + God)',
          'With community encouragement',
          'A mix of both',
        ] as ReflectionPreference[],
      },
      {
        prompt: 'What rhythm fits your real life right now?',
        options: [
          'Daily (5–10 mins)',
          'A few times a week',
          'Occasionally',
        ] as EngagementFrequency[],
      },
      {
        prompt: 'What should we call you?',
        options: [],
      },
    ],
    []
  )

  const updateProfile = async (partial: Record<string, any>) => {
    if (!user?.id) {
      toast({ title: 'You must be logged in to continue', variant: 'error' })
      return false
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ id: user.id, ...partial }, { onConflict: 'id' })

      if (error) {
        throw error
      }
      return true
    } catch (error: any) {
      toast({
        title: 'Something went wrong',
        description: error.message || 'Unable to save your response.',
        variant: 'error',
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async (value: StepValue) => {
    if (step === 1) {
      const nextValue = value as GrowthIntent
      setGrowthIntent(nextValue)
      const ok = await updateProfile({ growth_intent: nextValue })
      if (ok) setStep(2)
      return
    }
    if (step === 2) {
      const nextValue = value as GrowthFocus
      setGrowthFocus(nextValue)
      const ok = await updateProfile({ growth_focus: nextValue })
      if (ok) setStep(3)
      return
    }
    if (step === 3) {
      const nextValue = value as ReflectionPreference
      setReflectionPreference(nextValue)
      const ok = await updateProfile({ reflection_preference: nextValue })
      if (ok) setStep(4)
      return
    }
    if (step === 4) {
      const nextValue = value as EngagementFrequency
      setEngagementFrequency(nextValue)
      const ok = await updateProfile({ engagement_frequency: nextValue })
      if (ok) setStep(5)
      return
    }
  }

  const handleSubmitName = async () => {
    if (isSubmitting) return

    const name = firstName.trim()
    if (!name) {
      toast({ title: 'First name is required', variant: 'error' })
      return
    }

    if (!user?.id) {
      toast({ title: 'Session expired — please log in again.', variant: 'error' })
      return
    }

    setIsSubmitting(true)
    try {
      const ok = await updateProfile({
        first_name: name,
        onboarding_completed: true,
        onboarding_version: 2,
        growth_intent: growthIntent || null,
        growth_focus: growthFocus || null,
        reflection_preference: reflectionPreference || null,
        engagement_frequency: engagementFrequency || null,
      })

      if (!ok) return

      // IMPORTANT: verify against the SAME table you update
      const { data: verify, error: verifyError } = await supabase
        .from('user_profiles')
        .select('onboarding_completed,onboarding_version')
        .eq('id', user.id)
        .maybeSingle()

      const verifiedVersion = verify?.onboarding_version ?? 0
      if (verifyError || !verify || verify.onboarding_completed !== true || verifiedVersion < 2) {
        toast({ title: 'Save didn’t complete—please try again.', variant: 'error' })
        setIsSubmitting(false)
        return
      }

      const cachedProfile = getCachedProfile() || { id: user.id }
      cacheProfile({
        ...cachedProfile,
        id: user.id,
        growth_focus: growthFocus || null,
        onboarding_completed: true,
        onboarding_version: 2,
      })

      setShowFinal(true)
    } catch (error: any) {
      toast({ title: 'Save didn’t complete—please try again.', variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const goBack = () => {
    if (step === 1) return
    setStep((prev) => Math.max(1, prev - 1))
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-beige-50 dark:bg-navy-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  const selectedValue = useMemo(() => {
    if (step === 1) return growthIntent
    if (step === 2) return growthFocus
    if (step === 3) return reflectionPreference
    if (step === 4) return engagementFrequency
    return ''
  }, [step, growthIntent, growthFocus, reflectionPreference, engagementFrequency])

  return (
    <div className="min-h-screen bg-navy-900 text-white px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{`Step ${Math.min(step, 5)} of 5`}</span>
          {step > 1 && !showFinal && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 text-slate-300 hover:text-gold-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-slate-300">
            There&apos;s no pressure here. Just honesty. Let&apos;s understand where you are so we can walk with you.
          </p>
          <div className="h-1 w-full rounded-full bg-navy-800/70 overflow-hidden">
            <div
              className="h-full rounded-full bg-gold-500 transition-all duration-300"
              style={{ width: `${Math.min(step, 5) * 20}%` }}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-navy-800/70 to-navy-900/80 border border-white/10 rounded-2xl p-7 shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gold-500/15 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-gold-500" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-gold-300 mb-2">Gathered</p>
              <h1 className="text-lg font-semibold text-white">
                {showFinal ? `You’re in, ${firstName.trim()}` : steps[step - 1].prompt}
              </h1>
              {showFinal && (
                <p className="mt-2 text-sm text-slate-300">
                  We’ll start you with something that fits where you are.
                </p>
              )}
            </div>
          </div>
        </div>

        {!showFinal && step <= 4 && (
          <div className="space-y-3 animate-[fadeIn_0.3s_ease]">
            {steps[step - 1].options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={saving}
                onClick={() => handleNext(option)}
                className={`w-full rounded-2xl border px-4 py-5 text-left text-sm font-semibold transition-all duration-200 disabled:opacity-60 ${
                  selectedValue === option
                    ? 'border-gold-500 bg-gold-500/10 text-gold-100 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                    : 'border-gold-500/30 bg-navy-800/50 text-slate-100 hover:border-gold-500 hover:bg-navy-700/60 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_-15px_rgba(212,175,55,0.6)]'
                }`}
              >
                {option}
              </button>
            ))}
            {saving && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving your response...
              </div>
            )}
          </div>
        )}

        {!showFinal && step === 5 && (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease]">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="w-full rounded-2xl border border-white/10 bg-navy-800/60 px-4 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
            <button
              type="button"
              onClick={handleSubmitName}
              disabled={saving || isSubmitting}
              className="w-full rounded-2xl bg-gold-500 px-4 py-4 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors disabled:opacity-60"
            >
              {saving || isSubmitting ? 'Saving...' : 'Finish'}
            </button>
          </div>
        )}

        {showFinal && (
          <button
            type="button"
            onClick={() => router.replace('/welcome')}
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-gold-500 px-4 py-4 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors disabled:opacity-60"
          >
            Enter Gathered
          </button>
        )}
      </div>
    </div>
  )
}
