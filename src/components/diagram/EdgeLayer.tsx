import { useMemo } from 'react'
import type { TeamDiagram, LayoutResult } from '@/types/teamDiagram'
import { CARD_W, CARD_H, orthoEdge, type Obstacle } from '@/services/teamLayoutEngine'

interface EdgeLayerProps {
  diagram: TeamDiagram
  layout: LayoutResult
}

export function EdgeLayer({ diagram, layout }: EdgeLayerProps) {
  const { connections } = diagram
  const { positions, tw, th } = layout

  // Build obstacle list from all card positions (memoised)
  const allCards: Obstacle[] = useMemo(() =>
    diagram.agents
      .filter((a) => positions[a.id])
      .map((a) => ({
        x: positions[a.id].x,
        y: positions[a.id].y,
        w: CARD_W,
        h: CARD_H,
      })),
    [diagram.agents, positions],
  )

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: tw,
        height: th,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        <marker
          id="ah"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L8,3 L0,6Z" fill="#a1a1aa" />
        </marker>
      </defs>

      {connections.map((conn, i) => {
        const fromPos = positions[conn.from]
        const toPos = positions[conn.to]

        // Skip edges with invalid agent references
        if (!fromPos || !toPos) return null

        const x1 = fromPos.x + CARD_W / 2
        const y1 = fromPos.y + CARD_H
        const x2 = toPos.x + CARD_W / 2
        const y2 = toPos.y

        // Exclude source and target cards from obstacles for this edge
        const obstaclesForEdge = allCards.filter(
          (c) =>
            !(Math.abs(c.x - fromPos.x) < 1 && Math.abs(c.y - fromPos.y) < 1) &&
            !(Math.abs(c.x - toPos.x) < 1 && Math.abs(c.y - toPos.y) < 1),
        )

        const { path: pathStr, labelX, labelY } = orthoEdge(x1, y1, x2, y2, tw, obstaclesForEdge)

        const key = `${conn.from}-${conn.to}-${i}`

        return (
          <g key={key}>
            {/* Bold dot at arrow source */}
            <circle cx={x1} cy={y1} r={3.5} fill="#a1a1aa" />
            <path
              d={pathStr}
              stroke="#a1a1aa"
              strokeWidth={1.5}
              fill="none"
              markerEnd="url(#ah)"
            />
            {conn.label && (
              <g>
                <rect
                  x={labelX - 26}
                  y={labelY - 8}
                  width={52}
                  height={16}
                  rx={4}
                  fill="#f8fafc"
                  stroke="#d4d4d8"
                  strokeWidth={1}
                />
                <text
                  x={labelX}
                  y={labelY + 4}
                  fontSize={9}
                  fill="#71717a"
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {conn.label}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
