import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Bot, Wrench, Search, Cpu, Puzzle, BookOpen } from 'lucide-react'
import type { AgentInput, AgentTool, AgentReasoning, AgentOutput, AgentCategory, StructuredOutputField } from '@/types/agentSystem'
import { AGENT_CATEGORIES } from '@/lib/constants'

interface AgentNodeData {
  agentId: string
  name: string
  category: AgentCategory
  purpose: string
  model?: string
  inputs: AgentInput[]
  tools: AgentTool[]
  reasoning: AgentReasoning
  outputs: AgentOutput[]
  structuredOutputs: StructuredOutputField[]
  agentColor?: string
  orchestratorName?: string
  [key: string]: unknown
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

export function AgentNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData
  const catConfig = AGENT_CATEGORIES[nodeData.category] ?? AGENT_CATEGORIES['data-collection']
  const nodeColor = (nodeData.agentColor as string | undefined) ?? catConfig.color
  const isKnowledge = nodeData.category === 'knowledge'

  // Resolve LLM model: prefer agent-level model, fallback to first LLM tool's model
  const resolvedModel: string | undefined = nodeData.model
    ?? (nodeData.tools ?? []).find((t: AgentTool) => t.type === 'llm' && t.model)?.model

  const displayTools = isKnowledge
    ? (nodeData.tools ?? []).filter((t: AgentTool) => t.type !== 'llm')
    : (nodeData.tools ?? [])

  return (
    <div
      className={`w-[460px] bg-white rounded-xl shadow-lg border-2 overflow-hidden transition-shadow ${
        selected ? 'shadow-2xl ring-2 ring-blue-400' : ''
      }`}
      style={{ borderColor: nodeColor }}
    >
      {/* Orchestrator badge */}
      {nodeData.orchestratorName && (
        <div className="px-4 py-1.5 bg-purple-50 border-b border-purple-100 flex items-center gap-1.5">
          <Puzzle className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="text-[13px] text-purple-500">
            Managed by <span className="font-medium text-purple-600">{nodeData.orchestratorName}</span>
          </span>
        </div>
      )}

      {/* Header */}
      <div
        className="px-5 py-3.5 text-white"
        style={{
          background: `linear-gradient(135deg, ${nodeColor}, ${nodeColor}dd)`,
        }}
      >
        <div className="flex items-start gap-2">
          <Bot className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-xl break-words leading-tight">
                {nodeData.name}
              </span>
              {resolvedModel && (
                <span className="inline-flex items-center gap-1 bg-white/25 text-white px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap shrink-0 mt-0.5">
                  <Cpu className="w-3 h-3" />
                  {resolvedModel}
                </span>
              )}
            </div>
            <div className="mt-1">
              <span className="text-xs bg-white/30 px-2 py-0.5 rounded font-mono">
                {nodeData.agentId}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RAG Knowledge Base badge for knowledge-category agents */}
      {isKnowledge && (
        <div className="px-5 py-2 bg-cyan-50 border-b border-cyan-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-600 shrink-0" />
          <span className="text-[13px] font-semibold text-cyan-700">RAG Knowledge Base</span>
        </div>
      )}

      {/* Purpose */}
      <div className="px-5 py-2.5 text-[15px] text-gray-600 border-b border-gray-100 leading-snug">
        {nodeData.purpose}
      </div>

      {/* Inputs */}
      {nodeData.inputs && nodeData.inputs.length > 0 && (
        <div className="px-5 py-2.5 border-b border-gray-100">
          <div className="text-[13px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Inputs
          </div>
          <ul className="text-[15px] space-y-0.5">
            {nodeData.inputs.slice(0, 6).map((input: AgentInput, i: number) => (
              <li key={i} className="text-gray-600">
                <span className="text-gray-400">&#8226;</span> {input.name}{' '}
                <span className="text-gray-400 text-[12px]">({input.source})</span>
              </li>
            ))}
            {nodeData.inputs.length > 6 && (
              <li className="text-gray-400 text-xs italic">
                +{nodeData.inputs.length - 6} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Tools — prominent sub-cards */}
      {displayTools.length > 0 && (
        <div className="px-5 py-2.5 border-b border-gray-100">
          <div className="text-[13px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Tools
          </div>
          <div className="space-y-1.5">
            {displayTools.map((tool: AgentTool, i: number) => {
              const cfg = getToolConfig(tool.type)
              const ToolIcon = cfg.icon
              return (
                <div
                  key={i}
                  className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${cfg.bg} ${cfg.text}`}>
                      <ToolIcon className="w-3 h-3" />
                      {tool.type}
                    </span>
                    <span className="text-[15px] font-medium text-gray-700">
                      {tool.name}
                    </span>
                  </div>
                  {(tool.endpoint ?? tool.provider) && !isKnowledge && (
                    <div className="mt-0.5 text-xs text-gray-400 truncate">
                      {tool.method && (
                        <span className="font-mono text-[11px] text-gray-500 mr-1">{tool.method}</span>
                      )}
                      {tool.endpoint ?? tool.provider}
                      {tool.model && (
                        <span className="ml-1 text-gray-500">({tool.model})</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reasoning */}
      <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="text-[13px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
          Reasoning
        </div>
        <div className="text-[15px] text-gray-600 space-y-0.5">
          {(nodeData.reasoning?.strategies ?? []).slice(0, 2).map((s: string, i: number) => (
            <p key={i}>{s}</p>
          ))}
          {(nodeData.reasoning?.strategies ?? []).length === 0 && (
            <p>Processes input and generates output</p>
          )}
        </div>
      </div>

      {/* Output */}
      <div className="px-5 py-2.5 border-b border-gray-100">
        <div className="text-[13px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
          Output
        </div>
        <div className="text-[15px] text-gray-600">
          {(nodeData.outputs ?? []).map((o: AgentOutput, i: number) => (
            <p key={i}>
              &rarr; {o.name}
            </p>
          ))}
          {(nodeData.outputs ?? []).length === 0 && (
            <p>&rarr; Structured result</p>
          )}
        </div>
      </div>

      {/* Structured Outputs — mandatory return fields */}
      {(nodeData.structuredOutputs ?? []).length > 0 && (
        <div className="px-5 py-2.5 bg-amber-50/50 border-b border-gray-100">
          <div className="text-[13px] font-semibold text-amber-700 mb-1 uppercase tracking-wide">
            Structured Output Fields
          </div>
          <div className="space-y-0.5">
            {(nodeData.structuredOutputs ?? []).map((field: StructuredOutputField, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-sm">
                <span className="font-mono text-amber-800 font-medium">{field.name}</span>
                <span className="text-gray-400 text-[11px]">({field.type})</span>
                {field.required && (
                  <span className="text-red-400 text-[9px] font-semibold">*</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Handles */}
      {/* Top: general incoming (delegation / orchestrator context) */}
      <Handle
        type="target"
        position={Position.Top}
        id="delegate-in"
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
      />
      {/* Left: inter-agent data flow in */}
      <Handle
        type="target"
        position={Position.Left}
        id="data-in"
        className="!bg-gray-400 !w-2.5 !h-2.5 !border-2 !border-white"
      />
      {/* Right: results out (to orchestrator, resources, or other agents) */}
      <Handle
        type="source"
        position={Position.Right}
        id="result-out"
        className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-white"
      />
      {/* Bottom: resource connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="resource-out"
        className="!bg-blue-400 !w-2.5 !h-2.5 !border-2 !border-white"
      />
    </div>
  )
}
