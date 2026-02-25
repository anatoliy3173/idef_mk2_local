export interface Metadata {
  title: string
  author?: string
  version?: string
  created?: string
  description?: string
}

export interface ContextEntry {
  key: string
  value: string
}

export interface UserJourney {
  scenario: string
  initialContext?: ContextEntry[]
  expectedOutcome?: string
}

export interface AgentInput {
  source: string
  type: string
  required: boolean
  name: string
  description?: string
  defaultValue?: string
}

export interface AgentOutput {
  target?: string
  type: string
  name: string
  description?: string
}

export interface AgentTool {
  id: string
  type: string
  name: string
  endpoint?: string
  method?: string
  authentication?: string
  description?: string
  provider?: string
  model?: string
}

export interface StructuredOutputField {
  name: string
  type: string
  required: boolean
  description?: string
}

export interface AgentReasoning {
  strategies: string[]
  outputSchema?: string
}

export type AgentCategory = 'data-collection' | 'action' | 'knowledge' | 'clarification'

export interface Agent {
  id: string
  category: AgentCategory
  name: string
  purpose: string
  model?: string
  inputs: AgentInput[]
  tools: AgentTool[]
  reasoning: AgentReasoning
  outputs: AgentOutput[]
  structuredOutputs: StructuredOutputField[]
}

export interface OrchestratorReasoning {
  capabilities: string[]
}

export interface Orchestrator {
  id: string
  name: string
  description: string
  reasoning: OrchestratorReasoning
  inputs: AgentInput[]
  outputs: AgentOutput[]
}

export interface SharedResource {
  id: string
  type: string
  name: string
  description?: string
  technology?: string
  accessPattern?: string
  accessBy: string[]
}

export interface ExampleStep {
  order: number
  agent: string
  description: string
}

export interface AgentSystem {
  metadata: Metadata
  userJourney?: UserJourney
  orchestrator: Orchestrator
  agents: Agent[]
  sharedResources?: SharedResource[]
  exampleFlow?: ExampleStep[]
}

export interface ValidationError {
  type: 'error'
  message: string
  path?: string
  line?: number
}

export interface ValidationWarning {
  type: 'warning'
  message: string
  path?: string
}

export interface ParseResult {
  data: AgentSystem | null
  errors: ValidationError[]
  warnings: ValidationWarning[]
}
