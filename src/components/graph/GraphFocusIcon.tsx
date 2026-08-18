// Copyright (c) 2026 Deus Corp. Licensed under MIT.

/**
 * Icon for the Focus mode toggle, shared by GraphCanvas (2D) and
 * GraphCanvas3D so both surfaces show the same glyph. Active/inactive
 * styling (color, background, etc.) is handled by the surrounding
 * IconButton via `currentColor` -- this component owns only the shape.
 */
export function GraphFocusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 9V6a3 3 0 013-3h3M15 3h3a3 3 0 013 3v3M21 15v3a3 3 0 01-3 3h-3M9 21H6a3 3 0 01-3-3v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
