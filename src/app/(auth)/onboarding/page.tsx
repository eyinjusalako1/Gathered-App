'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
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
        .update(partial)
        .eq('id', user.id)

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
    if (!firstName.trim()) {
      toast({ title: 'First name is required', variant: 'error' })
      return
    }
    const ok = await updateProfile({
      first_name: firstName.trim(),
      onboarding_completed: true,
      onboarding_version: 2,
    })
    if (ok) {
      setShowFinal(true)
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

        <div className="bg-navy-800/60 border border-white/10 rounded-2xl p-6 shadow-lg transition-all duration-300">
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
                className="w-full rounded-2xl border border-gold-500/30 bg-navy-800/50 px-4 py-4 text-left text-sm font-semibold text-slate-100 hover:border-gold-500 hover:bg-navy-700/60 transition-colors disabled:opacity-60"
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
              disabled={saving}
              className="w-full rounded-2xl bg-gold-500 px-4 py-4 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Finish'}
            </button>
          </div>
        )}

        {showFinal && (
          <button
            type="button"
            onClick={() => router.replace('/dashboard')}
            className="w-full rounded-2xl bg-gold-500 px-4 py-4 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors"
          >
            Enter Gathered
          </button>
        )}
      </div>
    </div>
  )
}
