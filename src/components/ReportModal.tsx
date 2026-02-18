'use client'

import React, { useState } from 'react'
import { X, AlertTriangle, Flag } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  contentType: 'message' | 'testimony' | 'prayer' | 'comment' | 'user' | 'group' | 'event'
  contentId?: string | null
  reportedUserId?: string | null
  onSubmitted?: () => void
}

export default function ReportModal({
  isOpen,
  onClose,
  contentType,
  contentId,
  reportedUserId,
  onSubmitted,
}: ReportModalProps) {
  const toast = useToast()
  const [selectedReason, setSelectedReason] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const reasons = [
    'Inappropriate content',
    'Bullying or harassment',
    'Spam or irrelevant content',
    'False information',
    'Violence or threats',
    'Other'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReason) return

    setIsLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/safety/report', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId || null,
          reported_user_id: reportedUserId || null,
          reason: selectedReason,
          description,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to submit report')
      }

      toast({ title: 'Report submitted', variant: 'success' })
      setSelectedReason('')
      setDescription('')
      onSubmitted?.()
      onClose()
    } catch (error: any) {
      toast({ title: 'Failed to submit report', description: error.message, variant: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0F1433] border border-[#D4AF37] rounded-2xl p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Report Content</h2>
            <p className="text-sm text-white/60">Help us keep the community safe</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-3">Reason for reporting</label>
            <div className="space-y-2">
              {reasons.map(reason => (
                <label
                  key={reason}
                  className="flex items-center space-x-3 p-3 bg-white/5 border border-[#D4AF37]/30 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-[#F5C451] border-[#D4AF37] focus:ring-[#F5C451]"
                  />
                  <span className="text-white">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Additional details (optional)</label>
            <textarea
              rows={3}
              placeholder="Provide more context..."
              className="w-full bg-white/10 border border-[#D4AF37]/30 rounded-lg px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-[#F5C451] resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!selectedReason || isLoading}
            className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Flag className="w-4 h-4" />
                <span>Submit Report</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

