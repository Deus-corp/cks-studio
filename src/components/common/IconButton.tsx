// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { ButtonHTMLAttributes, ReactNode } from 'react'

const SIZE_CLASSES = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
} as const

type IconButtonSize = keyof typeof SIZE_CLASSES

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  /** Icon element (typically an inline <svg>), hidden from a11y tree. */
  icon: ReactNode
  /** Accessible name -- always applied as aria-label, and as the
   *  tooltip text via `title` unless `title` is overridden below. */
  label: string
  /** Overrides the tooltip text shown on hover. Defaults to `label`.
   *  aria-label always stays `label` regardless. */
  title?: string
  /** Pressed/selected visual state for toggle buttons (aria-pressed). */
  active?: boolean
  size?: IconButtonSize
}

/**
 * Compact icon-only button with a tooltip and accessible name.
 *
 * Uses native `title` for the tooltip -- there's no custom tooltip
 * component in this codebase yet, and `title` is an acceptable
 * baseline (see cks-studio icon-button UI pass). `aria-label` is
 * always set independently so the accessible name never depends on
 * `title` alone.
 */
export function IconButton({
  icon,
  label,
  title,
  active,
  size = 'sm',
  className = '',
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      aria-pressed={active}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md border shadow-lg backdrop-blur-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 ${SIZE_CLASSES[size]} ${
        active
          ? 'bg-cyan-950/90 border-cyan-800 text-cyan-100'
          : 'bg-surface-1/95 border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-2 hover:border-border'
      } ${className}`}
      {...rest}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {icon}
      </span>
    </button>
  )
}
