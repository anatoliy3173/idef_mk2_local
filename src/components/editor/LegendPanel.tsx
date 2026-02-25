import { AGENT_CATEGORIES, EDGE_STYLES } from '@/lib/constants'

export function LegendPanel() {
  return (
    <div className="absolute bottom-14 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border p-3 max-w-[240px] z-10">
      <h3 className="text-[11px] font-semibold mb-2">Legend</h3>

      {/* Node Types — compact two-column */}
      <div className="mb-2">
        <h4 className="text-[9px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
          Nodes
        </h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <LegendNode color="bg-gradient-to-r from-slate-600 to-slate-500" label="User" />
          <LegendNode color="bg-gradient-to-r from-purple-400/80 to-blue-500/80" label="Orchestrator" />
          {Object.entries(AGENT_CATEGORIES).map(([key, config]) => (
            <LegendNode key={key} bgColor={config.color} label={config.label} />
          ))}
          <LegendNode bgColor="#06B6D4" label="RAG KB" />
          <LegendNode color="bg-slate-200 border border-slate-300" label="Resource" />
        </div>
      </div>

      {/* Connection Types */}
      <div>
        <h4 className="text-[9px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
          Connections
        </h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <LegendEdge label="User Input" style={EDGE_STYLES.userInput} />
          <LegendEdge label="Final Output" style={EDGE_STYLES.finalOutput} />
          <LegendEdge label="Data Flow" style={EDGE_STYLES.dataFlow} />
          <LegendEdge label="Output Return" style={EDGE_STYLES.outputReturn} />
          <LegendEdge label="Tool Usage" style={EDGE_STYLES.toolUsage} />
          <LegendEdge label="Manual" style={{ stroke: '#6B7280', strokeWidth: 3 }} />
        </div>
      </div>
    </div>
  )
}

function LegendNode({ color, bgColor, label }: { color?: string; bgColor?: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-3 h-2.5 rounded-sm shrink-0 ${color ?? ''}`}
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      />
      <span className="text-[10px] text-stone-600 truncate">{label}</span>
    </div>
  )
}

interface LegendEdgeProps {
  label: string
  style: { stroke: string; strokeWidth: number; strokeDasharray?: string }
}

function LegendEdge({ label, style }: LegendEdgeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="18" height="6" className="shrink-0">
        <line
          x1="0"
          y1="3"
          x2="18"
          y2="3"
          stroke={style.stroke}
          strokeWidth={Math.min(style.strokeWidth, 3)}
          strokeDasharray={style.strokeDasharray}
        />
      </svg>
      <span className="text-[10px] text-stone-600 truncate">{label}</span>
    </div>
  )
}
