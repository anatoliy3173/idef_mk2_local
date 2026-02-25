import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { AgentSystem, ValidationError, ValidationWarning } from '@/types/agentSystem'
import type { NodePositionMap } from '@/types/diagram'
import { parseXml } from '@/services/xmlService'
import { parseTeamXml } from '@/services/teamXmlParser'
import type { TeamDiagram } from '@/types/teamDiagram'
import { buildNodes, buildEdges } from '@/services/diagramBuilder'
import { calculateLayout } from '@/services/layoutEngine'
import { calculateComplexity, type ComplexityScore, type RenderMode } from '@/services/complexityService'
import { useHistoryStore } from '@/stores/historyStore'
import { useUIStore } from '@/stores/uiStore'

interface DiagramState {
  // XML state
  xmlContent: string
  setXmlContent: (xml: string) => void

  // Parsed data
  parsedData: AgentSystem | null
  errors: ValidationError[]
  warnings: ValidationWarning[]
  teamDiagram: TeamDiagram | null
  teamError: string | null

  // Diagram state
  nodes: Node[]
  edges: Edge[]
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void

  // Complexity & render mode
  renderMode: RenderMode
  complexityScore: ComplexityScore | null

  // Persisted node positions (loaded from DB or accumulated from drags)
  savedNodePositions: NodePositionMap
  setSavedNodePositions: (positions: NodePositionMap) => void

  // Current diagram ID (from Supabase)
  currentDiagramId: string | null
  currentTitle: string
  /** True only when the user explicitly renamed the title via commitTitle */
  titleDirty: boolean
  setCurrentDiagramId: (id: string | null) => void
  setCurrentTitle: (title: string) => void
  markTitleDirty: () => void
  clearTitleDirty: () => void

  // Layout preference (max agents per row; 0 = auto)
  layoutMaxPerRow: number
  setLayoutMaxPerRow: (n: number) => void

  // Actions
  parseAndBuild: () => Promise<void>
  resetDiagram: () => void
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  xmlContent: '',
  parsedData: null,
  errors: [],
  warnings: [],
  teamDiagram: null,
  teamError: null,
  layoutMaxPerRow: 0,
  nodes: [],
  edges: [],
  renderMode: 'simple' as RenderMode,
  complexityScore: null,
  savedNodePositions: {},
  currentDiagramId: null,
  currentTitle: 'Untitled Diagram',
  titleDirty: false,

  setXmlContent: (xml: string) => {
    set({ xmlContent: xml })
  },

  setNodes: (nodes: Node[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => set({ edges }),

  setSavedNodePositions: (positions: NodePositionMap) => set({ savedNodePositions: positions }),

  setLayoutMaxPerRow: (n: number) => set({ layoutMaxPerRow: n }),

  setCurrentDiagramId: (id: string | null) => set({ currentDiagramId: id }),
  setCurrentTitle: (title: string) => set({ currentTitle: title }),
  markTitleDirty: () => set({ titleDirty: true }),
  clearTitleDirty: () => set({ titleDirty: false }),

  parseAndBuild: async () => {
    const { xmlContent, nodes: existingNodes, savedNodePositions } = get()

    // Build a map of currently known positions: savedNodePositions (from DB)
    // merged with in-memory positions (from drags within this session)
    const knownPositions: NodePositionMap = { ...savedNodePositions }
    existingNodes.forEach((node: Node) => {
      knownPositions[node.id] = { x: node.position.x, y: node.position.y }
    })

    if (!xmlContent.trim()) {
      set({ parsedData: null, nodes: [], edges: [], errors: [], warnings: [], teamDiagram: null, teamError: null })
      return
    }

    // Try new TeamDiagram format first
    const teamResult = parseTeamXml(xmlContent)
    if (teamResult.data !== null) {
      // Successfully parsed as team XML — skip old parser
      set({ teamDiagram: teamResult.data, teamError: null })
      return
    } else if (teamResult.error !== null) {
      // Looks like team XML but had errors
      set({ teamError: teamResult.error, teamDiagram: null })
      return
    }
    // teamResult = { data: null, error: null } — not a team XML, fall through to legacy parser

    const result = parseXml(xmlContent)

    if (!result.data) {
      set({
        parsedData: null,
        nodes: [],
        edges: [],
        errors: result.errors,
        warnings: result.warnings,
      })
      return
    }

    // Calculate complexity score to determine render mode
    const complexity = calculateComplexity(result.data)

    // Auto-set view mode when complexity changes from previous parse
    const prevMode = get().renderMode
    if (complexity.mode !== prevMode) {
      useUIStore.getState().setViewMode(complexity.mode === 'grid' ? 'grid' : 'diagram')
    }

    const rawNodes = buildNodes(result.data)
    const rawEdges = buildEdges(result.data)

    // Check if we have saved positions for ALL nodes in the new set
    const allHavePositions = rawNodes.every((node: Node) => knownPositions[node.id] !== undefined)

    // Helper to push a history snapshot after successful parse
    const pushHistorySnapshot = (finalNodes: Node[]) => {
      const positions: NodePositionMap = {}
      finalNodes.forEach((n: Node) => {
        positions[n.id] = { x: n.position.x, y: n.position.y }
      })
      useHistoryStore.getState().pushSnapshot({
        xmlContent,
        nodePositions: positions,
        timestamp: Date.now(),
      })
    }

    if (allHavePositions && Object.keys(knownPositions).length > 0) {
      // All nodes have known positions — use them directly, skip layout engine
      const mergedNodes = rawNodes.map((node: Node) => ({
        ...node,
        position: knownPositions[node.id],
      }))

      set({
        parsedData: result.data,
        nodes: mergedNodes,
        edges: rawEdges,
        renderMode: complexity.mode,
        complexityScore: complexity,
        errors: result.errors,
        warnings: result.warnings,
      })
      pushHistorySnapshot(mergedNodes)
      return
    }

    // Some nodes are new — run layout engine, then override known positions
    try {
      const { nodes: layoutedNodes, edges: layoutedEdges } = await calculateLayout(rawNodes, rawEdges)

      const finalNodes = layoutedNodes.map((node: Node) => {
        const saved = knownPositions[node.id]
        return saved
          ? { ...node, position: saved }
          : node
      })

      set({
        parsedData: result.data,
        nodes: finalNodes,
        edges: layoutedEdges,
        renderMode: complexity.mode,
        complexityScore: complexity,
        errors: result.errors,
        warnings: result.warnings,
      })
      pushHistorySnapshot(finalNodes)
    } catch {
      // If layout fails, use raw positions merged with known
      const fallbackNodes = rawNodes.map((node: Node) => {
        const saved = knownPositions[node.id]
        return saved
          ? { ...node, position: saved }
          : node
      })
      set({
        parsedData: result.data,
        nodes: fallbackNodes,
        edges: rawEdges,
        renderMode: complexity.mode,
        complexityScore: complexity,
        errors: result.errors,
        warnings: result.warnings,
      })
      pushHistorySnapshot(fallbackNodes)
    }
  },

  resetDiagram: () => {
    set({
      xmlContent: '',
      parsedData: null,
      nodes: [],
      edges: [],
      renderMode: 'simple' as RenderMode,
      complexityScore: null,
      errors: [],
      warnings: [],
      teamDiagram: null,
      teamError: null,
      layoutMaxPerRow: 0,
      savedNodePositions: {},
      currentDiagramId: null,
      currentTitle: 'Untitled Diagram',
      titleDirty: false,
    })
  },
}))

// ── Preserve store DATA across Vite HMR reloads ──
// When Vite HMR replaces this module, `create()` re-runs with defaults.
// We persist data fields on globalThis so the new store can restore them.
// This survives HMR but NOT full page reloads (which is correct — loadDiagram
// restores from DB on full reload).
const HMR_STORE_KEY = '__diagramStore_hmr__'

interface DiagramHMRCache {
  xmlContent: string
  parsedData: AgentSystem | null
  errors: ValidationError[]
  warnings: ValidationWarning[]
  teamDiagram: TeamDiagram | null
  teamError: string | null
  layoutMaxPerRow: number
  nodes: Node[]
  edges: Edge[]
  renderMode: RenderMode
  complexityScore: ComplexityScore | null
  savedNodePositions: NodePositionMap
  currentDiagramId: string | null
  currentTitle: string
  titleDirty: boolean
}

interface HMRGlobal { [HMR_STORE_KEY]?: DiagramHMRCache }
const _g = globalThis as unknown as HMRGlobal

// Restore from previous HMR cycle if available
if (_g[HMR_STORE_KEY]) {
  useDiagramStore.setState(_g[HMR_STORE_KEY])
}

// Persist data fields to globalThis on every state change (dev only)
if (import.meta.hot) {
  useDiagramStore.subscribe((state: DiagramState) => {
    _g[HMR_STORE_KEY] = {
      xmlContent: state.xmlContent,
      parsedData: state.parsedData,
      errors: state.errors,
      warnings: state.warnings,
      teamDiagram: state.teamDiagram,
      teamError: state.teamError,
      layoutMaxPerRow: state.layoutMaxPerRow,
      nodes: state.nodes,
      edges: state.edges,
      renderMode: state.renderMode,
      complexityScore: state.complexityScore,
      savedNodePositions: state.savedNodePositions,
      currentDiagramId: state.currentDiagramId,
      currentTitle: state.currentTitle,
      titleDirty: state.titleDirty,
    }
  })
}
