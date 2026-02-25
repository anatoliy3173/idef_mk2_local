import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Puzzle, Layers, Zap } from 'lucide-react'
import type { AgentInput, AgentOutput } from '@/types/agentSystem'

interface OrchestratorTool {
  id: string
  name: string
  type: string
}

interface OrchestratorNodeData {
  name: string
  description: string
  reasoning: string[]
  inputs: AgentInput[]
  outputs: AgentOutput[]
  tools: OrchestratorTool[]
  hasCdp: boolean
  [key: string]: unknown
}

export function OrchestratorNode({ data }: NodeProps) {
  const nodeData = data as unknown as OrchestratorNodeData

  const inputNames = (nodeData.inputs ?? []).map((i: AgentInput) => i.name).join(', ')
  const outputNames = (nodeData.outputs ?? []).map((o: AgentOutput) => o.name).join(', ')
  const tools = nodeData.tools ?? []
  const hasCdp = nodeData.hasCdp ?? false
  const capabilities = nodeData.reasoning ?? []

  return (
    <div className="w-[380px] bg-gradient-to-br from-purple-400/80 to-blue-500/80 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-black/10 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center shrink-0">
          <Puzzle className="w-4 h-4 text-yellow-300" />
        </div>
        <span className="font-bold text-white text-xl break-words">{nodeData.name}</span>
      </div>

      {/* Description */}
      {nodeData.description && (
        <div className="px-4 py-2 text-[15px] text-purple-100 leading-snug border-b border-white/10">
          {nodeData.description}
        </div>
      )}

      {/* I/O summary */}
      <div className="px-4 py-2 text-white text-[15px] leading-snug space-y-0.5">
        <div>
          <strong className="text-purple-200">In:</strong> {inputNames || '---'}
        </div>
        <div>
          <strong className="text-purple-200">Out:</strong> {outputNames || '---'}
        </div>
      </div>

      {/* Capabilities */}
      {capabilities.length > 0 && (
        <div className="px-4 py-2 bg-white/10 border-t border-white/10">
          <div className="text-[13px] font-semibold text-purple-200 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Capabilities
          </div>
          <div className="space-y-0.5">
            {capabilities.map((cap: string, i: number) => (
              <div key={i} className="text-[15px] text-purple-100">
                <span className="text-purple-300 mr-1">&bull;</span>{cap}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tools (including CDP) */}
      {(tools.length > 0 || hasCdp) && (
        <div className="px-4 py-2 bg-black/10 space-y-1 border-t border-white/10">
          {hasCdp && (
            <div className="flex items-center gap-1.5 text-[15px] text-purple-100">
              <Layers className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
              <span className="font-medium">CDP (Customer Data Platform)</span>
            </div>
          )}
          {tools.map((tool: OrchestratorTool) => (
            <div key={tool.id} className="flex items-center gap-1.5 text-[15px] text-purple-100">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-200 shrink-0" />
              <span>{tool.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Handles */}
      {/* Top: input from user */}
      <Handle
        type="target"
        position={Position.Top}
        id="user-in"
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-white"
      />
      {/* Top-left offset: response out to user */}
      <Handle
        type="source"
        position={Position.Top}
        id="response-out"
        className="!bg-green-400 !w-2.5 !h-2.5 !border-2 !border-white"
        style={{ left: 40 }}
      />
      {/* Right: results in from agents */}
      <Handle
        type="target"
        position={Position.Right}
        id="result-in"
        className="!bg-purple-300 !w-2.5 !h-2.5 !border-2 !border-white"
      />
      {/* Bottom: resource connections + delegation to agents */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="resource-out"
        className="!bg-blue-300 !w-2.5 !h-2.5 !border-2 !border-white"
      />
    </div>
  )
}
