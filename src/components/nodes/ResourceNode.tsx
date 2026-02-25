import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Database } from 'lucide-react'

interface ResourceNodeData {
  name: string
  resourceType: string
  technology?: string
  description?: string
  accessBy: string[]
  [key: string]: unknown
}

export function ResourceNode({ data }: NodeProps) {
  const nodeData = data as unknown as ResourceNodeData
  return (
    <div className="px-5 py-3 bg-slate-50 border-2 border-slate-300 rounded-lg shadow-sm min-w-[240px] relative">
      {/* Cylinder top decoration */}
      <div className="absolute -top-1 left-2 right-2 h-2 bg-slate-200 rounded-t-full border border-slate-300 border-b-0" />

      <div className="flex items-center gap-2 mt-1">
        <Database className="w-5 h-5 text-slate-500" />
        <span className="text-[14px] font-semibold text-slate-700">{nodeData.name}</span>
      </div>
      {nodeData.technology && (
        <div className="text-[12px] text-slate-400 mt-0.5">{nodeData.technology}</div>
      )}
      {nodeData.description && (
        <div className="text-[12px] text-slate-500 mt-0.5 leading-snug line-clamp-3">{nodeData.description}</div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        id="access-in"
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  )
}
