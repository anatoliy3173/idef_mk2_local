import { useEffect, useCallback, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { api } from '@/services/apiClient'
import { useDiagramStore } from '@/stores/diagramStore'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useHistoryStore } from '@/stores/historyStore'
import type { NodePositionMap } from '@/types/diagram'
import { XmlEditorPane } from './XmlEditorPane'
import { DiagramPane } from './DiagramPane'
import { PromptTemplates } from './PromptTemplates'
import { GenerateXmlDialog } from './GenerateXmlDialog'
import { UsageIndicator } from './UsageIndicator'
import { Button } from '@/components/ui/button'
import { generateThumbnail } from '@/services/thumbnailService'
import { createVersion } from '@/services/versionService'
import {
  ArrowLeft,
  Save,
  Loader2,
  LogOut,
  BookTemplate,
  Check,
  AlertCircle,
  Pencil,
} from 'lucide-react'

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    xmlContent,
    setXmlContent,
    parseAndBuild,
    currentDiagramId,
    setCurrentDiagramId,
    currentTitle,
    setCurrentTitle,
    setSavedNodePositions,
    resetDiagram,
    layoutMaxPerRow,
    setLayoutMaxPerRow,
  } = useDiagramStore()
  const { setShowPromptTemplates, showPromptTemplates, showGenerateDialog, editorWidth, setEditorWidth } = useUIStore()
  const { signOut } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const isDragging = useRef(false)
  // Track what was last persisted, using state so it can be safely read in render
  const [savedSnapshot, setSavedSnapshot] = useState<{ xml: string; title: string; layoutMaxPerRow: number }>({ xml: '', title: '', layoutMaxPerRow: 0 })
  // Mirror savedSnapshot as a ref so handleSave (stable callback) can read latest value
  const savedSnapshotRef = useRef<{ xml: string; title: string; layoutMaxPerRow: number }>({ xml: '', title: '', layoutMaxPerRow: 0 })
  const [loadReady, setLoadReady] = useState(false)
  // Guard against concurrent saves
  const saveInFlight = useRef(false)

  // Editable title state
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Load diagram on mount
  useEffect(() => {
    async function loadDiagram() {
      if (!id) {
        resetDiagram()
        setLoadReady(true)
        return
      }

      let data: Record<string, unknown>
      try {
        data = await api.diagrams.get(id) as unknown as Record<string, unknown>
      } catch {
        navigate('/')
        return
      }

      setCurrentDiagramId(data.id as string)
      setCurrentTitle(data.title as string)
      setXmlContent(data.xml_content as string)

      // Restore saved node positions and layout settings from DB
      const rawPositions = (data.node_positions ?? {}) as Record<string, unknown>
      const layoutMeta = rawPositions._layout as { maxPerRow?: number } | undefined
      const restoredMaxPerRow = layoutMeta?.maxPerRow ?? 0
      delete rawPositions._layout
      const positions = rawPositions as unknown as NodePositionMap
      setSavedNodePositions(positions)
      setLayoutMaxPerRow(restoredMaxPerRow)

      const loadedSnapshot = {
        xml: data.xml_content as string,
        title: data.title as string,
        layoutMaxPerRow: restoredMaxPerRow,
      }
      setSavedSnapshot(loadedSnapshot)
      savedSnapshotRef.current = loadedSnapshot

      if ((data.xml_content as string).trim()) {
        // Small delay to ensure editor is ready
        setTimeout(() => {
          parseAndBuild()
          setLoadReady(true)
        }, 100)
      } else {
        setLoadReady(true)
      }
    }

    loadDiagram()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save handler. silent=true for autosave (no UI flicker, no thumbnail).
  const handleSave = useCallback(async (silent = false) => {
    // Read the latest values from the store at call time (not from closure)
    const storeState = useDiagramStore.getState()
    const diagramId = storeState.currentDiagramId
    const title = storeState.currentTitle
    const xml = storeState.xmlContent
    const storeNodes = storeState.nodes

    if (!diagramId) return
    if (saveInFlight.current) return
    saveInFlight.current = true

    // Build node positions map from current nodes + layout settings
    const positionsMap: Record<string, unknown> = {}
    storeNodes.forEach((node: Node) => {
      positionsMap[node.id] = { x: node.position.x, y: node.position.y }
    })
    const currentMaxPerRow = storeState.layoutMaxPerRow
    if (currentMaxPerRow > 0) {
      positionsMap._layout = { maxPerRow: currentMaxPerRow }
    }

    // Only update UI state for manual (non-silent) saves
    if (!silent) {
      setSaving(true)
      setAutosaveStatus('saving')
      setSaveError(null)
    }

    try {
      // Include title unless: (silent autosave AND title is default).
      // This prevents store resets from overwriting DB, but ensures we persist
      // non-default titles on every save (not relying on titleDirty timing).
      const isDefaultTitle = title === 'Untitled Diagram'
      const shouldSaveTitle = !silent || !isDefaultTitle
      const updatePayload: Record<string, unknown> = {
        xml_content: xml,
        node_positions: positionsMap,
      }
      if (shouldSaveTitle) {
        updatePayload.title = title
      }

      try {
        await api.diagrams.update(diagramId, updatePayload)
      } catch (saveErr: unknown) {
        const errMsg = saveErr instanceof Error ? saveErr.message : 'Save failed'
        console.error('[Save] API error:', errMsg)
        if (!silent) {
          setSaveError(errMsg)
          setAutosaveStatus('error')
          setTimeout(() => {
            setAutosaveStatus('idle')
            setSaveError(null)
          }, 5000)
        }
        return
      }

      // Success — always update snapshot ref + state and last-saved time
      setLastSaved(new Date())

      // Clear titleDirty after successful save that included the title
      if (shouldSaveTitle) {
        useDiagramStore.getState().clearTitleDirty()
      }

      // Create version snapshot if XML actually changed (fire-and-forget)
      const previousXml = savedSnapshotRef.current.xml
      if (xml !== previousXml && xml.trim()) {
        createVersion(diagramId, xml, positionsMap as unknown as NodePositionMap).catch((err: unknown) => {
          console.error('[Version] Failed to create version:', err)
        })
      }

      const newSnapshot = { xml, title, layoutMaxPerRow: currentMaxPerRow }
      savedSnapshotRef.current = newSnapshot
      setSavedSnapshot(newSnapshot)

      if (!silent) {
        setAutosaveStatus('saved')
        setTimeout(() => setAutosaveStatus('idle'), 3000)
      }

      // Generate thumbnail only on manual save (toPng blocks the main thread)
      if (!silent && storeNodes.length > 0) {
        const isGridMode = useUIStore.getState().viewMode === 'grid'
        const selector = isGridMode ? '#grid-diagram-container' : '.react-flow__viewport'
        const thumbElement = document.querySelector(selector) as HTMLElement | null
        if (thumbElement) {
          generateThumbnail(thumbElement, storeNodes, { isGridMode }).then((thumb: string | null) => {
            if (thumb && diagramId) {
              api.diagrams.update(diagramId, { thumbnail: thumb }).catch(() => {})
            }
          }).catch(() => {})
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown save error'
      console.error('[Save] Exception:', message)
      if (!silent) {
        setSaveError(message)
        setAutosaveStatus('error')
        setTimeout(() => {
          setAutosaveStatus('idle')
          setSaveError(null)
        }, 5000)
      }
    } finally {
      if (!silent) {
        setSaving(false)
      }
      saveInFlight.current = false
    }
  }, []) // No reactive deps needed — reads from store/refs directly

  // Ctrl+S manual save + Ctrl+Z undo / Ctrl+Shift+Z redo
  const handleUndoRedo = useCallback(async (direction: 'undo' | 'redo') => {
    const store = useDiagramStore.getState()
    const historyStore = useHistoryStore.getState()
    const currentSnapshot = {
      xmlContent: store.xmlContent,
      nodePositions: {} as NodePositionMap,
      timestamp: Date.now(),
    }
    store.nodes.forEach((n: Node) => {
      currentSnapshot.nodePositions[n.id] = { x: n.position.x, y: n.position.y }
    })

    const snapshot = direction === 'undo'
      ? historyStore.undo(currentSnapshot)
      : historyStore.redo(currentSnapshot)

    if (!snapshot) return

    // Set flag to prevent parseAndBuild from pushing another snapshot
    useHistoryStore.getState().setIsApplying(true)
    try {
      store.setXmlContent(snapshot.xmlContent)
      store.setSavedNodePositions(snapshot.nodePositions)
      await store.parseAndBuild()
    } finally {
      useHistoryStore.getState().setIsApplying(false)
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // Undo: Ctrl+Z (without shift)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // Only intercept when focus is NOT inside the Monaco editor
        const active = document.activeElement
        const inMonaco = active?.closest('.monaco-editor')
        if (!inMonaco) {
          e.preventDefault()
          handleUndoRedo('undo')
        }
      }
      // Redo: Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        const active = document.activeElement
        const inMonaco = active?.closest('.monaco-editor')
        if (!inMonaco) {
          e.preventDefault()
          handleUndoRedo('redo')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleUndoRedo])

  // Clear history on mount and unmount
  useEffect(() => {
    useHistoryStore.getState().clear()
    return () => useHistoryStore.getState().clear()
  }, [])

  // Derive whether we have unsaved changes (all state-based, safe in render)
  const hasUnsavedChanges = loadReady &&
    Boolean(currentDiagramId) &&
    (xmlContent !== savedSnapshot.xml || currentTitle !== savedSnapshot.title || layoutMaxPerRow !== savedSnapshot.layoutMaxPerRow)

  // ── Debounced save-on-change: persist 2s after last XML or title edit ─────
  const debounceSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loadReady || !currentDiagramId) return
    // Skip if nothing changed (covers initial load where xml === savedSnapshot)
    if (xmlContent === savedSnapshotRef.current.xml && currentTitle === savedSnapshotRef.current.title && layoutMaxPerRow === savedSnapshotRef.current.layoutMaxPerRow) return

    if (debounceSaveTimer.current) clearTimeout(debounceSaveTimer.current)
    debounceSaveTimer.current = setTimeout(() => {
      handleSave(true)
    }, 2_000)

    return () => {
      if (debounceSaveTimer.current) clearTimeout(debounceSaveTimer.current)
    }
  }, [xmlContent, currentTitle, layoutMaxPerRow, loadReady, currentDiagramId, handleSave])

  // ── Save on tab hide / before unload ──────────────────────────────────────
  useEffect(() => {
    if (!currentDiagramId || !loadReady) return

    // Save when user switches to another tab
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        handleSave(true)
      }
    }

    // Last-resort save + warning when page is about to unload (Cmd+R, close tab)
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const store = useDiagramStore.getState()
      const xml = store.xmlContent
      const title = store.currentTitle
      const diagramId = store.currentDiagramId
      const maxPerRow = store.layoutMaxPerRow
      const isUnsaved = xml !== savedSnapshotRef.current.xml || title !== savedSnapshotRef.current.title || maxPerRow !== savedSnapshotRef.current.layoutMaxPerRow

      if (!isUnsaved || !diagramId) return

      // Fire a keepalive fetch so the save survives page teardown
      // Build positions from nodes
      const posMap: Record<string, { x: number; y: number }> = {}
      store.nodes.forEach((n: Node) => {
        posMap[n.id] = { x: n.position.x, y: n.position.y }
      })

      const authToken = localStorage.getItem('auth_token')
      if (authToken) {
        fetch(`/api/diagrams/${diagramId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            xml_content: xml,
            node_positions: maxPerRow > 0 ? { ...posMap, _layout: { maxPerRow } } : posMap,
            title,
          }),
          keepalive: true,
        }).catch(() => {})
      }

      // Show browser's native "unsaved changes" warning as fallback
      e.preventDefault()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [currentDiagramId, loadReady, handleSave])

  // ── Fallback autosave: 10-second interval ─────────────────────────────────
  useEffect(() => {
    if (!currentDiagramId || !loadReady) return

    const interval = setInterval(() => {
      handleSave(true)
    }, 10_000)

    return () => clearInterval(interval)
  }, [currentDiagramId, loadReady, handleSave])

  // Drag-to-resize handler
  const handleMouseDown = useCallback(() => {
    isDragging.current = true

    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current) return
      const newWidth = Math.max(220, Math.min(550, e.clientX))
      setEditorWidth(newWidth)
    }

    function handleMouseUp() {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [setEditorWidth])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  // Inline title editing handlers
  function startEditingTitle() {
    setTitleDraft(currentTitle)
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.select(), 0)
  }

  function commitTitle() {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== currentTitle) {
      setCurrentTitle(trimmed)
      useDiagramStore.getState().markTitleDirty()
    }
    setEditingTitle(false)
  }

  function cancelEditTitle() {
    setEditingTitle(false)
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commitTitle()
    } else if (e.key === 'Escape') {
      cancelEditTitle()
    }
  }

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#d97757] rounded flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">A</span>
              </div>
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleDraft}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={handleTitleKeyDown}
                  className="text-sm font-medium border border-primary/30 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary/50 max-w-[240px] bg-transparent"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={startEditingTitle}
                  className="group flex items-center gap-1.5 text-sm font-medium truncate max-w-[240px] hover:text-primary transition-colors cursor-text"
                  title="Click to rename"
                >
                  <span className="truncate">{currentTitle}</span>
                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPromptTemplates(true)}
            >
              <BookTemplate className="w-4 h-4 mr-1" />
              Prompts
            </Button>
            <UsageIndicator />
            <Button
              variant="default"
              size="sm"
              onClick={() => handleSave()}
              disabled={saving || !currentDiagramId}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 min-w-[100px]">
              {autosaveStatus === 'saving' && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </>
              )}
              {autosaveStatus === 'saved' && lastSaved && (
                <>
                  <Check className="w-3 h-3 text-green-500" />
                  <span className="text-green-600">Saved {lastSaved.toLocaleTimeString()}</span>
                </>
              )}
              {autosaveStatus === 'error' && (
                <>
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span className="text-red-500" title={saveError ?? undefined}>
                    Save failed
                  </span>
                </>
              )}
              {autosaveStatus === 'idle' && hasUnsavedChanges && (
                <span className="text-amber-500">Unsaved changes...</span>
              )}
              {autosaveStatus === 'idle' && !hasUnsavedChanges && lastSaved && (
                <span>Saved {lastSaved.toLocaleTimeString()}</span>
              )}
            </span>
            <div className="h-6 w-px bg-border" />
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex min-h-0">
          {/* XML Editor Pane */}
          <div style={{ width: editorWidth }} className="shrink-0">
            <XmlEditorPane />
          </div>

          {/* Resize Handle */}
          <div
            className="w-1 bg-border hover:bg-primary/30 cursor-col-resize transition-colors shrink-0"
            onMouseDown={handleMouseDown}
          />

          {/* Diagram Pane */}
          <div className="flex-1 min-w-0">
            <DiagramPane />
          </div>
        </div>
      </div>

      {/* Prompt Templates Dialog */}
      {showPromptTemplates && <PromptTemplates />}

      {/* AI Generate Dialog */}
      {showGenerateDialog && <GenerateXmlDialog />}
    </ReactFlowProvider>
  )
}
