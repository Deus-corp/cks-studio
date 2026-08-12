// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface DemoToastContextValue {
  showToast: (message: string) => void
}

const DemoToastContext = createContext<DemoToastContextValue | null>(null)

const TOAST_DURATION_MS = 2600

/**
 * Minimal toast for demo-only interactions (e.g. clicking a non-functional
 * Gallery card) -- the real studio has no toast component to reuse, and a
 * single fixed-position banner is enough for a handful of static demo
 * pages that just need to say "this part needs a live server" without a
 * full page-level placeholder.
 */
export function DemoToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((next: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setMessage(next)
    timeoutRef.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS)
  }, [])

  return (
    <DemoToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-surface-2 border border-border-strong text-text-primary text-xs px-3.5 py-2 rounded-full shadow-lg"
        >
          {message}
        </div>
      )}
    </DemoToastContext.Provider>
  )
}

export function useDemoToast(): DemoToastContextValue {
  const ctx = useContext(DemoToastContext)
  if (!ctx) {
    throw new Error('useDemoToast must be used within a DemoToastProvider')
  }
  return ctx
}
