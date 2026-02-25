import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Wrench } from 'lucide-react'

interface ToolNodeData {
  name: string
  toolType: string
  parentAgent: string
  endpoint?: string
  [key: string]: unknown
}

export function ToolNode({ data }: NodeProps) {
  const nodeData = data as unknown as ToolNodeData
  return (
    <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm min-w-[140px]">
      <div className="flex items-center gap-1.5">
        <Wrench className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-[11px] font-medium text-gray-700 truncate max-w-[110px]">
          {nodeData.name}
        </span>
      </div>
      {nodeData.endpoint && (
        <div className="text-[9px] text-gray-400 mt-0.5 truncate max-w-[140px]">
          {nodeData.endpoint}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        id="parent-in"
        className="!bg-orange-400 !w-2 !h-2 !border-2 !border-white"
      />
    </div>
  )
}
