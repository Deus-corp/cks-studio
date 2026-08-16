// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { create } from 'zustand'

/**
 * Tiny cross-component signal so something outside the Graph page's
 * side panel (the logo menu's "Save graph" item) can ask
 * PublishToGalleryButton to open its dialog, without lifting that
 * button's whole form state up into a shared store.
 *
 * `requestOpen()` flips `openRequested` true; PublishToGalleryButton
 * watches it, opens its own dialog, and immediately calls
 * `clearRequest()` so the flag doesn't linger and re-trigger on a
 * later remount (e.g. navigating away from and back to the Graph page).
 */
interface PublishDialogState {
  openRequested: boolean
  requestOpen: () => void
  clearRequest: () => void
}

export const usePublishDialogStore = create<PublishDialogState>((set) => ({
  openRequested: false,
  requestOpen: () => set({ openRequested: true }),
  clearRequest: () => set({ openRequested: false }),
}))
