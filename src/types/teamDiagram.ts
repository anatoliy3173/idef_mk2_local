export const TYPE_COLORS: Record<string, string> = {
  orchestrator: '#7c3aed',
  classifier:   '#2563eb',
  analyzer:     '#2563eb',
  advisor:      '#059669',
  executor:     '#0891b2',
  fallback:     '#ea580c',
  infra:        '#6b7280',
  collaborator: '#2563eb',
  RAG:          '#0891b2',
}

export interface TeamAgent {
  id: string
  name: string
  model: string
  type: string
  role: string
  color: string
  tools: string[]
  output: string[]           // from <o> tags
  structuredOutput: string[] // from <stO> / <sto> tags
}

export interface TeamConnection {
  from: string
  to: string
  label: string
}

export interface TeamMeta {
  name: string
  description: string
}

export interface TeamDiagram {
  meta: TeamMeta
  agents: TeamAgent[]
  connections: TeamConnection[]
}

// Layout types
export interface AgentPosition {
  id: string
  x: number
  y: number
}

export interface LayoutResult {
  positions: Record<string, AgentPosition>
  tw: number               // total canvas width
  th: number               // total canvas height
  standaloneY: number      // y of standalone separator line (-1 if none)
  standaloneAgentIds: string[]
  connectedAgentIds: string[]
}
