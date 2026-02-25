import { Wrench, Search, Cpu, BookOpen, ArrowRight, ArrowLeft } from 'lucide-react'
import type { Agent, AgentTool, AgentInput, AgentOutput, StructuredOutputField } from '@/types/agentSystem'

interface ConnectionInfo {
  receivesFrom: Array<{ id: string; name: string; number: number }>
  sendsTo: Array<{ id: string; name: string; number: number }>
}

interface GridAgentCardProps {
  agent: Agent
  agentNumber: number
  agentColor: string
  connections: ConnectionInfo
  workflowStep?: number
  totalSteps?: number
}

/* Tool type → badge colour + icon */
const TOOL_TYPE_CONFIG: Record<string, { bg: string; text: string; icon: typeof Wrench }> = {
  api: { bg: 'bg-orange-100', text: 'text-orange-700', icon: Wrench },
  'vector-search': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Search },
  llm: { bg: 'bg-violet-100', text: 'text-violet-700', icon: Cpu },
}

function getToolConfig(toolType: string): { bg: string; text: string; icon: typeof Wrench } {
  return TOOL_TYPE_CONFIG[toolType] ?? TOOL_TYPE_CONFIG['api']!
}

export function GridAgentCard({
  agent,
  agentNumber,
  agentColor,
  connections,
  workflowStep,
  totalSteps,
}: GridAgentCardProps) {
  const isKnowledge = agent.category === 'knowledge'
  const displayTools = isKnowledge
    ? agent.tools.filter((t: AgentTool) => t.type !== 'llm')
    : agent.tools

  // Resolve LLM model: prefer agent-level model, fallback to first LLM tool's model
  const resolvedModel: string | undefined = agent.model
    ?? agent.tools.find((t: AgentTool) => t.type === 'llm' && t.model)?.model

  return (
    <div
      className="bg-white rounded-xl shadow-lg border-2 overflow-hidden h-full flex flex-col"
      style={{ borderColor: agentColor }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 text-white"
        style={{
          background: `linear-gradient(135deg, ${agentColor}, ${agentColor}dd)`,
        }}
      >
        <div className="flex items-start gap-2">
          {/* Number badge */}
          <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center shrink-0 text-sm font-bold">
            {agentNumber}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-[16px] break-words leading-tight">
                {agent.name}
              </span>
              {resolvedModel && (
                <span className="inline-flex items-center gap-1 bg-white/25 text-white px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shrink-0 mt-0.5">
                  <Cpu className="w-2.5 h-2.5" />
                  {resolvedModel}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[10px] bg-white/30 px-1.5 py-0.5 rounded font-mono">
                {agent.id}
              </span>
              {workflowStep !== undefined && totalSteps !== undefined && (
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-medium">
                  Step {workflowStep} of {totalSteps}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RAG Knowledge Base badge */}
      {isKnowledge && (
        <div className="px-4 py-1.5 bg-cyan-50 border-b border-cyan-100 flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
          <span className="text-[12px] font-semibold text-cyan-700">RAG Knowledge Base</span>
        </div>
      )}

      {/* Purpose */}
      <div className="px-4 py-2 text-[13px] text-gray-600 border-b border-gray-100 leading-snug">
        {agent.purpose}
      </div>

      {/* Inputs (compact) */}
      {agent.inputs.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
            Inputs
          </div>
          <ul className="text-[13px] space-y-0">
            {agent.inputs.slice(0, 4).map((input: AgentInput, i: number) => (
              <li key={i} className="text-gray-600">
                <span className="text-gray-400">&#8226;</span> {input.name}{' '}
                <span className="text-gray-400 text-[11px]">({input.source})</span>
              </li>
            ))}
            {agent.inputs.length > 4 && (
              <li className="text-gray-400 text-[11px] italic">
                +{agent.inputs.length - 4} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Tools (compact) */}
      {displayTools.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Tools
          </div>
          <div className="space-y-1">
            {displayTools.map((tool: AgentTool, i: number) => {
              const cfg = getToolConfig(tool.type)
              const ToolIcon = cfg.icon
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold uppercase ${cfg.bg} ${cfg.text}`}>
                    <ToolIcon className="w-2.5 h-2.5" />
                    {tool.type}
                  </span>
                  <span className="text-[13px] font-medium text-gray-700 truncate">
                    {tool.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reasoning (compact) */}
      {(agent.reasoning?.strategies ?? []).length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
            Reasoning
          </div>
          <div className="text-[13px] text-gray-600 space-y-0">
            {agent.reasoning.strategies.slice(0, 2).map((s: string, i: number) => (
              <p key={i}>{s}</p>
            ))}
          </div>
        </div>
      )}

      {/* Output */}
      {agent.outputs.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="text-[11px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
            Output
          </div>
          <div className="text-[13px] text-gray-600">
            {agent.outputs.map((o: AgentOutput, i: number) => (
              <p key={i}>&rarr; {o.name}</p>
            ))}
          </div>
        </div>
      )}

      {/* Structured Outputs */}
      {agent.structuredOutputs.length > 0 && (
        <div className="px-4 py-2 bg-amber-50/50 border-b border-gray-100">
          <div className="text-[11px] font-semibold text-amber-700 mb-0.5 uppercase tracking-wide">
            Structured Output Fields
          </div>
          <div className="space-y-0">
            {agent.structuredOutputs.map((field: StructuredOutputField, i: number) => (
              <div key={i} className="flex items-center gap-1 text-[12px]">
                <span className="font-mono text-amber-800 font-medium">{field.name}</span>
                <span className="text-gray-400 text-[10px]">({field.type})</span>
                {field.required && (
                  <span className="text-red-400 text-[9px] font-semibold">*</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connection indicators — pushed to bottom */}
      <div className="mt-auto px-4 py-2 bg-slate-50 border-t border-gray-200 space-y-1">
        {connections.receivesFrom.length > 0 && (
          <div className="flex items-start gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[12px] text-gray-500">
              <span className="font-medium text-gray-600">From: </span>
              {connections.receivesFrom.map((c, i: number) => (
                <span key={c.id}>
                  {i > 0 && ', '}
                  <span className="font-medium text-gray-700">#{c.number}</span>{' '}
                  <span className="text-gray-500">{c.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {connections.sendsTo.length > 0 && (
          <div className="flex items-start gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
            <div className="text-[12px] text-gray-500">
              <span className="font-medium text-gray-600">To: </span>
              {connections.sendsTo.map((c, i: number) => (
                <span key={c.id}>
                  {i > 0 && ', '}
                  <span className="font-medium text-gray-700">#{c.number}</span>{' '}
                  <span className="text-gray-500">{c.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {connections.receivesFrom.length === 0 && connections.sendsTo.length === 0 && (
          <div className="text-[12px] text-gray-400 italic">No direct agent connections</div>
        )}
      </div>
    </div>
  )
}
