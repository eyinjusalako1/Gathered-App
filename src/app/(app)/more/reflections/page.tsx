'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/BackButton'
import { BookOpen, Calendar, MessageCircle } from 'lucide-react'

interface ReflectionEntry {
  date: string
  reflection: string
}

const STORAGE_KEY = 'devotions_reflections'

export default function ReflectionsPage() {
  const router = useRouter()
  const [reflections, setReflections] = useState<ReflectionEntry[]>([])

  useEffect(() => {
    loadReflections()
  }, [])

  const loadReflections = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const reflectionsObj = JSON.parse(saved) as Record<string, string>
        // Convert to array and sort by date (newest first)
        const entries: ReflectionEntry[] = Object.entries(reflectionsObj)
          .map(([date, reflection]) => ({ date, reflection }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setReflections(entries)
      }
    } catch (error) {
      console.error('Error loading reflections:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <div className="min-h-screen bg-navy-900 pb-20">
      <BackButton label="Saved Reflections" />
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        {reflections.length === 0 ? (
          <div className="rounded-2xl border border-gold-500/20 bg-navy-800/30 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6 text-gold-400" />
            </div>
            <p className="text-base font-semibold text-slate-100">No reflections saved yet</p>
            <p className="text-sm text-slate-400">
              Write and save reflections from your daily readings — they'll appear here.
            </p>
            <button
              onClick={() => router.push('/devotions')}
              className="inline-flex items-center gap-2 rounded-full bg-gold-500 text-navy-900 px-4 py-2 text-sm font-semibold hover:bg-gold-600 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Start today's devotion
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reflections.map((entry, index) => (
              <div
                key={index}
                className="bg-navy-800/30 border border-white/10 rounded-xl p-6 hover:border-gold-500/30 transition-colors"
              >
                <div className="flex items-center space-x-2 mb-3">
                  <MessageCircle className="w-5 h-5 text-gold-500" />
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(entry.date)}</span>
                  </div>
                </div>
                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {entry.reflection}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

