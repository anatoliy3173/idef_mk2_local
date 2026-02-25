import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'
import type { RoutePoint } from '@/services/layoutEngine'

/**
 * Custom edge that renders along ELK-computed orthogonal routes when available,
 * falling back to React Flow's smoothstep path when no route data exists.
 */
export function ElkRoutedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  markerStart,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  data,
}: EdgeProps) {
  const elkRoute = (data as Record<string, unknown> | undefined)?.elkRoute as RoutePoint[] | undefined

  let edgePath: string
  let labelX: number
  let labelY: number

  if (elkRoute && elkRoute.length >= 2) {
    // Build SVG path from ELK's computed route points
    const pathParts: string[] = [`M ${elkRoute[0].x} ${elkRoute[0].y}`]
    for (let i = 1; i < elkRoute.length; i++) {
      pathParts.push(`L ${elkRoute[i].x} ${elkRoute[i].y}`)
    }
    edgePath = pathParts.join(' ')

    // Place label at midpoint of the path
    const midIdx = Math.floor(elkRoute.length / 2)
    const midPoint = elkRoute[midIdx]
    const prevPoint = elkRoute[midIdx - 1] ?? midPoint
    labelX = (midPoint.x + prevPoint.x) / 2
    labelY = (midPoint.y + prevPoint.y) / 2
  } else {
    // Fallback to smoothstep
    const [path, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 8,
    })
    edgePath = path
    labelX = lx
    labelY = ly
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
      label={label}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      labelX={labelX}
      labelY={labelY}
    />
  )
}
