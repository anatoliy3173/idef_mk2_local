import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { MessageCircle } from 'lucide-react'

interface UserNodeData {
  label: string
  scenario?: string
  [key: string]: unknown
}

export function UserNode({ data }: NodeProps) {
  const nodeData = data as unknown as UserNodeData
  return (
    <div className="relative">
      <div className="px-5 py-3.5 bg-gradient-to-br from-slate-600 to-slate-500 text-white rounded-xl shadow-lg min-w-[260px] max-w-[300px] border border-slate-400/30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </div>
          <span className="font-bold text-[14px] leading-tight">{nodeData.label}</span>
        </div>
        {nodeData.scenario && (
          <div className="mt-2 text-[12px] text-slate-200 leading-snug">
            {nodeData.scenario}
          </div>
        )}
      </div>
      {/* Speech bubble pointer */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-500 rotate-45 rounded-sm" />
      {/* Bottom: message out to orchestrator */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="message-out"
        className="!bg-slate-700 !w-3 !h-3 !border-2 !border-white !-bottom-1.5"
      />
      {/* Left: response in from orchestrator */}
      <Handle
        type="target"
        position={Position.Left}
        id="response-in"
        className="!bg-green-400 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  )
}
