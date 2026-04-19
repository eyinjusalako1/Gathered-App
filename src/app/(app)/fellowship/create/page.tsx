'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useToast } from '@/components/ui/Toast'
import { FellowshipService } from '@/lib/fellowship-service'
import TagChipSelector from '@/components/fellowship/TagChipSelector'
import {
  getNameSuggestionsForTags,
  getDescriptionStartersForTags,
  getTagByValue,
} from '@/lib/fellowship/focusTags'
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react'

type Visibility = 'open' | 'request' | 'invite'

const MAX_MEMBERS_OPTIONS = [
  { value: '', label: 'No limit' },
  { value: '12', label: '12 members' },
  { value: '25', label: '25 members' },
  { value: '50', label: '50 members' },
]

export default function CreateGroupPage() {
  const { user } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const { profile, isSteward, isLoading: profileLoading } = useUserProfile()

  // Redirect non-stewards
  useEffect(() => {
    if (!profileLoading && profile && !isSteward) {
      toast({ title: 'Access Restricted', description: 'Only Stewards can create groups.', variant: 'error', duration: 4000 })
      router.replace('/fellowship')
    }
  }, [profile, isSteward, profileLoading, router, toast])

  const [step, setStep] = useState(1)
  const [creating, setCreating] = useState(false)

  // Wizard state
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('open')
  const [maxMembers, setMaxMembers] = useState('')

  const nameSuggestions = getNameSuggestionsForTags(selectedTags)
  const descriptionStarters = getDescriptionStartersForTags(selectedTags)

  const canProceedStep1 = selectedTags.length > 0
  const canProceedStep2 = name.trim().length >= 3
  const canProceedStep3 = description.trim().length >= 10

  const handleCreate = async () => {
    if (!user) return
    setCreating(true)
    try {
      const group = await FellowshipService.createGroup({
        name: name.trim(),
        description: description.trim(),
        group_type: 'fellowship',
        is_private: visibility !== 'open',
        tags: selectedTags,
        max_members: maxMembers ? parseInt(maxMembers) : undefined,
        created_by: user.id,
        is_active: true,
      })
      toast({ title: 'Group created!', description: `${group.name} is ready.`, variant: 'success' })
      router.push(`/fellowship/${group.id}`)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create group', variant: 'error' })
      setCreating(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    )
  }

  const stepLabels = ['Focus', 'Name', 'Description', 'Review']

  return (
    <div className="min-h-screen bg-navy-900 text-slate-50">
      {/* Header */}
      <div className="bg-navy-800/50 border-b border-white/10 px-4 py-3 sticky z-10" style={{ top: 'env(safe-area-inset-top)' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => step === 1 ? router.push('/fellowship') : setStep(s => s - 1)}
            className="text-slate-400 hover:text-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-slate-50">Create a Fellowship Group</h1>
            <p className="text-xs text-slate-400">Step {step} of 4 — {stepLabels[step - 1]}</p>
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-gold-500' : 'bg-white/10'}`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── STEP 1: Focus Tags ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-50 mb-2">What is this group about?</h2>
              <p className="text-slate-400 text-sm">
                Pick one or more focus areas. These help people find your group and shape the suggestions you&apos;ll get.
              </p>
            </div>
            <TagChipSelector selected={selectedTags} onChange={setSelectedTags} maxSelections={4} />
            {selectedTags.length > 0 && (
              <p className="text-xs text-slate-500">{selectedTags.length} selected (max 4)</p>
            )}
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-900 px-6 py-3 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2: Name ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-50 mb-2">Give it a name</h2>
              <p className="text-slate-400 text-sm">Keep it short, clear, and welcoming.</p>
            </div>

            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                placeholder="Group name…"
                className="w-full bg-navy-800/60 border border-white/10 rounded-xl px-4 py-3 text-slate-50 text-base placeholder-slate-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-colors"
              />
              <p className="text-xs text-slate-500 mt-1 text-right">{name.length}/60</p>
            </div>

            {nameSuggestions.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-gold-500" /> Suggestions — tap to use
                </p>
                <div className="flex flex-wrap gap-2">
                  {nameSuggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setName(suggestion)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                        name === suggestion
                          ? 'bg-gold-500 text-navy-900 border-gold-500'
                          : 'bg-navy-800/60 text-slate-300 border-white/10 hover:border-gold-500/40 hover:text-slate-100'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-white/15 text-slate-300 px-6 py-3 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-900 px-6 py-3 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Description ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-50 mb-2">Describe the group</h2>
              <p className="text-slate-400 text-sm">Help people know what to expect when they join.</p>
            </div>

            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={400}
                autoFocus
                placeholder="What will people do together? Who is it for? What&apos;s the vibe?"
                className="w-full bg-navy-800/60 border border-white/10 rounded-xl px-4 py-3 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-colors resize-none"
              />
              <p className="text-xs text-slate-500 mt-1 text-right">{description.length}/400</p>
            </div>

            {descriptionStarters.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-gold-500" /> Starter sentences — tap to use, then edit
                </p>
                <div className="space-y-2">
                  {descriptionStarters.map(starter => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => setDescription(starter)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                        description === starter
                          ? 'border-gold-500/60 bg-gold-500/10 text-slate-100'
                          : 'border-white/10 bg-navy-800/40 text-slate-400 hover:border-gold-500/30 hover:text-slate-200'
                      }`}
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-white/15 text-slate-300 px-6 py-3 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!canProceedStep3}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-900 px-6 py-3 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Review ── */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-50 mb-2">Review & launch</h2>
              <p className="text-slate-400 text-sm">Set who can join, then create your group.</p>
            </div>

            {/* Review Card */}
            <div className="bg-navy-800/60 border border-white/10 rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Name</p>
                <p className="text-base font-semibold text-slate-50">{name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-slate-300">{description}</p>
              </div>
              {selectedTags.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Focus</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map(value => {
                      const tag = getTagByValue(value)
                      return tag ? (
                        <span key={value} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gold-500/10 border border-gold-500/30 rounded-full text-xs text-gold-400">
                          {tag.emoji} {tag.label}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              )}
              <button
                onClick={() => setStep(1)}
                className="text-xs text-gold-500 hover:text-gold-400 underline"
              >
                Edit details
              </button>
            </div>

            {/* Visibility */}
            <div>
              <p className="text-sm font-medium text-slate-200 mb-3">Who can join?</p>
              <div className="space-y-2">
                {([
                  { value: 'open', label: 'Open', description: 'Anyone can join instantly — the group is fully public.' },
                  { value: 'request', label: 'Request to Join', description: 'People can find the group but need your approval to join.' },
                  { value: 'invite', label: 'Invite Only', description: 'New members can only join via a shared invite link.' },
                ] as { value: Visibility; label: string; description: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      visibility === opt.value
                        ? 'border-gold-500/60 bg-gold-500/10'
                        : 'border-white/10 bg-navy-800/40 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        visibility === opt.value ? 'border-gold-500 bg-gold-500' : 'border-slate-500'
                      }`}>
                        {visibility === opt.value && <div className="w-1.5 h-1.5 bg-navy-900 rounded-full" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-50">{opt.label}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{opt.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Max Members */}
            <div>
              <p className="text-sm font-medium text-slate-200 mb-3">Member limit</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MAX_MEMBERS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMaxMembers(opt.value)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      maxMembers === opt.value
                        ? 'border-gold-500/60 bg-gold-500/10 text-gold-500'
                        : 'border-white/10 bg-navy-800/40 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl border border-white/15 text-slate-300 px-6 py-3 text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 text-navy-900 px-6 py-3 text-sm font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Creating…</span></>
                  : <><Check className="w-4 h-4" /><span>Create Group</span></>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
