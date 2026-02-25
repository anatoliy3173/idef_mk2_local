import { create } from 'zustand'
import type { NodePositionMap } from '@/types/diagram'

export interface HistorySnapshot {
  xmlContent: string
  nodePositions: NodePositionMap
  timestamp: number
}

const MAX_HISTORY = 50

interface HistoryState {
  past: HistorySnapshot[]
  future: HistorySnapshot[]
  /** Whether an undo/redo operation is currently being applied (prevents feedback loops) */
  isApplying: boolean

  pushSnapshot: (snapshot: HistorySnapshot) => void
  undo: (currentState: HistorySnapshot) => HistorySnapshot | null
  redo: (currentState: HistorySnapshot) => HistorySnapshot | null
  clear: () => void
  setIsApplying: (v: boolean) => void
}

function snapshotsEqual(a: HistorySnapshot, b: HistorySnapshot): boolean {
  if (a.xmlContent !== b.xmlContent) return false
  const aKeys = Object.keys(a.nodePositions)
  const bKeys = Object.keys(b.nodePositions)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    const ap = a.nodePositions[key]
    const bp = b.nodePositions[key]
    if (!bp || ap.x !== bp.x || ap.y !== bp.y) return false
  }
  return true
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  isApplying: false,

  pushSnapshot: (snapshot: HistorySnapshot) => {
    const { past, isApplying } = get()
    if (isApplying) return // Don't push during undo/redo application

    // Deduplicate: skip if identical to top of past
    if (past.length > 0 && snapshotsEqual(past[past.length - 1], snapshot)) {
      return
    }

    const newPast = [...past, snapshot]
    // Cap at MAX_HISTORY
    if (newPast.length > MAX_HISTORY) {
      newPast.shift()
    }

    set({ past: newPast, future: [] }) // New action clears redo stack
  },

  undo: (currentState: HistorySnapshot) => {
    const { past, future } = get()
    if (past.length === 0) return null

    const previous = past[past.length - 1]
    const newPast = past.slice(0, -1)
    const newFuture = [...future, currentState]

    set({ past: newPast, future: newFuture })
    return previous
  },

  redo: (currentState: HistorySnapshot) => {
    const { past, future } = get()
    if (future.length === 0) return null

    const next = future[future.length - 1]
    const newFuture = future.slice(0, -1)
    const newPast = [...past, currentState]

    set({ past: newPast, future: newFuture })
    return next
  },

  clear: () => set({ past: [], future: [] }),

  setIsApplying: (v: boolean) => set({ isApplying: v }),
}))
