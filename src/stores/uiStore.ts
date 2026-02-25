import { create } from 'zustand'

export type ViewMode = 'diagram' | 'grid'

interface UIState {
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void

  showLegend: boolean
  toggleLegend: () => void

  showPromptTemplates: boolean
  setShowPromptTemplates: (show: boolean) => void

  showVersionHistory: boolean
  setShowVersionHistory: (show: boolean) => void

  showGenerateDialog: boolean
  setShowGenerateDialog: (show: boolean) => void

  usageVersion: number
  bumpUsageVersion: () => void

  editorWidth: number
  setEditorWidth: (width: number) => void

  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id: string | null) => set({ selectedNodeId: id }),

  showLegend: false,
  toggleLegend: () => set((state) => ({ showLegend: !state.showLegend })),

  showPromptTemplates: false,
  setShowPromptTemplates: (show: boolean) => set({ showPromptTemplates: show }),

  showVersionHistory: false,
  setShowVersionHistory: (show: boolean) => set({ showVersionHistory: show }),

  showGenerateDialog: false,
  setShowGenerateDialog: (show: boolean) => set({ showGenerateDialog: show }),

  usageVersion: 0,
  bumpUsageVersion: () => set((state: UIState) => ({ usageVersion: state.usageVersion + 1 })),

  editorWidth: 300,
  setEditorWidth: (width: number) => set({ editorWidth: width }),

  viewMode: 'diagram',
  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === 'diagram' ? 'grid' : 'diagram',
    })),
}))

// ── Preserve store DATA across Vite HMR reloads ──
const HMR_UI_KEY = '__uiStore_hmr__'

interface UIHMRCache {
  selectedNodeId: string | null
  showLegend: boolean
  showPromptTemplates: boolean
  showVersionHistory: boolean
  showGenerateDialog: boolean
  editorWidth: number
  viewMode: ViewMode
}

interface UIHMRGlobal { [HMR_UI_KEY]?: UIHMRCache }
const _ug = globalThis as unknown as UIHMRGlobal

if (_ug[HMR_UI_KEY]) {
  useUIStore.setState(_ug[HMR_UI_KEY])
}

if (import.meta.hot) {
  useUIStore.subscribe((state: UIState) => {
    _ug[HMR_UI_KEY] = {
      selectedNodeId: state.selectedNodeId,
      showLegend: state.showLegend,
      showPromptTemplates: state.showPromptTemplates,
      showVersionHistory: state.showVersionHistory,
      showGenerateDialog: state.showGenerateDialog,
      editorWidth: state.editorWidth,
      viewMode: state.viewMode,
    }
  })
}
