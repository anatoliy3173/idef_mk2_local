import { describe, it, expect } from 'vitest'
import { buildNodes, buildEdges, deduplicateInputs } from './diagramBuilder'
import type { AgentSystem, Agent } from '@/types/agentSystem'

function createMinimalSystem(agents: Agent[]): AgentSystem {
  return {
    metadata: { title: 'Test' },
    orchestrator: {
      id: 'orch-main',
      name: 'Orchestrator',
      description: 'Test orchestrator',
      reasoning: { capabilities: ['Analyze'] },
      inputs: [{ source: 'user', type: 'string', required: true, name: 'Message' }],
      outputs: [{ target: 'user', type: 'string', name: 'Response' }],
    },
    agents,
  }
}

const sampleAgents: Agent[] = [
  {
    id: 'agent-001',
    category: 'data-collection',
    name: 'Data Agent',
    purpose: 'Collect data',
    inputs: [{ source: 'orchestrator', type: 'string', required: true, name: 'Query' }],
    tools: [{ id: 'tool-1', type: 'api', name: 'Test API' }],
    reasoning: { strategies: ['Fetch data'] },
    outputs: [{ type: 'object', name: 'Data' }],
    structuredOutputs: [],
  },
  {
    id: 'agent-002',
    category: 'action',
    name: 'Action Agent',
    purpose: 'Execute actions',
    inputs: [
      { source: 'agent-001', type: 'object', required: true, name: 'Input Data' },
      { source: 'orchestrator', type: 'string', required: false, name: 'Instructions' },
    ],
    tools: [
      { id: 'tool-2', type: 'api', name: 'Action API' },
      { id: 'tool-3', type: 'api', name: 'Payment API' },
    ],
    reasoning: { strategies: ['Execute action'] },
    outputs: [{ type: 'object', name: 'Result' }],
    structuredOutputs: [],
  },
]

describe('diagramBuilder', () => {
  describe('buildNodes', () => {
    it('should create user node', () => {
      const system = createMinimalSystem([sampleAgents[0]!])
      const nodes = buildNodes(system)
      const userNode = nodes.find((n) => n.id === 'user')
      expect(userNode).toBeDefined()
      expect(userNode?.type).toBe('userNode')
    })

    it('should create orchestrator node', () => {
      const system = createMinimalSystem([sampleAgents[0]!])
      const nodes = buildNodes(system)
      const orchNode = nodes.find((n) => n.id === 'orch-main')
      expect(orchNode).toBeDefined()
      expect(orchNode?.type).toBe('orchestratorNode')
    })

    it('should create agent nodes', () => {
      const system = createMinimalSystem(sampleAgents)
      const nodes = buildNodes(system)
      const agentNodes = nodes.filter((n) => n.type === 'agentNode')
      expect(agentNodes).toHaveLength(2)
    })

    it('should embed tools in agent data instead of separate tool nodes', () => {
      const system = createMinimalSystem(sampleAgents)
      const nodes = buildNodes(system)
      // No separate tool nodes
      const toolNodes = nodes.filter((n) => n.type === 'toolNode')
      expect(toolNodes).toHaveLength(0)
      // Tools are embedded in agent node data
      const agentNode = nodes.find((n) => n.id === 'agent-001')
      const tools = (agentNode?.data as Record<string, unknown>)['tools'] as unknown[]
      expect(tools).toHaveLength(1)
    })

    it('should filter out memory and knowledge type shared resources', () => {
      const system: AgentSystem = {
        ...createMinimalSystem([sampleAgents[0]!]),
        sharedResources: [
          {
            id: 'res-1',
            type: 'memory',
            name: 'Context Store',
            accessBy: ['orch-main', 'agent-001'],
          },
          {
            id: 'res-2',
            type: 'knowledge',
            name: 'Knowledge Base',
            accessBy: ['agent-001'],
          },
        ],
      }
      const nodes = buildNodes(system)
      const resourceNodes = nodes.filter((n) => n.type === 'resourceNode')
      expect(resourceNodes).toHaveLength(0)
    })

    it('should create resource nodes for non-filtered types (database, cache)', () => {
      const system: AgentSystem = {
        ...createMinimalSystem([sampleAgents[0]!]),
        sharedResources: [
          {
            id: 'res-db',
            type: 'database',
            name: 'Ticket DB',
            accessBy: ['orch-main', 'agent-001'],
          },
        ],
      }
      const nodes = buildNodes(system)
      const resourceNodes = nodes.filter((n) => n.type === 'resourceNode')
      expect(resourceNodes).toHaveLength(1)
    })

    it('should include all expected nodes (no tool nodes)', () => {
      const system = createMinimalSystem(sampleAgents)
      const nodes = buildNodes(system)
      // 1 user + 1 orchestrator + 2 agents = 4 (no tool nodes)
      expect(nodes).toHaveLength(4)
    })

    it('should set hasCdp on orchestrator when agents have context source inputs', () => {
      const agentsWithContext: Agent[] = [
        {
          ...sampleAgents[0]!,
          inputs: [{ source: 'context', type: 'string', required: true, name: 'Session' }],
        },
      ]
      const system = createMinimalSystem(agentsWithContext)
      const nodes = buildNodes(system)
      const orchNode = nodes.find((n) => n.type === 'orchestratorNode')
      expect(orchNode).toBeDefined()
      expect((orchNode?.data as Record<string, unknown>)['hasCdp']).toBe(true)
    })

    it('should set hasCdp on orchestrator when orchestrator has context source inputs', () => {
      const system: AgentSystem = {
        metadata: { title: 'Test' },
        orchestrator: {
          id: 'orch-main',
          name: 'Orchestrator',
          description: 'Test orchestrator',
          reasoning: { capabilities: ['Analyze'] },
          inputs: [
            { source: 'user', type: 'string', required: true, name: 'Message' },
            { source: 'context', type: 'object', required: false, name: 'History' },
          ],
          outputs: [{ target: 'user', type: 'string', name: 'Response' }],
        },
        agents: [sampleAgents[0]!],
      }
      const nodes = buildNodes(system)
      const orchNode = nodes.find((n) => n.type === 'orchestratorNode')
      expect(orchNode).toBeDefined()
      expect((orchNode?.data as Record<string, unknown>)['hasCdp']).toBe(true)
    })

    it('should assign unique agentColor to each agent node', () => {
      const system = createMinimalSystem(sampleAgents)
      const nodes = buildNodes(system)
      const agentNodes = nodes.filter((n) => n.type === 'agentNode')
      const colors = agentNodes.map((n) => (n.data as Record<string, unknown>)['agentColor'])
      // Each agent should have a color
      colors.forEach((c: unknown) => expect(c).toBeDefined())
      // Agents in different categories should have different colors
      expect(colors[0]).not.toBe(colors[1])
    })
  })

  describe('buildEdges', () => {
    it('should create user-to-orchestrator edge', () => {
      const system = createMinimalSystem([sampleAgents[0]!])
      const edges = buildEdges(system)
      const edge = edges.find((e) => e.id === 'user-to-orch')
      expect(edge).toBeDefined()
      expect(edge?.source).toBe('user')
      expect(edge?.target).toBe('orch-main')
    })

    it('should create orchestrator-to-user final output edge', () => {
      const system = createMinimalSystem([sampleAgents[0]!])
      const edges = buildEdges(system)
      const edge = edges.find((e) => e.id === 'orch-to-user')
      expect(edge).toBeDefined()
      expect(edge?.source).toBe('orch-main')
      expect(edge?.target).toBe('user')
    })

    it('should create inter-agent data flow edges', () => {
      const system = createMinimalSystem(sampleAgents)
      const edges = buildEdges(system)
      // agent-002 has input from agent-001
      const interAgentEdge = edges.find((e) => e.source === 'agent-001' && e.target === 'agent-002')
      expect(interAgentEdge).toBeDefined()
    })

    it('should not create delegation or result edges (implicit in hierarchy)', () => {
      const system = createMinimalSystem(sampleAgents)
      const edges = buildEdges(system)
      const delegationEdges = edges.filter((e) => e.id.startsWith('orch-to-agent'))
      expect(delegationEdges).toHaveLength(0)
      const returnEdges = edges.filter((e) => e.id.startsWith('agent-') && e.id.endsWith('-to-orch'))
      expect(returnEdges).toHaveLength(0)
    })

    it('should not create agent-to-tool edges (tools embedded)', () => {
      const system = createMinimalSystem(sampleAgents)
      const edges = buildEdges(system)
      const toolEdges = edges.filter((e) => e.id.includes('-to-tool-'))
      expect(toolEdges).toHaveLength(0)
    })

    it('should skip resource connection edges for memory and knowledge types', () => {
      const system: AgentSystem = {
        ...createMinimalSystem(sampleAgents),
        sharedResources: [
          {
            id: 'res-1',
            type: 'memory',
            name: 'Context Store',
            accessPattern: 'read-write',
            accessBy: ['orch-main', 'agent-001'],
          },
        ],
      }
      const edges = buildEdges(system)
      const resourceEdges = edges.filter((e) => e.target === 'res-1')
      expect(resourceEdges).toHaveLength(0)
    })

    it('should create resource connection edges for database type', () => {
      const system: AgentSystem = {
        ...createMinimalSystem(sampleAgents),
        sharedResources: [
          {
            id: 'res-db',
            type: 'database',
            name: 'Ticket DB',
            accessPattern: 'read-write',
            accessBy: ['orch-main', 'agent-001'],
          },
        ],
      }
      const edges = buildEdges(system)
      const resourceEdges = edges.filter((e) => e.target === 'res-db')
      expect(resourceEdges).toHaveLength(2)
    })

    it('should include arrows on all edges', () => {
      const system = createMinimalSystem(sampleAgents)
      const edges = buildEdges(system)
      edges.forEach((edge: { markerEnd?: unknown }) => {
        expect(edge.markerEnd).toBeDefined()
      })
    })
  })

  describe('deduplicateInputs', () => {
    it('should identify shared inputs across agents', () => {
      const agents: Agent[] = [
        {
          id: 'a1',
          category: 'data-collection',
          name: 'A1',
          purpose: 'P',
          inputs: [{ source: 'context', type: 'string', required: true, name: 'User ID' }],
          tools: [],
          reasoning: { strategies: [] },
          outputs: [],
          structuredOutputs: [],
        },
        {
          id: 'a2',
          category: 'action',
          name: 'A2',
          purpose: 'P',
          inputs: [{ source: 'context', type: 'string', required: true, name: 'User ID' }],
          tools: [],
          reasoning: { strategies: [] },
          outputs: [],
          structuredOutputs: [],
        },
      ]

      const shared = deduplicateInputs(agents)
      expect(shared).toHaveLength(1)
      expect(shared[0]?.name).toBe('User ID')
      expect(shared[0]?.connectedAgents).toEqual(['a1', 'a2'])
    })

    it('should not deduplicate unique inputs', () => {
      const agents: Agent[] = [
        {
          id: 'a1',
          category: 'data-collection',
          name: 'A1',
          purpose: 'P',
          inputs: [{ source: 'context', type: 'string', required: true, name: 'Input A' }],
          tools: [],
          reasoning: { strategies: [] },
          outputs: [],
          structuredOutputs: [],
        },
        {
          id: 'a2',
          category: 'action',
          name: 'A2',
          purpose: 'P',
          inputs: [{ source: 'orchestrator', type: 'string', required: true, name: 'Input B' }],
          tools: [],
          reasoning: { strategies: [] },
          outputs: [],
          structuredOutputs: [],
        },
      ]

      const shared = deduplicateInputs(agents)
      expect(shared).toHaveLength(0) // No shared inputs
    })
  })
})
