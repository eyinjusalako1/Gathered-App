'use client'

import React, { useState } from 'react'
import { X, Mail, UserPlus, CheckCircle, Share2, Copy } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

interface MemberInviteModalProps {
  isOpen: boolean
  onClose: () => void
  fellowshipName: string
  fellowshipId?: string
  inviteUrl?: string
  onCreateInvite?: () => Promise<void>
  creatingInvite?: boolean
}

export default function MemberInviteModal({
  isOpen,
  onClose,
  fellowshipName,
  fellowshipId,
  inviteUrl,
  onCreateInvite,
  creatingInvite = false,
}: MemberInviteModalProps) {
  const [inviteMethod, setInviteMethod] = useState<'email' | 'link'>('email')
  const [emailInput, setEmailInput] = useState('')
  const [message, setMessage] = useState(`Join ${fellowshipName} on Gathered!`)
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const toast = useToast()

  const handleInvite = async () => {
    if (inviteMethod === 'email' && !emailInput.trim()) {
      return
    }

    setIsLoading(true)

    try {
      if (!fellowshipId) {
        throw new Error('Missing fellowship ID')
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Please log in to send invites')
      }

      const response = await fetch('/api/invites/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          email: emailInput.trim(),
          group_id: fellowshipId,
          message: message?.trim(),
        }),
      })

      if (response.status === 403) {
        toast({
          title: 'You need to join this group before inviting others.',
          variant: 'error',
        })
        return
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to send invite email')
      }

      setSent(true)
      toast({
        title: 'Invitation sent',
        description: `Sent to ${emailInput.trim()}`,
        variant: 'success',
      })

      setTimeout(() => {
        setSent(false)
        setEmailInput('')
        onClose()
      }, 2000)
    } catch (error: any) {
      console.error('Error sending invite email:', error)
      toast({
        title: 'Failed to send invite',
        description: error.message || 'Please try again',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast({
        title: 'Copied — paste anywhere',
        variant: 'success',
      })
    } catch (error) {
      console.error('Failed to copy invite link:', error)
      toast({
        title: 'Copy failed',
        description: 'Please try again',
        variant: 'error',
      })
    }
  }

  const handleShareInvite = async () => {
    if (!inviteUrl) return
    const shareText = `Join my group on Gathered: ${fellowshipName} 🙌`
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${fellowshipName} on Gathered`,
          text: shareText,
          url: inviteUrl,
        })
        return
      }
      await handleCopyLink()
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error sharing invite:', error)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0F1433] border border-[#D4AF37] rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md relative max-h-[85vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-[#F5C451] rounded-xl flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-[#0F1433]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Invite Members</h2>
            <p className="text-sm text-white/60">{fellowshipName}</p>
          </div>
        </div>
        <p className="text-sm text-white/70 mb-6">
          This link lets someone join {fellowshipName} instantly.
        </p>

        {sent ? (
          // Success state
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Invitation Sent!</h3>
            <p className="text-white/80">
              {inviteMethod === 'email' 
                ? `Invite sent to ${emailInput}` 
                : 'Link copied to clipboard'}
            </p>
          </div>
        ) : (
          <>
            {/* Invite Method Tabs */}
            <div className="flex bg-white/5 rounded-lg p-1 mb-6">
              <button
                onClick={() => setInviteMethod('email')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  inviteMethod === 'email'
                    ? 'bg-[#F5C451] text-[#0F1433]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4 inline-block mr-2" />
                Email
              </button>
              <button
                onClick={() => setInviteMethod('link')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  inviteMethod === 'link'
                    ? 'bg-[#F5C451] text-[#0F1433]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4 inline-block mr-2" />
                Link
              </button>
            </div>

            {/* Content based on method */}
            {inviteMethod === 'email' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451]"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Message (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Add a personal message..."
                    className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451] resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleInvite}
                  disabled={!emailInput.trim() || isLoading}
                  className="w-full bg-[#F5C451] text-[#0F1433] py-3 rounded-lg font-semibold hover:bg-[#D4AF37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0F1433]"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white">Invitation Link</label>
                  <input
                    type="text"
                    value={inviteUrl || 'No invite link yet'}
                    readOnly
                    className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg px-4 py-3 text-white text-sm"
                  />
                </div>

                {!inviteUrl ? (
                  <button
                    onClick={onCreateInvite}
                    disabled={creatingInvite || !onCreateInvite}
                    className="w-full bg-[#F5C451] text-[#0F1433] py-3 rounded-lg font-semibold hover:bg-[#D4AF37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {creatingInvite ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0F1433]"></div>
                        <span>Creating link...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Generate invite link</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleShareInvite}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#F5C451] text-[#0F1433] py-3 font-semibold hover:bg-[#D4AF37] transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share invite</span>
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#D4AF37]/50 text-white py-3 font-semibold hover:bg-white/10 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy link</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}





