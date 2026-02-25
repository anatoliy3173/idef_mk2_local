import { MarkerType } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import type { AgentSystem, Agent, AgentInput, AgentCategory } from '@/types/agentSystem'
import type { InputNode } from '@/types/diagram'
import { EDGE_STYLES, AGENT_CATEGORIES } from '@/lib/constants'

/* ------------------------------------------------------------------ */
/*  Edge factory – centralises type, arrows, label bg, handle IDs     */
/* ------------------------------------------------------------------ */
interface MakeEdgeParams {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  style: Record<string, unknown>
  animated?: boolean
}

function makeEdge(params: MakeEdgeParams): Edge {
  const strokeColor = String(params.style['stroke'] ?? '#6B7280')
  return {
    id: params.id,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
    type: 'elkRouted',
    animated: params.animated ?? false,
    label: params.label,
    style: params.style,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 22,
      height: 22,
      color: strokeColor,
    },
    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
    labelBgPadding: [6, 4] as [number, number],
    labelBgBorderRadius: 4,
    labelStyle: { fontSize: 13, fontWeight: 600 },
  }
}

export function deduplicateInputs(agents: Agent[]): InputNode[] {
  const inputMap = new Map<string, InputNode>()

  agents.forEach((agent: Agent) => {
    agent.inputs.forEach((input: AgentInput) => {
      const key = `${input.source}-${input.name}`

      if (!inputMap.has(key)) {
        inputMap.set(key, {
          id: `input-${inputMap.size}`,
          name: input.name,
          source: input.source,
          connectedAgents: [agent.id],
        })
      } else {
        const existing = inputMap.get(key)
        if (existing) {
          existing.connectedAgents.push(agent.id)
        }
      }
    })
  })

  return Array.from(inputMap.values()).filter(
    (input: InputNode) => input.connectedAgents.length > 1
  )
}

/* ------------------------------------------------------------------ */
/*  Node builder                                                      */
/* ------------------------------------------------------------------ */
export function buildNodes(system: AgentSystem): Node[] {
  const nodes: Node[] = []

  // 1. User node
  nodes.push({
    id: 'user',
    type: 'userNode',
    position: { x: 0, y: 0 },
    data: {
      label: 'User Query',
      scenario: system.userJourney?.scenario,
    },
  })

  // 2. Check if any agent/orchestrator uses "context" inputs → CDP flag on orchestrator
  const hasContextInputs = system.agents.some((agent: Agent) =>
    agent.inputs.some((input: AgentInput) => input.source.includes('context'))
  ) || system.orchestrator.inputs.some((input: AgentInput) => input.source.includes('context'))

  // Collect orchestrator-level tools (currently none from schema, but extensible)
  const orchestratorTools: Array<{ id: string; name: string; type: string }> = []

  // 2. Orchestrator node — with CDP as a tool when context inputs exist
  nodes.push({
    id: system.orchestrator.id,
    type: 'orchestratorNode',
    position: { x: 0, y: 0 },
    data: {
      name: system.orchestrator.name,
      description: system.orchestrator.description,
      reasoning: system.orchestrator.reasoning.capabilities,
      inputs: system.orchestrator.inputs,
      outputs: system.orchestrator.outputs,
      tools: orchestratorTools,
      hasCdp: hasContextInputs,
    },
  })

  // 3. Agent nodes (tools are embedded inside the AgentNode card)
  // Track per-category index for unique shade assignment
  const orchestratorName = system.orchestrator.name
  const categoryIndexMap = new Map<string, number>()
  system.agents.forEach((agent: Agent) => {
    const catKey = agent.category as AgentCategory
    const catIndex = categoryIndexMap.get(catKey) ?? 0
    categoryIndexMap.set(catKey, catIndex + 1)

    const catConfig = AGENT_CATEGORIES[catKey]
    const shades = catConfig?.shades ?? [catConfig?.color ?? '#60A5FA']
    const agentColor = shades[catIndex % shades.length]

    nodes.push({
      id: agent.id,
      type: 'agentNode',
      position: { x: 0, y: 0 },
      data: {
        agentId: agent.id,
        name: agent.name,
        category: agent.category,
        purpose: agent.purpose,
        model: agent.model,
        inputs: agent.inputs,
        tools: agent.tools,
        reasoning: agent.reasoning,
        outputs: agent.outputs,
        structuredOutputs: agent.structuredOutputs,
        agentColor,
        orchestratorName,
      },
    })
  })

  // 4. Shared resource nodes (skip memory & knowledge types — handled by orchestrator CDP / agent tools)
  const FILTERED_RESOURCE_TYPES = new Set(['memory', 'knowledge'])
  if (system.sharedResources) {
    system.sharedResources.forEach((resource) => {
      if (FILTERED_RESOURCE_TYPES.has(resource.type)) return
      nodes.push({
        id: resource.id,
        type: 'resourceNode',
        position: { x: 0, y: 0 },
        data: {
          name: resource.name,
          resourceType: resource.type,
          technology: resource.technology,
          accessBy: resource.accessBy,
          description: resource.description,
        },
      })
    })
  }

  return nodes
}

/* ------------------------------------------------------------------ */
/*  Edge builder — includes delegation, data flow & resource edges    */
/* ------------------------------------------------------------------ */
export function buildEdges(system: AgentSystem): Edge[] {
  const edges: Edge[] = []

  const orchId = system.orchestrator.id

  // 1. User → Orchestrator
  edges.push(makeEdge({
    id: 'user-to-orch',
    source: 'user',
    target: orchId,
    sourceHandle: 'message-out',
    targetHandle: 'user-in',
    label: 'User Message',
    style: EDGE_STYLES.userInput,
  }))

  // 2. Orchestrator → User (response)
  edges.push(makeEdge({
    id: 'orch-to-user',
    source: orchId,
    target: 'user',
    sourceHandle: 'response-out',
    targetHandle: 'response-in',
    label: 'Response',
    style: EDGE_STYLES.finalOutput,
  }))

  // 3. Inter-agent data flow (right-to-left, lateral)
  system.agents.forEach((agent: Agent) => {
    agent.inputs.forEach((input: AgentInput) => {
      const sources = input.source.split('/').map((s: string) => s.trim())
      sources.forEach((src: string) => {
        if (src.startsWith('agent-')) {
          const sourceAgent = system.agents.find((a: Agent) => a.id === src)
          if (sourceAgent) {
            const edgeId = `${src}-to-${agent.id}-${input.name.replace(/\s+/g, '_')}`
            const alreadyExists = edges.some((e: Edge) => e.id === edgeId)
            if (!alreadyExists) {
              edges.push(makeEdge({
                id: edgeId,
                source: src,
                target: agent.id,
                sourceHandle: 'result-out',
                targetHandle: 'data-in',
                label: input.name,
                style: EDGE_STYLES.dataFlow,
              }))
            }
          }
        }
      })
    })
  })

  // 4. Shared resource connections (bottom → access-in) — skip memory & knowledge types
  const FILTERED_RES_TYPES = new Set(['memory', 'knowledge'])
  if (system.sharedResources) {
    system.sharedResources.forEach((resource) => {
      if (FILTERED_RES_TYPES.has(resource.type)) return
      resource.accessBy.forEach((agentId: string) => {
        const isOrch = agentId === 'orchestrator' || agentId === orchId
        const nodeId = isOrch ? orchId : agentId
        const style = resource.accessPattern === 'read-only'
          ? EDGE_STYLES.contextRead
          : EDGE_STYLES.contextWrite

        // Both orchestrator and agents use their bottom handle for resources
        const srcHandle = isOrch ? 'resource-out' : 'resource-out'

        edges.push(makeEdge({
          id: `${nodeId}-to-${resource.id}`,
          source: nodeId,
          target: resource.id,
          sourceHandle: srcHandle,
          targetHandle: 'access-in',
          style,
        }))
      })
    })
  }

  return edges
}
