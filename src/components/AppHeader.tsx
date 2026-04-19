'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import Logo from '@/components/Logo'
import { ArrowLeft, Search } from 'lucide-react'

interface AppHeaderProps {
  title: string
  subtitle?: string
  backHref?: string
  rightSlot?: React.ReactNode
}

export default function AppHeader({ title, subtitle, backHref, rightSlot }: AppHeaderProps) {
  const router = useRouter()
  const { theme } = useTheme()
  const handleBack = () => {
    if (backHref) router.push(backHref)
    else router.back()
  }

  return (
    <div className="bg-[#0F1433] dark:bg-navy-800 shadow-sm border-b border-[#D4AF37]/30 dark:border-gray-700 sticky z-40" style={{ top: 'env(safe-area-inset-top)' }}>
      <div className="max-w-md mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBack}
              className="p-2 text-white/60 hover:text-white transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Logo size="md" showText={false} />
            <div>
              <h1 className="text-xl font-bold text-white">{title}</h1>
              {subtitle && <p className="text-sm text-white/60">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {rightSlot}
            <button
              onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
              className="p-2 text-white/60 hover:text-white transition-colors"
              title="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


