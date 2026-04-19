'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface BackButtonProps {
  fallbackHref?: string
  label?: string
  className?: string
}

export default function BackButton({ fallbackHref = '/dashboard', label }: BackButtonProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleBack = () => {
    // Check if there's history to go back to
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      // Fallback to dashboard if no history
      router.push(fallbackHref)
    }
  }

  return (
    <div className="sticky z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" style={{ top: 'env(safe-area-inset-top)' }}>
      <div className="max-w-md mx-auto px-4">
        <div className="flex items-center py-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {label && (
            <h1 className="ml-2 text-lg font-semibold text-gray-900 dark:text-white truncate">
              {label}
            </h1>
          )}
        </div>
      </div>
    </div>
  )
}




