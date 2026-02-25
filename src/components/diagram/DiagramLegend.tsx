import { TYPE_COLORS } from '@/types/teamDiagram'

interface DiagramLegendProps {
  agentTypes: string[]  // unique agent types present in this diagram
}

export function DiagramLegend({ agentTypes }: DiagramLegendProps) {
  const uniqueTypes = [...new Set(agentTypes)].filter((t) => TYPE_COLORS[t])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 12px',
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        flexShrink: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Left: type legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {uniqueTypes.map((type) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: TYPE_COLORS[type],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, color: '#64748b' }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Right: interaction hints */}
      <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
        Drag to pan · Buttons to zoom
      </span>
    </div>
  )
}
