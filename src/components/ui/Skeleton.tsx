'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-white/[0.07]',
        className
      )}
    />
  )
}

export function SkeletonText({ className, width = 'full' }: SkeletonProps & { width?: 'full' | '3/4' | '1/2' | '1/3' | '1/4' | '2/3' }) {
  const widthMap = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '2/3': 'w-2/3',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4',
  }
  return <Skeleton className={cn('h-3 rounded-md', widthMap[width], className)} />
}

export function SkeletonAvatar({ size = 'md', className }: SkeletonProps & { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' }
  return <Skeleton className={cn('rounded-full shrink-0', sizeMap[size], className)} />
}

export function SkeletonCard({ className, children }: SkeletonProps & { children?: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-navy-900/40 p-4', className)}>
      {children}
    </div>
  )
}
