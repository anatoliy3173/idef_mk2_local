import type { NodeProps } from '@xyflow/react'
import { Layers } from 'lucide-react'

interface CdpLayerNodeData {
  label: string
  [key: string]: unknown
}

export function CdpLayerNode({ data }: NodeProps) {
  const nodeData = data as unknown as CdpLayerNodeData
  return (
    <div
      className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-8 py-4 pointer-events-none select-none"
      style={{ width: '100%', height: '100%', minWidth: 600, minHeight: 60 }}
    >
      <div className="flex items-center gap-2 opacity-60">
        <Layers className="w-5 h-5 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-400 tracking-wide uppercase">
          {nodeData.label ?? 'CDP (Customer Data Platform)'}
        </span>
      </div>
    </div>
  )
}
