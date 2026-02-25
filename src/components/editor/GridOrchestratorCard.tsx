import { Puzzle, Layers, Zap } from 'lucide-react'
import type { Orchestrator, AgentInput, AgentOutput } from '@/types/agentSystem'

interface GridOrchestratorCardProps {
  orchestrator: Orchestrator
  hasCdp: boolean
}

export function GridOrchestratorCard({ orchestrator, hasCdp }: GridOrchestratorCardProps) {
  const inputNames = orchestrator.inputs.map((i: AgentInput) => i.name).join(', ')
  const outputNames = orchestrator.outputs.map((o: AgentOutput) => o.name).join(', ')
  const capabilities = orchestrator.reasoning.capabilities

  return (
    <div className="bg-gradient-to-br from-purple-400/80 to-blue-500/80 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-black/10 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center shrink-0">
          <Puzzle className="w-4 h-4 text-yellow-300" />
        </div>
        <span className="font-bold text-white text-lg break-words">{orchestrator.name}</span>
      </div>

      {/* Description */}
      {orchestrator.description && (
        <div className="px-5 py-2 text-[14px] text-purple-100 leading-snug border-b border-white/10">
          {orchestrator.description}
        </div>
      )}

      {/* I/O summary */}
      <div className="px-5 py-2 text-white text-[14px] leading-snug space-y-0.5">
        <div>
          <strong className="text-purple-200">In:</strong> {inputNames || '---'}
        </div>
        <div>
          <strong className="text-purple-200">Out:</strong> {outputNames || '---'}
        </div>
      </div>

      {/* Capabilities */}
      {capabilities.length > 0 && (
        <div className="px-5 py-2 bg-white/10 border-t border-white/10">
          <div className="text-[12px] font-semibold text-purple-200 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Capabilities
          </div>
          <div className="space-y-0.5">
            {capabilities.map((cap: string, i: number) => (
              <div key={i} className="text-[14px] text-purple-100">
                <span className="text-purple-300 mr-1">&bull;</span>{cap}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CDP */}
      {hasCdp && (
        <div className="px-5 py-2 bg-black/10 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-[14px] text-purple-100">
            <Layers className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
            <span className="font-medium">CDP (Customer Data Platform)</span>
          </div>
        </div>
      )}
    </div>
  )
}
