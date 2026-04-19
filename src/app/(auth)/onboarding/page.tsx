'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { clearProfileCache } from '@/lib/prefs'
import { ArrowLeft, Camera, Loader2, MapPin, X } from 'lucide-react'

// ─── constants ───────────────────────────────────────────────────────────────

const LIFE_STAGES = [
  'Student',
  'Young Professional',
  'Parent',
  'Married',
  'Established',
  'Retired',
]

const GROWTH_FOCUSES = [
  { label: 'Faith', key: 'faith' },
  { label: 'Prayer', key: 'prayer' },
  { label: 'Peace', key: 'peace' },
  { label: 'Purpose', key: 'purpose' },
  { label: 'Healing', key: 'healing' },
  { label: 'Relationships', key: 'relationships' },
]

const REFLECTION_STYLES = [
  'Through reading',
  'Through journalling',
  'Through prayer',
  'Through community',
]

const ENGAGEMENT_FREQS = [
  'Daily',
  'A few times a week',
  'Weekly',
]

const CHURCH_BACKGROUNDS = [
  'Pentecostal / Charismatic',
  'Baptist',
  'Anglican / Traditional',
  'Non-denominational',
  'Catholic',
  'Still figuring it out',
  'Prefer not to say',
]

const INTENTIONS = [
  {
    value: 'accountability_partner',
    label: 'An accountability partner',
    description: 'Someone to check in with and grow alongside',
  },
  {
    value: 'fellowship_group',
    label: 'A fellowship group',
    description: 'A community to do life and faith with',
  },
  {
    value: 'mentor',
    label: 'A mentor',
    description: 'Someone further along in their walk to learn from',
  },
  {
    value: 'friendships',
    label: 'Friendships',
    description: 'Genuine connections with other believers',
  },
  {
    value: 'all',
    label: 'All of the above',
    description: "I'm open to everything Gathered has to offer",
  },
]

const ALL_INTENTION_VALUES = INTENTIONS.slice(0, 4).map((i) => i.value)

// ─── helpers ─────────────────────────────────────────────────────────────────

function RoleCard({
  title,
  subtitle,
  selected,
  onClick,
}: {
  title: string
  subtitle: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-5 py-5 text-left transition-all duration-200 ${
        selected
          ? 'border-gold-500 bg-gold-500/10 shadow-[0_0_24px_rgba(212,175,55,0.2)]'
          : 'border-white/10 bg-navy-800/50 hover:border-gold-500/50 hover:bg-navy-700/60'
      }`}
    >
      <p className={`text-base font-semibold ${selected ? 'text-gold-100' : 'text-slate-100'}`}>
        {title}
      </p>
      <p className={`mt-1 text-sm ${selected ? 'text-gold-300/80' : 'text-slate-400'}`}>
        {subtitle}
      </p>
    </button>
  )
}

function PillButton({
  label,
  selected,
  onClick,
  description,
}: {
  label: string
  selected: boolean
  onClick: () => void
  description?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
        selected
          ? 'border-gold-500 bg-gold-500/10 shadow-[0_0_18px_rgba(212,175,55,0.18)]'
          : 'border-white/10 bg-navy-800/50 hover:border-gold-500/50 hover:bg-navy-700/60'
      }`}
    >
      <p className={`text-sm font-semibold ${selected ? 'text-gold-100' : 'text-slate-100'}`}>
        {label}
      </p>
      {description && (
        <p className={`mt-0.5 text-xs ${selected ? 'text-gold-300/80' : 'text-slate-400'}`}>
          {description}
        </p>
      )}
    </button>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const toast = useToast()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Step 1 state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [bio, setBio] = useState('')
  const [lifeStage, setLifeStage] = useState('')
  const [city, setCity] = useState('')
  const [locating, setLocating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2 state
  const [growthFocus, setGrowthFocus] = useState('')
  const [reflectionStyle, setReflectionStyle] = useState('')
  const [engagementFreq, setEngagementFreq] = useState('')
  const [churchBackground, setChurchBackground] = useState('')

  // Step 3 state
  const [role, setRole] = useState<'disciple' | 'steward'>('disciple')
  const [intentions, setIntentions] = useState<string[]>([])

  // Pre-fill name from auth metadata
  useEffect(() => {
    if (!user) return
    const meta = user.user_metadata || {}
    const fullName: string = meta.full_name || meta.name || ''
    const first = fullName.trim().split(' ')[0]
    if (first) setFirstName(first)
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login')
    }
  }, [authLoading, user, router])

  // ─── avatar upload ──────────────────────────────────────────────────────────

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    setAvatarUploading(true)
    try {
      const buckets = ['Avatars', 'avatars', 'avatar']
      let uploadedUrl: string | null = null

      for (const bucket of buckets) {
        const filePath = `${bucket.toLowerCase()}/${user.id}/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath)
          uploadedUrl = publicUrl
          break
        }
      }

      if (uploadedUrl) {
        setAvatarUrl(uploadedUrl)
      } else {
        toast({ title: 'Could not upload photo — you can add one from your profile later.', variant: 'error' })
      }
    } catch {
      toast({ title: 'Photo upload failed — you can add one from your profile later.', variant: 'error' })
    } finally {
      setAvatarUploading(false)
    }
  }

  // ─── geolocation ───────────────────────────────────────────────────────────

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Geolocation is not supported by your browser.', variant: 'error' })
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'en' } }
          )
          if (!res.ok) throw new Error()
          const data = await res.json()
          const detected =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            ''
          if (detected) {
            setCity(detected)
          } else {
            toast({ title: "Couldn't detect your city — please type it in.", variant: 'error' })
          }
        } catch {
          toast({ title: "Couldn't detect your location — please type it in.", variant: 'error' })
        } finally {
          setLocating(false)
        }
      },
      () => {
        toast({ title: 'Location access denied — please type your city.', variant: 'error' })
        setLocating(false)
      },
      { timeout: 10000 }
    )
  }

  // ─── save helpers ──────────────────────────────────────────────────────────

  const upsert = async (partial: Record<string, unknown>) => {
    if (!user?.id) return false
    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ id: user.id, ...partial }, { onConflict: 'id' })
      if (error) throw error
      return true
    } catch (err: any) {
      toast({ title: err.message || 'Unable to save. Please try again.', variant: 'error' })
      return false
    } finally {
      setSaving(false)
    }
  }

  // ─── step navigation ───────────────────────────────────────────────────────

  const handleStep1Continue = async (skip = false) => {
    const name = firstName.trim()
    if (!name) {
      toast({ title: 'Your first name is needed to get started.', variant: 'error' })
      return
    }
    const payload: Record<string, unknown> = { name }
    // Always write email so name-fallback works in chat if name is ever cleared
    if (user?.email) payload.email = user.email
    if (!skip) {
      if (avatarUrl) payload.avatar_url = avatarUrl
      if (bio.trim()) payload.bio = bio.trim()
      if (lifeStage) payload.life_stage = lifeStage
      if (city.trim()) payload.city = city.trim()
    } else if (avatarUrl) {
      payload.avatar_url = avatarUrl
    }
    const ok = await upsert(payload)
    if (ok) setStep(2)
  }

  const handleStep2Continue = async (skip = false) => {
    const payload: Record<string, unknown> = {}
    if (!skip) {
      if (growthFocus) payload.growth_focus = growthFocus
      if (reflectionStyle) payload.reflection_preference = reflectionStyle
      if (engagementFreq) payload.engagement_frequency = engagementFreq
      if (churchBackground) payload.church_background = churchBackground
    }
    const ok = await upsert(payload)
    if (ok) setStep(3)
  }

  const handleStep3Finish = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        onboarding_completed: true,
        onboarding_version: 2,
        role: role,
      }
      if (intentions.length > 0) {
        payload.gathering_intentions = intentions.filter((v) => v !== 'all')
      }

      const { error: upsertError } = await supabase
        .from('user_profiles')
        .upsert({ id: user!.id, ...payload }, { onConflict: 'id' })

      if (upsertError) throw upsertError

      // Verify
      const { data: verify, error: verifyError } = await supabase
        .from('user_profiles')
        .select('onboarding_completed, onboarding_version')
        .eq('id', user!.id)
        .maybeSingle()

      if (verifyError || !verify || verify.onboarding_completed !== true || (verify.onboarding_version ?? 0) < 2) {
        toast({ title: "Save didn't complete — please try again.", variant: 'error' })
        return
      }

      clearProfileCache()
      router.replace('/welcome')
    } catch (err: any) {
      toast({ title: err.message || "Save didn't complete — please try again.", variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleIntention = (value: string) => {
    if (value === 'all') {
      setIntentions((prev) =>
        prev.includes('all') ? [] : ['all', ...ALL_INTENTION_VALUES]
      )
      return
    }
    setIntentions((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      // Auto-check "all" if all four individual options are selected
      const withoutAll = next.filter((v) => v !== 'all')
      if (withoutAll.length === ALL_INTENTION_VALUES.length) {
        return ['all', ...ALL_INTENTION_VALUES]
      }
      return next.filter((v) => v !== 'all')
    })
  }

  // ─── render ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    )
  }

  const progressPct = (step / 3) * 100

  return (
    <div className="min-h-screen bg-navy-900 text-white px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Step {step} of 3</span>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev > 1 ? (prev - 1) as 1 | 2 | 3 : prev))}
                className="inline-flex items-center gap-1 text-slate-300 hover:text-gold-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-navy-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gold-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* ── STEP 1 ─────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
            <div className="bg-gradient-to-br from-navy-800/70 to-navy-900/80 border border-white/10 rounded-2xl p-6 shadow-[0_0_30px_rgba(212,175,55,0.12)]">
              <p className="text-xs uppercase tracking-wide text-gold-400 mb-1">Gathered</p>
              <h1 className="text-xl font-semibold text-white">Let&apos;s start with you.</h1>
              <p className="mt-1 text-sm text-slate-400">
                This is your space. Tell us a little about yourself — we&apos;ll use it to connect you with people who get it.
              </p>
            </div>

            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="relative w-20 h-20 rounded-full border-2 border-dashed border-gold-500/40 bg-navy-800/60 flex items-center justify-center hover:border-gold-500/70 transition-colors overflow-hidden"
              >
                {avatarUploading ? (
                  <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-gold-400" />
                )}
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Remove photo
                </button>
              ) : (
                <span className="text-xs text-slate-500">Add a profile photo (optional)</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* First name — required */}
            <div className="space-y-1.5">
              <label className="text-sm text-slate-300 font-medium">
                What should we call you? <span className="text-gold-500">*</span>
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                required
                className="w-full rounded-2xl border border-white/10 bg-navy-800/60 px-4 py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500/60"
              />
            </div>

            {/* Faith bio */}
            <div className="space-y-1.5">
              <label className="text-sm text-slate-300 font-medium">
                A little about your walk with God{' '}
                <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 280))}
                rows={3}
                placeholder="Share a little about your walk with God — keep it real, keep it you"
                className="w-full rounded-2xl border border-white/10 bg-navy-800/60 px-4 py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500/60 resize-none"
              />
              <p className="text-right text-[11px] text-slate-500">{bio.length} / 280</p>
            </div>

            {/* Life stage */}
            <div className="space-y-2">
              <p className="text-sm text-slate-300 font-medium">
                Where are you in life right now?{' '}
                <span className="text-slate-500 font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {LIFE_STAGES.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setLifeStage((prev) => (prev === stage ? '' : stage))}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      lifeStage === stage
                        ? 'border-gold-500 bg-gold-500/10 text-gold-100'
                        : 'border-white/10 bg-navy-800/50 text-slate-300 hover:border-gold-500/40'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300 font-medium">
                  Where are you based?{' '}
                  <span className="text-slate-500 font-normal">(optional)</span>
                </label>
              </div>
              <p className="text-xs text-slate-500">Helps us find your local community</p>
              <div className="flex gap-2">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. London, Manchester..."
                  className="flex-1 rounded-2xl border border-white/10 bg-navy-800/60 px-4 py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-500/60"
                />
                <button
                  type="button"
                  onClick={handleUseLocation}
                  disabled={locating}
                  className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-navy-800/60 px-4 py-3.5 text-sm text-slate-300 hover:border-gold-500/40 hover:text-gold-300 transition-colors disabled:opacity-50 shrink-0"
                  aria-label="Use my location"
                >
                  {locating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span className="text-xs font-medium">
                    {locating ? 'Locating...' : 'Use location'}
                  </span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleStep1Continue(false)}
                disabled={saving}
                className="w-full rounded-2xl bg-gold-500 py-4 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Continue →
              </button>
              <button
                type="button"
                onClick={() => handleStep1Continue(true)}
                disabled={saving}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip optional fields
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ─────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
            <div className="bg-gradient-to-br from-navy-800/70 to-navy-900/80 border border-white/10 rounded-2xl p-6 shadow-[0_0_30px_rgba(212,175,55,0.12)]">
              <p className="text-xs uppercase tracking-wide text-gold-400 mb-1">Gathered</p>
              <h1 className="text-xl font-semibold text-white">Your spiritual setup.</h1>
              <p className="mt-1 text-sm text-slate-400">
                This shapes your daily word and how we walk with you. You can always change it later.
              </p>
            </div>

            {/* Growth focus */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">
                What&apos;s the main area you&apos;re growing in right now?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {GROWTH_FOCUSES.map(({ label, key }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGrowthFocus((prev) => (prev === key ? '' : key))}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                      growthFocus === key
                        ? 'border-gold-500 bg-gold-500/10 text-gold-100'
                        : 'border-white/10 bg-navy-800/50 text-slate-300 hover:border-gold-500/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reflection style */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">
                How do you best connect with God?
              </p>
              <div className="space-y-2">
                {REFLECTION_STYLES.map((style) => (
                  <PillButton
                    key={style}
                    label={style}
                    selected={reflectionStyle === style}
                    onClick={() => setReflectionStyle((prev) => (prev === style ? '' : style))}
                  />
                ))}
              </div>
            </div>

            {/* Engagement frequency */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">
                How often do you want to show up on Gathered?
              </p>
              <div className="space-y-2">
                {ENGAGEMENT_FREQS.map((freq) => (
                  <PillButton
                    key={freq}
                    label={freq}
                    selected={engagementFreq === freq}
                    onClick={() => setEngagementFreq((prev) => (prev === freq ? '' : freq))}
                  />
                ))}
              </div>
            </div>

            {/* Church background */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">
                What&apos;s your church background?{' '}
                <span className="text-slate-500 font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CHURCH_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setChurchBackground((prev) => (prev === bg ? '' : bg))}
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold text-left transition-all duration-200 ${
                      churchBackground === bg
                        ? 'border-gold-500 bg-gold-500/10 text-gold-100'
                        : 'border-white/10 bg-navy-800/50 text-slate-300 hover:border-gold-500/40'
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleStep2Continue(false)}
                disabled={saving}
                className="w-full rounded-2xl bg-gold-500 py-4 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Continue →
              </button>
              <button
                type="button"
                onClick={() => handleStep2Continue(true)}
                disabled={saving}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ─────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
            <div className="bg-gradient-to-br from-navy-800/70 to-navy-900/80 border border-white/10 rounded-2xl p-6 shadow-[0_0_30px_rgba(212,175,55,0.12)]">
              <p className="text-xs uppercase tracking-wide text-gold-400 mb-1">Gathered</p>
              <h1 className="text-xl font-semibold text-white">Your intention.</h1>
              <p className="mt-1 text-sm text-slate-400">
                Tell us how you&apos;re joining — this shapes everything from your home screen to who we connect you with.
              </p>
            </div>

            {/* Role selection — required */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">How are you joining Gathered?</p>
              <div className="space-y-3">
                <RoleCard
                  title="I'm here to grow"
                  subtitle="Join groups, do devotions, and connect with fellow believers"
                  selected={role === 'disciple'}
                  onClick={() => setRole('disciple')}
                />
                <RoleCard
                  title="I want to lead a group"
                  subtitle="Create and lead a fellowship group in your community"
                  selected={role === 'steward'}
                  onClick={() => setRole('steward')}
                />
              </div>
            </div>

            {/* Intentions — optional */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">
                What are you hoping to find here?{' '}
                <span className="text-slate-500 font-normal">(optional)</span>
              </p>
              <div className="space-y-2">
                {INTENTIONS.map((intention) => (
                  <PillButton
                    key={intention.value}
                    label={intention.label}
                    description={intention.description}
                    selected={intentions.includes(intention.value)}
                    onClick={() => toggleIntention(intention.value)}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleStep3Finish()}
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-gold-500 py-4 text-sm font-semibold text-navy-900 hover:bg-gold-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Enter Gathered →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
