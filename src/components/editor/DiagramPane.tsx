import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MarkerType,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import { useDiagramStore } from '@/stores/diagramStore'
import { useUIStore } from '@/stores/uiStore'
import { useHistoryStore } from '@/stores/historyStore'
import type { NodePositionMap } from '@/types/diagram'
import { UserNode } from '@/components/nodes/UserNode'
import { OrchestratorNode } from '@/components/nodes/OrchestratorNode'
import { AgentNode } from '@/components/nodes/AgentNode'
import { ToolNode } from '@/components/nodes/ToolNode'
import { ResourceNode } from '@/components/nodes/ResourceNode'
import { ElkRoutedEdge } from '@/components/edges/ElkRoutedEdge'
import { GridRenderer } from './GridRenderer'
import { DiagramControls, GridDiagramControls } from './DiagramControls'
import { LegendPanel } from './LegendPanel'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import { TeamDiagramRenderer } from '@/components/diagram/TeamDiagramRenderer'
import { FileText } from 'lucide-react'

const nodeTypes: NodeTypes = {
  userNode: UserNode,
  orchestratorNode: OrchestratorNode,
  agentNode: AgentNode,
  toolNode: ToolNode,
  resourceNode: ResourceNode,
}

const edgeTypes: EdgeTypes = {
  elkRouted: ElkRoutedEdge,
}

export function DiagramPane() {
  const { nodes, edges, setNodes, setEdges, parsedData, teamDiagram } = useDiagramStore()
  const { showLegend, showVersionHistory, setSelectedNodeId, viewMode } = useUIStore()

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updatedNodes = applyNodeChanges(changes, nodes)
      setNodes(updatedNodes)

      // If any node position changed, clear ELK route data from connected edges
      // so they fall back to smoothstep rendering
      const movedNodeIds = new Set<string>()
      changes.forEach((c: NodeChange) => {
        if (c.type === 'position' && 'id' in c && 'position' in c && c.position !== undefined) {
          movedNodeIds.add(c.id)
        }
      })
      if (movedNodeIds.size > 0) {
        let edgesChanged = false
        const updatedEdges = edges.map((edge: Edge) => {
          if (movedNodeIds.has(edge.source) || movedNodeIds.has(edge.target)) {
            const edgeData = edge.data as Record<string, unknown> | undefined
            if (edgeData?.elkRoute) {
              edgesChanged = true
              const { elkRoute: _removed, ...restData } = edgeData
              void _removed
              return { ...edge, data: restData }
            }
          }
          return edge
        })
        if (edgesChanged) {
          setEdges(updatedEdges)
        }
      }
    },
    [nodes, edges, setNodes, setEdges]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edges))
    },
    [edges, setEdges]
  )

  // Manual connection: let users draw arrows between nodes
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Guard: both source and target must exist
      if (!connection.source || !connection.target) return
      // Guard: prevent self-loops
      if (connection.source === connection.target) return
      // Guard: prevent duplicate edges between same source+target+handles
      const alreadyExists = edges.some(
        (e: Edge) =>
          e.source === connection.source &&
          e.target === connection.target &&
          e.sourceHandle === connection.sourceHandle &&
          e.targetHandle === connection.targetHandle
      )
      if (alreadyExists) return

      const newEdge: Edge = {
        id: `manual-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        type: 'smoothstep',
        style: { stroke: '#6B7280', strokeWidth: 3 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 22,
          height: 22,
          color: '#6B7280',
        },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
        labelStyle: { fontSize: 13, fontWeight: 600 },
      }
      setEdges([...edges, newEdge])

      // Push history snapshot after manual edge creation
      const storeState = useDiagramStore.getState()
      const positions: NodePositionMap = {}
      storeState.nodes.forEach((n: Node) => {
        positions[n.id] = { x: n.position.x, y: n.position.y }
      })
      useHistoryStore.getState().pushSnapshot({
        xmlContent: storeState.xmlContent,
        nodePositions: positions,
        timestamp: Date.now(),
      })
    },
    [edges, setEdges]
  )

  // Push history snapshot after node drag ends
  const onNodeDragStop = useCallback(() => {
    const storeState = useDiagramStore.getState()
    const positions: NodePositionMap = {}
    storeState.nodes.forEach((n: Node) => {
      positions[n.id] = { x: n.position.x, y: n.position.y }
    })
    useHistoryStore.getState().pushSnapshot({
      xmlContent: storeState.xmlContent,
      nodePositions: positions,
      timestamp: Date.now(),
    })
  }, [])

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id)
    },
    [setSelectedNodeId]
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  // Memoize default edge options
  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    animated: false,
  }), [])

  // New team XML format — use custom canvas renderer
  if (teamDiagram) {
    return (
      <div className="h-full relative">
        <TeamDiagramRenderer diagram={teamDiagram} />
        {showVersionHistory && <VersionHistoryPanel />}
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-stone-50 text-muted-foreground">
        <FileText className="w-16 h-16 mb-4 text-stone-300" />
        <h3 className="text-lg font-medium text-stone-500 mb-2">No diagram to display</h3>
        <p className="text-sm text-stone-400 max-w-sm text-center">
          Paste or import valid XML in the editor to generate a diagram.
          Use the Prompt Templates to get started with AI.
        </p>
      </div>
    )
  }

  // Grid mode rendering — no ReactFlow context, use GridDiagramControls
  if (viewMode === 'grid' && parsedData) {
    return (
      <div className="h-full relative">
        <GridRenderer parsedData={parsedData} />
        <GridDiagramControls />
        {showVersionHistory && <VersionHistoryPanel />}
      </div>
    )
  }

  return (
    <div className="h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.05}
        maxZoom={2}
        elevateEdgesOnSelect
        panActivationKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e8e6dc" />
      </ReactFlow>

      <DiagramControls />
      {showLegend && <LegendPanel />}
      {showVersionHistory && <VersionHistoryPanel />}
    </div>
  )
}
