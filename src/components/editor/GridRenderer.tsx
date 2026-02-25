import { useMemo } from 'react'
import type { AgentSystem, Agent, AgentInput, AgentCategory } from '@/types/agentSystem'
import { AGENT_CATEGORIES } from '@/lib/constants'
import { GridUserCard } from './GridUserCard'
import { GridOrchestratorCard } from './GridOrchestratorCard'
import { GridAgentCard } from './GridAgentCard'
import { ConnectionLegend } from './ConnectionLegend'

interface GridRendererProps {
  parsedData: AgentSystem
}

interface AgentNumbering {
  number: number
  agent: Agent
  color: string
}

interface ConnectionInfo {
  receivesFrom: Array<{ id: string; name: string; number: number }>
  sendsTo: Array<{ id: string; name: string; number: number }>
}

/** Category display order */
const CATEGORY_ORDER: AgentCategory[] = ['data-collection', 'action', 'knowledge', 'clarification']

export function GridRenderer({ parsedData }: GridRendererProps) {
  // Build agent numbering + color assignment
  const agentNumbering = useMemo<Map<string, AgentNumbering>>(() => {
    const map = new Map<string, AgentNumbering>()
    const categoryIndexMap = new Map<string, number>()
    let globalNumber = 1

    for (const agent of parsedData.agents) {
      const catKey = agent.category as AgentCategory
      const catIndex = categoryIndexMap.get(catKey) ?? 0
      categoryIndexMap.set(catKey, catIndex + 1)

      const catConfig = AGENT_CATEGORIES[catKey]
      const shades = catConfig?.shades ?? [catConfig?.color ?? '#60A5FA']
      const agentColor = shades[catIndex % shades.length]

      map.set(agent.id, {
        number: globalNumber,
        agent,
        color: agentColor,
      })
      globalNumber++
    }
    return map
  }, [parsedData.agents])

  // Build connection maps
  const connectionMap = useMemo<Map<string, ConnectionInfo>>(() => {
    const map = new Map<string, ConnectionInfo>()

    // Initialize all agents
    for (const agent of parsedData.agents) {
      map.set(agent.id, { receivesFrom: [], sendsTo: [] })
    }

    // Build connections from input sources
    for (const agent of parsedData.agents) {
      for (const input of agent.inputs) {
        const sources = input.source.split('/').map((s: string) => s.trim())
        for (const src of sources) {
          if (src.startsWith('agent-') && agentNumbering.has(src)) {
            const srcInfo = agentNumbering.get(src)
            const targetInfo = agentNumbering.get(agent.id)
            if (srcInfo && targetInfo) {
              // Add "receives from" to current agent
              const targetConn = map.get(agent.id)
              if (targetConn && !targetConn.receivesFrom.some((c) => c.id === src)) {
                targetConn.receivesFrom.push({
                  id: src,
                  name: srcInfo.agent.name,
                  number: srcInfo.number,
                })
              }
              // Add "sends to" to source agent
              const srcConn = map.get(src)
              if (srcConn && !srcConn.sendsTo.some((c) => c.id === agent.id)) {
                srcConn.sendsTo.push({
                  id: agent.id,
                  name: targetInfo.agent.name,
                  number: targetInfo.number,
                })
              }
            }
          }
        }
      }
    }

    return map
  }, [parsedData.agents, agentNumbering])

  // Build workflow step map from exampleFlow
  const workflowStepMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>()
    if (parsedData.exampleFlow) {
      for (const step of parsedData.exampleFlow) {
        if (!map.has(step.agent)) {
          map.set(step.agent, step.order)
        }
      }
    }
    return map
  }, [parsedData.exampleFlow])

  const totalSteps = parsedData.exampleFlow?.length ?? 0

  // Group agents by category
  const agentsByCategory = useMemo(() => {
    const groups = new Map<AgentCategory, Agent[]>()
    for (const cat of CATEGORY_ORDER) {
      const agents = parsedData.agents.filter((a: Agent) => a.category === cat)
      if (agents.length > 0) {
        groups.set(cat, agents)
      }
    }
    return groups
  }, [parsedData.agents])

  // Detect CDP
  const hasCdp = parsedData.agents.some((agent: Agent) =>
    agent.inputs.some((input: AgentInput) => input.source.includes('context'))
  ) || parsedData.orchestrator.inputs.some((input: AgentInput) => input.source.includes('context'))

  // Agent refs for legend
  const agentRefs = useMemo(() => {
    return Array.from(agentNumbering.entries()).map(([id, info]: [string, AgentNumbering]) => ({
      id,
      name: info.agent.name,
      number: info.number,
    }))
  }, [agentNumbering])

  return (
    <div
      id="grid-diagram-container"
      className="h-full overflow-auto bg-stone-50 p-6"
    >
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header row: User + Orchestrator */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GridUserCard userJourney={parsedData.userJourney} />
          <GridOrchestratorCard
            orchestrator={parsedData.orchestrator}
            hasCdp={hasCdp}
          />
        </div>

        {/* Agent groups by category */}
        {Array.from(agentsByCategory.entries()).map(([category, agents]: [AgentCategory, Agent[]]) => {
          const catConfig = AGENT_CATEGORIES[category]
          return (
            <div key={category}>
              {/* Category header */}
              <div
                className="flex items-center gap-3 mb-3 pl-3 border-l-4"
                style={{ borderLeftColor: catConfig.color }}
              >
                <h2 className="text-[15px] font-bold text-gray-700 uppercase tracking-wide">
                  {catConfig.label}
                </h2>
                <span className="text-[12px] text-gray-400 font-medium">
                  {agents.length} agent{agents.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Agent grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {agents.map((agent: Agent) => {
                  const numbering = agentNumbering.get(agent.id)
                  const connections = connectionMap.get(agent.id) ?? { receivesFrom: [], sendsTo: [] }
                  const step = workflowStepMap.get(agent.id)

                  if (!numbering) return null

                  return (
                    <GridAgentCard
                      key={agent.id}
                      agent={agent}
                      agentNumber={numbering.number}
                      agentColor={numbering.color}
                      connections={connections}
                      workflowStep={step}
                      totalSteps={totalSteps > 0 ? totalSteps : undefined}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Connection Legend / Workflow Summary */}
        <ConnectionLegend
          agentRefs={agentRefs}
          exampleFlow={parsedData.exampleFlow}
          orchestratorName={parsedData.orchestrator.name}
        />
      </div>
    </div>
  )
}
