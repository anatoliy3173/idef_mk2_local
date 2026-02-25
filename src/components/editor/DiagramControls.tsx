import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useDiagramStore } from '@/stores/diagramStore'
import { useUIStore } from '@/stores/uiStore'
import { useHistoryStore } from '@/stores/historyStore'
import { exportToPNG, exportToSVG } from '@/services/exportService'
import { Button } from '@/components/ui/button'
import type { NodePositionMap } from '@/types/diagram'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Image, FileCode, ZoomIn, ZoomOut, Maximize, Info, Undo2, Redo2, Clock, LayoutGrid, GitBranch } from 'lucide-react'

function ControlButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: typeof Image
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={onClick}
            disabled={disabled}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function useUndoRedo() {
  const handleUndo = useCallback(async () => {
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
    const snapshot = historyStore.undo(currentSnapshot)
    if (!snapshot) return
    useHistoryStore.getState().setIsApplying(true)
    try {
      store.setXmlContent(snapshot.xmlContent)
      store.setSavedNodePositions(snapshot.nodePositions)
      await store.parseAndBuild()
    } finally {
      useHistoryStore.getState().setIsApplying(false)
    }
  }, [])

  const handleRedo = useCallback(async () => {
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
    const snapshot = historyStore.redo(currentSnapshot)
    if (!snapshot) return
    useHistoryStore.getState().setIsApplying(true)
    try {
      store.setXmlContent(snapshot.xmlContent)
      store.setSavedNodePositions(snapshot.nodePositions)
      await store.parseAndBuild()
    } finally {
      useHistoryStore.getState().setIsApplying(false)
    }
  }, [])

  return { handleUndo, handleRedo }
}

function ViewModeToggle() {
  const { viewMode, toggleViewMode } = useUIStore()

  const icon = viewMode === 'grid' ? LayoutGrid : GitBranch
  const label = viewMode === 'grid' ? 'Grid view — Switch to Diagram' : 'Diagram view — Switch to Grid'

  return (
    <ControlButton
      icon={icon}
      label={label}
      onClick={toggleViewMode}
      active={viewMode === 'grid'}
    />
  )
}

export function DiagramControls() {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const { nodes } = useDiagramStore()
  const { showLegend, toggleLegend } = useUIStore()
  const { past, future } = useHistoryStore()
  const { handleUndo, handleRedo } = useUndoRedo()
  const canUndo = past.length > 0
  const canRedo = future.length > 0
  const noNodes = nodes.length === 0

  async function handleExportPNG() {
    const element = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!element) return
    await exportToPNG(element, nodes, { quality: 'ultra' })
  }

  async function handleExportSVG() {
    const element = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!element) return
    await exportToSVG(element, nodes)
  }

  return (
    <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border px-1.5 py-1 flex items-center gap-0.5 z-10">
      {/* Undo / Redo */}
      <ControlButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo} />
      <ControlButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={handleRedo} disabled={!canRedo} />

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* View mode toggle */}
      <ViewModeToggle />

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Export */}
      <ControlButton icon={Image} label="Export PNG" onClick={handleExportPNG} disabled={noNodes} />
      <ControlButton icon={FileCode} label="Export SVG" onClick={handleExportSVG} disabled={noNodes} />

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Zoom */}
      <ControlButton icon={ZoomOut} label="Zoom Out" onClick={() => zoomOut()} />
      <ControlButton icon={ZoomIn} label="Zoom In" onClick={() => zoomIn()} />
      <ControlButton icon={Maximize} label="Fit View" onClick={() => fitView({ padding: 0.1 })} />

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Legend + Version History */}
      <ControlButton icon={Info} label="Legend" onClick={toggleLegend} active={showLegend} />
      <ControlButton icon={Clock} label="Version History" onClick={() => useUIStore.getState().setShowVersionHistory(!useUIStore.getState().showVersionHistory)} />
    </div>
  )
}

/**
 * Grid-mode controls — no React Flow hooks, just export/undo/redo/mode toggle.
 * Used when the diagram is in grid mode (no ReactFlow provider context).
 */
export function GridDiagramControls() {
  const { nodes } = useDiagramStore()
  const { handleUndo, handleRedo } = useUndoRedo()
  const { past, future } = useHistoryStore()
  const canUndo = past.length > 0
  const canRedo = future.length > 0
  const noNodes = nodes.length === 0

  async function handleExportPNG() {
    const element = document.querySelector('#grid-diagram-container') as HTMLElement | null
    if (!element) return
    await exportToPNG(element, nodes, { quality: 'ultra', isGridMode: true })
  }

  async function handleExportSVG() {
    const element = document.querySelector('#grid-diagram-container') as HTMLElement | null
    if (!element) return
    await exportToSVG(element, nodes, { isGridMode: true })
  }

  return (
    <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border px-1.5 py-1 flex items-center gap-0.5 z-10">
      {/* Undo / Redo */}
      <ControlButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo} />
      <ControlButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={handleRedo} disabled={!canRedo} />

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* View mode toggle */}
      <ViewModeToggle />

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Export */}
      <ControlButton icon={Image} label="Export PNG" onClick={handleExportPNG} disabled={noNodes} />
      <ControlButton icon={FileCode} label="Export SVG" onClick={handleExportSVG} disabled={noNodes} />

      <div className="w-px h-5 bg-border mx-0.5" />

      {/* Version History */}
      <ControlButton icon={Clock} label="Version History" onClick={() => useUIStore.getState().setShowVersionHistory(!useUIStore.getState().showVersionHistory)} />
    </div>
  )
}
