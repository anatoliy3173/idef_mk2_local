import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type {
  AgentSystem,
  Agent,
  AgentInput,
  AgentOutput,
  AgentTool,
  StructuredOutputField,
  Orchestrator,
  SharedResource,
  ExampleStep,
  ParseResult,
  ValidationError,
  ValidationWarning,
  ContextEntry,
} from '@/types/agentSystem'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  trimValues: true,
})

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value
  return [value]
}

function parseInput(raw: Record<string, unknown>): AgentInput {
  return {
    source: (raw['@_source'] as string) ?? 'unknown',
    type: (raw['@_type'] as string) ?? 'string',
    required: raw['@_required'] === true || raw['@_required'] === 'true',
    name: typeof raw['name'] === 'string' ? raw['name'] : String(raw['name'] ?? ''),
    description: typeof raw['description'] === 'string' ? raw['description'] : undefined,
    defaultValue: typeof raw['default'] === 'string' ? raw['default'] : (raw['default'] !== undefined ? String(raw['default']) : undefined),
  }
}

function parseOutput(raw: Record<string, unknown>): AgentOutput {
  return {
    target: typeof raw['@_target'] === 'string' ? raw['@_target'] : undefined,
    type: (raw['@_type'] as string) ?? 'string',
    name: typeof raw['name'] === 'string' ? raw['name'] : String(raw['name'] ?? ''),
    description: typeof raw['description'] === 'string' ? raw['description'] : undefined,
  }
}

function parseTool(raw: Record<string, unknown>): AgentTool {
  return {
    id: (raw['@_id'] as string) ?? '',
    type: (raw['@_type'] as string) ?? 'api',
    name: typeof raw['name'] === 'string' ? raw['name'] : String(raw['name'] ?? ''),
    endpoint: typeof raw['endpoint'] === 'string' ? raw['endpoint'] : undefined,
    method: typeof raw['method'] === 'string' ? raw['method'] : undefined,
    authentication: typeof raw['authentication'] === 'string' ? raw['authentication'] : undefined,
    description: typeof raw['description'] === 'string' ? raw['description'] : undefined,
    provider: typeof raw['provider'] === 'string' ? raw['provider'] : undefined,
    model: typeof raw['model'] === 'string' ? raw['model'] : undefined,
  }
}

function parseOrchestrator(raw: Record<string, unknown>): Orchestrator {
  const reasoning = raw['reasoning'] as Record<string, unknown> | undefined
  const capabilities = reasoning ? ensureArray(reasoning['capability'] as string | string[]) : []

  const inputsRaw = raw['inputs'] as Record<string, unknown> | undefined
  const outputsRaw = raw['outputs'] as Record<string, unknown> | undefined

  return {
    id: (raw['@_id'] as string) ?? 'orch-main',
    name: typeof raw['name'] === 'string' ? raw['name'] : 'Orchestrator',
    description: typeof raw['description'] === 'string' ? raw['description'] : '',
    reasoning: { capabilities },
    inputs: inputsRaw ? ensureArray(inputsRaw['input'] as Record<string, unknown> | Record<string, unknown>[]).map((i: Record<string, unknown>) => parseInput(i)) : [],
    outputs: outputsRaw ? ensureArray(outputsRaw['output'] as Record<string, unknown> | Record<string, unknown>[]).map((o: Record<string, unknown>) => parseOutput(o)) : [],
  }
}

function parseStructuredOutputField(raw: Record<string, unknown>): StructuredOutputField {
  return {
    name: typeof raw['name'] === 'string' ? raw['name'] : String(raw['name'] ?? ''),
    type: (raw['@_type'] as string) ?? 'string',
    required: raw['@_required'] === true || raw['@_required'] === 'true',
    description: typeof raw['description'] === 'string' ? raw['description'] : undefined,
  }
}

function parseAgent(raw: Record<string, unknown>): Agent {
  const reasoningRaw = raw['reasoning'] as Record<string, unknown> | undefined
  const strategies = reasoningRaw ? ensureArray(reasoningRaw['strategy'] as string | string[]) : []
  const outputSchema = reasoningRaw?.['outputSchema'] as Record<string, unknown> | undefined
  const schemaText = outputSchema ? (typeof outputSchema['#text'] === 'string' ? outputSchema['#text'] : JSON.stringify(outputSchema)) : undefined

  const inputsRaw = raw['inputs'] as Record<string, unknown> | undefined
  const outputsRaw = raw['outputs'] as Record<string, unknown> | undefined
  const toolsRaw = raw['tools'] as Record<string, unknown> | undefined
  const structuredOutputsRaw = raw['structuredOutputs'] as Record<string, unknown> | undefined

  const category = (raw['@_category'] as string) ?? 'data-collection'
  const validCategories = ['data-collection', 'action', 'knowledge', 'clarification']
  const safeCategory = validCategories.includes(category) ? category : 'data-collection'

  return {
    id: (raw['@_id'] as string) ?? '',
    category: safeCategory as Agent['category'],
    name: typeof raw['name'] === 'string' ? raw['name'] : String(raw['name'] ?? ''),
    purpose: typeof raw['purpose'] === 'string' ? raw['purpose'] : '',
    model: typeof raw['model'] === 'string' ? raw['model'] : undefined,
    inputs: inputsRaw ? ensureArray(inputsRaw['input'] as Record<string, unknown> | Record<string, unknown>[]).map((i: Record<string, unknown>) => parseInput(i)) : [],
    tools: toolsRaw ? ensureArray(toolsRaw['tool'] as Record<string, unknown> | Record<string, unknown>[]).map((t: Record<string, unknown>) => parseTool(t)) : [],
    reasoning: { strategies, outputSchema: schemaText },
    outputs: outputsRaw ? ensureArray(outputsRaw['output'] as Record<string, unknown> | Record<string, unknown>[]).map((o: Record<string, unknown>) => parseOutput(o)) : [],
    structuredOutputs: structuredOutputsRaw
      ? ensureArray(structuredOutputsRaw['field'] as Record<string, unknown> | Record<string, unknown>[]).map((f: Record<string, unknown>) => parseStructuredOutputField(f))
      : [],
  }
}

function parseSharedResource(raw: Record<string, unknown>): SharedResource {
  const accessBy = typeof raw['accessBy'] === 'string'
    ? raw['accessBy'].split(',').map((s: string) => s.trim())
    : []

  return {
    id: (raw['@_id'] as string) ?? '',
    type: (raw['@_type'] as string) ?? 'memory',
    name: typeof raw['name'] === 'string' ? raw['name'] : String(raw['name'] ?? ''),
    description: typeof raw['description'] === 'string' ? raw['description'] : undefined,
    technology: typeof raw['technology'] === 'string' ? raw['technology'] : undefined,
    accessPattern: typeof raw['accessPattern'] === 'string' ? raw['accessPattern'] : undefined,
    accessBy,
  }
}

function parseExampleStep(raw: Record<string, unknown>): ExampleStep {
  return {
    order: typeof raw['@_order'] === 'number' ? raw['@_order'] : 0,
    agent: (raw['@_agent'] as string) ?? '',
    description: typeof raw['#text'] === 'string' ? raw['#text'] : String(raw['#text'] ?? ''),
  }
}

function validateSemantics(system: AgentSystem): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // Check unique agent IDs
  const agentIds = new Set<string>()
  for (const agent of system.agents) {
    if (agentIds.has(agent.id)) {
      errors.push({ type: 'error', message: `Duplicate agent ID: ${agent.id}` })
    }
    agentIds.add(agent.id)
  }

  // Check that input sources reference valid agents
  const validSources = new Set<string>(['user', 'orchestrator', 'context', ...agentIds])
  for (const agent of system.agents) {
    for (const input of agent.inputs) {
      const sources = input.source.split('/').map((s: string) => s.trim())
      for (const src of sources) {
        if (!validSources.has(src)) {
          errors.push({
            type: 'error',
            message: `Agent "${agent.name}" input "${input.name}" references invalid source: "${src}"`,
          })
        }
      }
    }
  }

  // Check unique tool IDs within each agent
  for (const agent of system.agents) {
    const toolIds = new Set<string>()
    for (const tool of agent.tools) {
      if (tool.id && toolIds.has(tool.id)) {
        errors.push({
          type: 'error',
          message: `Duplicate tool ID in agent "${agent.name}": ${tool.id}`,
        })
      }
      if (tool.id) toolIds.add(tool.id)
    }
  }

  // Orchestrator should have reasoning capabilities
  if (system.orchestrator.reasoning.capabilities.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'Orchestrator has no reasoning capabilities specified',
    })
  }

  // Each agent should have at least one input and output
  for (const agent of system.agents) {
    if (agent.inputs.length === 0) {
      warnings.push({
        type: 'warning',
        message: `Agent "${agent.name}" has no inputs`,
      })
    }
    if (agent.outputs.length === 0) {
      warnings.push({
        type: 'warning',
        message: `Agent "${agent.name}" has no outputs`,
      })
    }
  }

  // Knowledge agents should have vector-search tool
  for (const agent of system.agents) {
    if (agent.category === 'knowledge') {
      const hasVectorSearch = agent.tools.some((t: AgentTool) => t.type === 'vector-search')
      if (!hasVectorSearch) {
        warnings.push({
          type: 'warning',
          message: `Knowledge agent "${agent.name}" has no vector-search tool`,
        })
      }
    }
  }

  // Check agent count limit
  if (system.agents.length > 50) {
    warnings.push({
      type: 'warning',
      message: `System has ${system.agents.length} agents. Performance may be impacted for more than 50 agents.`,
    })
  }

  // Warn on agents with empty name or id
  for (const agent of system.agents) {
    if (!agent.id.trim()) {
      warnings.push({
        type: 'warning',
        message: `An agent has an empty id attribute`,
      })
    }
    if (!agent.name.trim()) {
      warnings.push({
        type: 'warning',
        message: `Agent "${agent.id}" has an empty name`,
      })
    }
  }

  // Warn on orchestrator without description
  if (!system.orchestrator.description.trim()) {
    warnings.push({
      type: 'warning',
      message: 'Orchestrator has no description',
    })
  }

  // Validate tool types against known values
  const KNOWN_TOOL_TYPES = new Set(['api', 'vector-search', 'llm', 'database', 'function'])
  for (const agent of system.agents) {
    for (const tool of agent.tools) {
      if (!KNOWN_TOOL_TYPES.has(tool.type)) {
        warnings.push({
          type: 'warning',
          message: `Agent "${agent.name}" tool "${tool.name}" has unknown type "${tool.type}" (expected: ${[...KNOWN_TOOL_TYPES].join(', ')})`,
        })
      }
    }
  }

  // Validate shared resource types
  const KNOWN_RESOURCE_TYPES = new Set(['database', 'cache', 'api', 'queue', 'storage', 'memory', 'knowledge'])
  if (system.sharedResources) {
    for (const resource of system.sharedResources) {
      if (!KNOWN_RESOURCE_TYPES.has(resource.type)) {
        warnings.push({
          type: 'warning',
          message: `Resource "${resource.name}" has unknown type "${resource.type}" (expected: ${[...KNOWN_RESOURCE_TYPES].join(', ')})`,
        })
      }
    }
  }

  // Validate exampleFlow step agents reference valid agent IDs
  if (system.exampleFlow) {
    const allIds = new Set<string>([system.orchestrator.id, ...agentIds, 'user'])
    for (const step of system.exampleFlow) {
      if (step.agent && !allIds.has(step.agent)) {
        warnings.push({
          type: 'warning',
          message: `Example flow step ${step.order} references unknown agent "${step.agent}"`,
        })
      }
    }
  }

  return { errors, warnings }
}

export function parseXml(xmlString: string): ParseResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (!xmlString.trim()) {
    return { data: null, errors: [], warnings: [] }
  }

  // Step 1: XML structure validation
  const validationResult = XMLValidator.validate(xmlString)
  if (validationResult !== true) {
    const err = validationResult as { err: { msg: string; line: number; col: number } }
    errors.push({
      type: 'error',
      message: err.err.msg,
      line: err.err.line,
    })
    return { data: null, errors, warnings }
  }

  // Step 2: Parse XML
  let parsed: Record<string, unknown>
  try {
    parsed = parser.parse(xmlString) as Record<string, unknown>
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown parsing error'
    errors.push({ type: 'error', message: `XML parsing failed: ${message}` })
    return { data: null, errors, warnings }
  }

  // Step 3: Check root element
  const root = parsed['agentSystem'] as Record<string, unknown> | undefined
  if (!root) {
    errors.push({ type: 'error', message: 'Missing root element <agentSystem>' })
    return { data: null, errors, warnings }
  }

  // Step 4: Parse metadata
  const metadataRaw = root['metadata'] as Record<string, unknown> | undefined
  if (!metadataRaw) {
    errors.push({ type: 'error', message: 'Missing <metadata> section' })
    return { data: null, errors, warnings }
  }

  const metadata = {
    title: typeof metadataRaw['title'] === 'string' ? metadataRaw['title'] : String(metadataRaw['title'] ?? 'Untitled'),
    author: typeof metadataRaw['author'] === 'string' ? metadataRaw['author'] : undefined,
    version: typeof metadataRaw['version'] === 'string' ? metadataRaw['version'] : (metadataRaw['version'] !== undefined ? String(metadataRaw['version']) : undefined),
    created: typeof metadataRaw['created'] === 'string' ? metadataRaw['created'] : undefined,
    description: typeof metadataRaw['description'] === 'string' ? metadataRaw['description'] : undefined,
  }

  // Step 5: Parse user journey (optional)
  const journeyRaw = root['userJourney'] as Record<string, unknown> | undefined
  const userJourney = journeyRaw ? {
    scenario: typeof journeyRaw['scenario'] === 'string' ? journeyRaw['scenario'] : '',
    initialContext: journeyRaw['initialContext']
      ? ensureArray((journeyRaw['initialContext'] as Record<string, unknown>)['context'] as Record<string, unknown> | Record<string, unknown>[]).map(
          (c: Record<string, unknown>): ContextEntry => ({
            key: (c['@_key'] as string) ?? '',
            value: typeof c['#text'] === 'string' ? c['#text'] : String(c['#text'] ?? ''),
          })
        )
      : undefined,
    expectedOutcome: typeof journeyRaw['expectedOutcome'] === 'string' ? journeyRaw['expectedOutcome'] : undefined,
  } : undefined

  // Step 6: Parse orchestrator
  const orchRaw = root['orchestrator'] as Record<string, unknown> | undefined
  if (!orchRaw) {
    errors.push({ type: 'error', message: 'Missing <orchestrator> section' })
    return { data: null, errors, warnings }
  }
  const orchestrator = parseOrchestrator(orchRaw)

  // Step 7: Parse agents
  const agentsRaw = root['agents'] as Record<string, unknown> | undefined
  if (!agentsRaw) {
    errors.push({ type: 'error', message: 'Missing <agents> section' })
    return { data: null, errors, warnings }
  }

  const agentList = ensureArray(agentsRaw['agent'] as Record<string, unknown> | Record<string, unknown>[])
  if (agentList.length === 0) {
    errors.push({ type: 'error', message: 'At least one agent must be defined' })
    return { data: null, errors, warnings }
  }

  const agents = agentList.map((a: Record<string, unknown>) => parseAgent(a))

  // Step 8: Parse shared resources (optional)
  const resourcesRaw = root['sharedResources'] as Record<string, unknown> | undefined
  const sharedResources = resourcesRaw
    ? ensureArray(resourcesRaw['resource'] as Record<string, unknown> | Record<string, unknown>[]).map(
        (r: Record<string, unknown>) => parseSharedResource(r)
      )
    : undefined

  // Step 9: Parse example flow (optional)
  const flowRaw = root['exampleFlow'] as Record<string, unknown> | undefined
  const exampleFlow = flowRaw
    ? ensureArray(flowRaw['step'] as Record<string, unknown> | Record<string, unknown>[]).map(
        (s: Record<string, unknown>) => parseExampleStep(s)
      )
    : undefined

  const system: AgentSystem = {
    metadata,
    userJourney,
    orchestrator,
    agents,
    sharedResources,
    exampleFlow,
  }

  // Step 10: Semantic validation
  const semanticResult = validateSemantics(system)
  errors.push(...semanticResult.errors)
  warnings.push(...semanticResult.warnings)

  if (errors.length > 0) {
    return { data: null, errors, warnings }
  }

  return { data: system, errors: [], warnings }
}
