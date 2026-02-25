import type { Node, Edge } from '@xyflow/react'

/* ------------------------------------------------------------------ */
/*  Edge route point type                                              */
/* ------------------------------------------------------------------ */
export interface RoutePoint {
  x: number
  y: number
}

/* ------------------------------------------------------------------ */
/*  Node dimension constants                                          */
/* ------------------------------------------------------------------ */
interface NodeDimensions {
  [type: string]: { width: number; baseHeight: number }
}

const NODE_DIMENSIONS: NodeDimensions = {
  userNode: { width: 260, baseHeight: 110 },
  orchestratorNode: { width: 380, baseHeight: 170 },
  agentNode: { width: 460, baseHeight: 340 },
  resourceNode: { width: 240, baseHeight: 90 },
}

function getNodeWidth(type: string | undefined): number {
  return NODE_DIMENSIONS[type ?? '']?.width ?? 200
}

function getNodeHeight(type: string | undefined, data: Record<string, unknown>): number {
  const dims = NODE_DIMENSIONS[type ?? '']
  if (!dims) return 150

  let height = dims.baseHeight

  if (type === 'agentNode') {
    const inputs = data['inputs'] as unknown[] | undefined
    const tools = data['tools'] as unknown[] | undefined
    const structuredOutputs = data['structuredOutputs'] as unknown[] | undefined
    const inputCount = inputs?.length ?? 0
    const toolCount = tools?.length ?? 0
    const soCount = structuredOutputs?.length ?? 0
    // Orchestrator badge: ~28px
    const orchName = data['orchestratorName'] as string | undefined
    if (orchName) height += 28
    // Inputs: ~22px per item shown (up to 6)
    height += Math.min(inputCount, 6) * 22
    // Tools: ~56px per embedded tool sub-card
    height += toolCount * 56
    // Structured outputs: ~22px per field + 28px header
    if (soCount > 0) height += 28 + soCount * 22
  }

  if (type === 'orchestratorNode') {
    const tools = data['tools'] as unknown[] | undefined
    const hasCdp = data['hasCdp'] as boolean | undefined
    const reasoning = data['reasoning'] as unknown[] | undefined
    const description = data['description'] as string | undefined
    const toolCount = tools?.length ?? 0
    const capCount = reasoning?.length ?? 0
    // CDP line + tool lines: ~20px each
    if (hasCdp) height += 20
    height += toolCount * 20
    // Capabilities: ~18px per line (up to 3) + 24px header
    if (capCount > 0) height += 24 + Math.min(capCount, 3) * 18
    // Description: ~30px
    if (description) height += 30
  }

  return Math.min(height, 700)
}

/* ------------------------------------------------------------------ */
/*  ELK port definitions – mirrors React Flow handle IDs per node type*/
/* ------------------------------------------------------------------ */
interface ElkPort {
  id: string
  properties: Record<string, string>
}

/**
 * Handle-name → ELK side mapping for each node type.
 * Must stay in sync with the <Handle> declarations in src/components/nodes/*.
 */
const NODE_PORT_MAP: Record<string, Array<{ handle: string; side: string }>> = {
  userNode: [
    { handle: 'message-out', side: 'SOUTH' },
    { handle: 'response-in', side: 'WEST' },
  ],
  orchestratorNode: [
    { handle: 'user-in', side: 'NORTH' },
    { handle: 'response-out', side: 'NORTH' },
    { handle: 'result-in', side: 'EAST' },
    { handle: 'resource-out', side: 'SOUTH' },
  ],
  agentNode: [
    { handle: 'delegate-in', side: 'NORTH' },
    { handle: 'data-in', side: 'WEST' },
    { handle: 'result-out', side: 'EAST' },
    { handle: 'resource-out', side: 'SOUTH' },
  ],
  resourceNode: [
    { handle: 'access-in', side: 'NORTH' },
  ],
}

function getPortsForNode(nodeId: string, nodeType: string | undefined): ElkPort[] {
  const portDefs = NODE_PORT_MAP[nodeType ?? ''] ?? []
  return portDefs.map((def: { handle: string; side: string }) => ({
    id: `${nodeId}--${def.handle}`,
    properties: {
      'elk.port.side': def.side,
    },
  }))
}

/* ------------------------------------------------------------------ */
/*  ELK layout                                                        */
/* ------------------------------------------------------------------ */
async function getElk() {
  const ELK = (await import('elkjs/lib/elk.bundled')).default
  return new ELK()
}

/** Route data extracted from ELK for each edge */
export interface ElkEdgeRoute {
  points: RoutePoint[]
}

export async function calculateLayout(
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (nodes.length === 0) return { nodes, edges }

  try {
    const elk = await getElk()

    const elkGraph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        // --- generous spacing for large agent cards ---
        'elk.spacing.nodeNode': '200',
        'elk.layered.spacing.nodeNodeBetweenLayers': '250',
        'elk.spacing.edgeNode': '150',
        'elk.spacing.edgeEdge': '50',
        'elk.layered.spacing.edgeNodeBetweenLayers': '100',
        'elk.layered.spacing.edgeEdgeBetweenLayers': '30',
        // --- crossing & placement ---
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.mergeEdges': 'false',
        'elk.layered.edgeRouting.selfLoopDistribution': 'EQUALLY',
        'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      },
      children: nodes.map((node: Node) => ({
        id: node.id,
        width: getNodeWidth(node.type),
        height: getNodeHeight(node.type, node.data as Record<string, unknown>),
        properties: {
          'elk.portConstraints': 'FIXED_SIDE',
        },
        ports: getPortsForNode(node.id, node.type),
      })),
      edges: edges.map((edge: Edge) => {
        // Resolve source/target to port IDs when handle info is available
        const srcPort = edge.sourceHandle
          ? `${edge.source}--${edge.sourceHandle}`
          : undefined
        const tgtPort = edge.targetHandle
          ? `${edge.target}--${edge.targetHandle}`
          : undefined

        return {
          id: edge.id,
          sources: [srcPort ?? edge.source],
          targets: [tgtPort ?? edge.target],
        }
      }),
    }

    const layout = await elk.layout(elkGraph)

    // ELK edge section types (not fully exposed by elkjs typedefs)
    interface ElkSection {
      startPoint: { x: number; y: number }
      endPoint: { x: number; y: number }
      bendPoints?: Array<{ x: number; y: number }>
    }
    interface ElkEdgeWithSections {
      id: string
      sections?: ElkSection[]
    }

    // Build edge route map from ELK's computed sections
    const edgeRouteMap = new Map<string, ElkEdgeRoute>()
    if (layout.edges) {
      const elkEdges = layout.edges as unknown as ElkEdgeWithSections[]
      elkEdges.forEach((elkEdge: ElkEdgeWithSections) => {
        const sections = elkEdge.sections
        if (sections && sections.length > 0) {
          const allPoints: RoutePoint[] = []
          sections.forEach((section: ElkSection) => {
            allPoints.push({ x: section.startPoint.x, y: section.startPoint.y })
            if (section.bendPoints) {
              section.bendPoints.forEach((bp: { x: number; y: number }) => {
                allPoints.push({ x: bp.x, y: bp.y })
              })
            }
            allPoints.push({ x: section.endPoint.x, y: section.endPoint.y })
          })
          edgeRouteMap.set(elkEdge.id, { points: allPoints })
        }
      })
    }

    const layoutedNodes = nodes.map((node: Node) => {
      const elkNode = layout.children?.find((n) => n.id === node.id)
      return {
        ...node,
        position: {
          x: elkNode?.x ?? 0,
          y: elkNode?.y ?? 0,
        },
      }
    })

    // Attach ELK route data to edges
    const layoutedEdges = edges.map((edge: Edge) => {
      const route = edgeRouteMap.get(edge.id)
      if (route) {
        return {
          ...edge,
          type: 'elkRouted',
          data: { ...(edge.data as Record<string, unknown> ?? {}), elkRoute: route.points },
        }
      }
      return edge
    })

    return { nodes: layoutedNodes, edges: layoutedEdges }
  } catch {
    // Fallback: simple vertical layout
    return fallbackLayout(nodes, edges)
  }
}

/* ------------------------------------------------------------------ */
/*  Fallback layout (no ELK)                                          */
/* ------------------------------------------------------------------ */
function fallbackLayout(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  const centerX = 800

  const userNodes = nodes.filter((n: Node) => n.type === 'userNode')
  const orchNodes = nodes.filter((n: Node) => n.type === 'orchestratorNode')
  const agentNodes = nodes.filter((n: Node) => n.type === 'agentNode')
  const resourceNodes = nodes.filter((n: Node) => n.type === 'resourceNode')

  let yOffset = 40

  // User at top center
  userNodes.forEach((node: Node) => {
    node.position = { x: centerX - getNodeWidth(node.type) / 2, y: yOffset }
  })
  yOffset += 200

  // Orchestrator below user
  orchNodes.forEach((node: Node) => {
    node.position = { x: centerX - getNodeWidth(node.type) / 2, y: yOffset }
  })
  yOffset += 250

  // Agents in a horizontal row with generous spacing (480px per card)
  const agentCount = agentNodes.length
  const agentSpacing = 480
  const totalWidth = (agentCount - 1) * agentSpacing
  const startX = centerX - totalWidth / 2

  agentNodes.forEach((node: Node, index: number) => {
    const x = startX + index * agentSpacing - getNodeWidth(node.type) / 2
    node.position = { x, y: yOffset }
  })

  // Calculate max agent height for resource placement
  let maxAgentH = 300
  agentNodes.forEach((node: Node) => {
    const h = getNodeHeight(node.type, node.data as Record<string, unknown>)
    if (h > maxAgentH) maxAgentH = h
  })
  yOffset += maxAgentH + 200

  // Resources at bottom center with generous spacing
  const resSpacing = 340
  const resWidth = (resourceNodes.length - 1) * resSpacing
  const resStartX = centerX - resWidth / 2
  resourceNodes.forEach((node: Node, index: number) => {
    node.position = { x: resStartX + index * resSpacing - getNodeWidth(node.type) / 2, y: yOffset }
  })

  return { nodes, edges }
}
