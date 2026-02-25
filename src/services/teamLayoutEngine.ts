import type { TeamDiagram, LayoutResult, AgentPosition } from '@/types/teamDiagram'

export const CARD_W = 264
export const CARD_H = 114
export const GAP_X  = 52
export const GAP_Y  = 60
export const PAD    = 40

export interface EdgeGeometry {
  path: string
  labelX: number
  labelY: number
}

/* ================================================================== */
/*  Obstacle-aware routing                                             */
/* ================================================================== */

export interface Obstacle {
  x: number
  y: number
  w: number
  h: number
}

interface Point { x: number; y: number }

const DETOUR_MARGIN = 16   // px clearance from card edges when detouring
const CORNER_RADIUS = 10   // rounded corner radius for SVG path

/** Check if a line segment (p1→p2) crosses an obstacle rect (optionally inflated). */
function segmentCrossesRect(
  p1: Point, p2: Point,
  obs: Obstacle, inflate: number = 0,
): boolean {
  const left   = obs.x - inflate
  const top    = obs.y - inflate
  const right  = obs.x + obs.w + inflate
  const bottom = obs.y + obs.h + inflate

  const dx = Math.abs(p1.x - p2.x)
  const dy = Math.abs(p1.y - p2.y)

  if (dx < 1) {
    // Vertical segment
    const x = (p1.x + p2.x) / 2
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)
    return x > left && x < right && maxY > top && minY < bottom
  }
  if (dy < 1) {
    // Horizontal segment
    const y = (p1.y + p2.y) / 2
    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    return y > top && y < bottom && maxX > left && minX < right
  }
  // Diagonal fallback
  const sL = Math.min(p1.x, p2.x), sR = Math.max(p1.x, p2.x)
  const sT = Math.min(p1.y, p2.y), sB = Math.max(p1.y, p2.y)
  return sR > left && sL < right && sB > top && sT < bottom
}

/** Remove consecutive duplicate points. */
function dedup(pts: Point[]): Point[] {
  if (pts.length === 0) return pts
  const out: Point[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1]
    if (Math.abs(pts[i].x - prev.x) > 0.5 || Math.abs(pts[i].y - prev.y) > 0.5) {
      out.push(pts[i])
    }
  }
  return out
}

/** Remove collinear midpoints (same x or same y as both neighbours). */
function simplify(pts: Point[]): Point[] {
  if (pts.length <= 2) return pts
  const out: Point[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1]
    const next = pts[i + 1]
    const sameX = Math.abs(prev.x - pts[i].x) < 1 && Math.abs(pts[i].x - next.x) < 1
    const sameY = Math.abs(prev.y - pts[i].y) < 1 && Math.abs(pts[i].y - next.y) < 1
    if (!sameX && !sameY) out.push(pts[i])
  }
  out.push(pts[pts.length - 1])
  return out
}

/**
 * Reroute path segments that cross obstacle cards.
 * Iterates until no more intersections (max 20 passes).
 */
function rerouteAroundObstacles(points: Point[], obstacles: Obstacle[]): Point[] {
  if (obstacles.length === 0 || points.length < 2) return points

  let current = dedup(points)

  for (let iter = 0; iter < 20; iter++) {
    let changed = false
    const out: Point[] = []

    for (let i = 0; i < current.length - 1; i++) {
      const p1 = current[i]
      const p2 = current[i + 1]
      out.push(p1)

      // Find all obstacles this segment crosses
      const crossed = obstacles.filter((obs) => segmentCrossesRect(p1, p2, obs))
      if (crossed.length === 0) continue

      changed = true

      // Bounding box of all crossed obstacles + margin
      let bL = Infinity, bT = Infinity, bR = -Infinity, bB = -Infinity
      for (const o of crossed) {
        bL = Math.min(bL, o.x - DETOUR_MARGIN)
        bT = Math.min(bT, o.y - DETOUR_MARGIN)
        bR = Math.max(bR, o.x + o.w + DETOUR_MARGIN)
        bB = Math.max(bB, o.y + o.h + DETOUR_MARGIN)
      }

      const isVert = Math.abs(p1.x - p2.x) < 1

      if (isVert) {
        const x = p1.x
        const goDown = p2.y > p1.y

        // Choose side: prefer the one that doesn't hit another card
        const leftX = bL
        const rightX = bR

        const leftBlocked = obstacles.some((obs) => {
          if (crossed.includes(obs)) return false
          return leftX > obs.x - DETOUR_MARGIN && leftX < obs.x + obs.w + DETOUR_MARGIN &&
                 bB > obs.y - DETOUR_MARGIN && bT < obs.y + obs.h + DETOUR_MARGIN
        })
        const rightBlocked = obstacles.some((obs) => {
          if (crossed.includes(obs)) return false
          return rightX > obs.x - DETOUR_MARGIN && rightX < obs.x + obs.w + DETOUR_MARGIN &&
                 bB > obs.y - DETOUR_MARGIN && bT < obs.y + obs.h + DETOUR_MARGIN
        })

        let sideX: number
        if (!leftBlocked && rightBlocked) sideX = leftX
        else if (leftBlocked && !rightBlocked) sideX = rightX
        else sideX = Math.abs(x - leftX) <= Math.abs(x - rightX) ? leftX : rightX

        if (goDown) {
          out.push({ x, y: bT }, { x: sideX, y: bT }, { x: sideX, y: bB }, { x, y: bB })
        } else {
          out.push({ x, y: bB }, { x: sideX, y: bB }, { x: sideX, y: bT }, { x, y: bT })
        }
      } else {
        // Horizontal segment
        const y = p1.y
        const goRight = p2.x > p1.x

        const topBlocked = obstacles.some((obs) => {
          if (crossed.includes(obs)) return false
          return bT > obs.y - DETOUR_MARGIN && bT < obs.y + obs.h + DETOUR_MARGIN &&
                 bR > obs.x - DETOUR_MARGIN && bL < obs.x + obs.w + DETOUR_MARGIN
        })
        const bottomBlocked = obstacles.some((obs) => {
          if (crossed.includes(obs)) return false
          return bB > obs.y - DETOUR_MARGIN && bB < obs.y + obs.h + DETOUR_MARGIN &&
                 bR > obs.x - DETOUR_MARGIN && bL < obs.x + obs.w + DETOUR_MARGIN
        })

        let sideY: number
        if (!topBlocked && bottomBlocked) sideY = bT
        else if (topBlocked && !bottomBlocked) sideY = bB
        else sideY = Math.abs(y - bT) <= Math.abs(y - bB) ? bT : bB

        if (goRight) {
          out.push({ x: bL, y }, { x: bL, y: sideY }, { x: bR, y: sideY }, { x: bR, y })
        } else {
          out.push({ x: bR, y }, { x: bR, y: sideY }, { x: bL, y: sideY }, { x: bL, y })
        }
      }
    }

    out.push(current[current.length - 1])
    if (!changed) break
    current = simplify(dedup(out))
  }

  return simplify(dedup(current))
}

/** Convert a point list into an SVG path with rounded corners at bends. */
function pointsToPath(pts: Point[], radius: number = CORNER_RADIUS): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) {
    return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`
  }

  const parts: string[] = [`M ${pts[0].x},${pts[0].y}`]

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const cur  = pts[i]
    const next = pts[i + 1]

    const dx1 = cur.x - prev.x, dy1 = cur.y - prev.y
    const dx2 = next.x - cur.x, dy2 = next.y - cur.y
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

    // Skip if segments too short or collinear (no bend)
    const cross = dx1 * dy2 - dy1 * dx2
    if (len1 < 1 || len2 < 1 || Math.abs(cross) < 0.01) {
      parts.push(`L ${cur.x},${cur.y}`)
      continue
    }

    const r = Math.min(radius, len1 / 2, len2 / 2)
    const bx = cur.x - (dx1 / len1) * r
    const by = cur.y - (dy1 / len1) * r
    const ax = cur.x + (dx2 / len2) * r
    const ay = cur.y + (dy2 / len2) * r

    parts.push(`L ${bx},${by}`)
    parts.push(`Q ${cur.x},${cur.y} ${ax},${ay}`)
  }

  const last = pts[pts.length - 1]
  parts.push(`L ${last.x},${last.y}`)
  return parts.join(' ')
}

export interface BuildLayoutOptions {
  /** Limit agents per row. 0 = auto (unlimited). */
  maxPerRow?: number
}

export function buildLayout(diagram: TeamDiagram, options: BuildLayoutOptions = {}): LayoutResult {
  const { maxPerRow = 0 } = options
  const { agents, connections } = diagram

  const connectedIds = new Set<string>()
  connections.forEach((c) => { connectedIds.add(c.from); connectedIds.add(c.to) })

  const connectedAgents = agents.filter((a) => connectedIds.has(a.id))
  const standaloneAgents = agents.filter((a) => !connectedIds.has(a.id))

  const kids: Record<string, string[]> = {}
  const parents: Record<string, string[]> = {}
  connectedAgents.forEach((a) => { kids[a.id] = []; parents[a.id] = [] })
  connections.forEach((c) => {
    if (kids[c.from] !== undefined) kids[c.from].push(c.to)
    if (parents[c.to] !== undefined) parents[c.to].push(c.from)
  })

  // Find natural roots (no incoming connections)
  let rootIds = connectedAgents
    .filter((a) => parents[a.id].length === 0)
    .map((a) => a.id)

  // Handle cycles: all agents have parents → pick best starting point
  if (rootIds.length === 0 && connectedAgents.length > 0) {
    const orch = connectedAgents.find((a) => a.type === 'orchestrator')
    if (orch) {
      rootIds = [orch.id]
    } else {
      const minIn = Math.min(...connectedAgents.map((a) => parents[a.id].length))
      const candidate = connectedAgents.find((a) => parents[a.id].length === minIn)
      if (candidate) rootIds = [candidate.id]
    }
  }

  // BFS rank assignment.
  // KEY: once a node is dequeued+processed it is frozen — we never increase its rank again.
  // This breaks cycles (back-edges are identified but don't inflate ancestor ranks).
  const rank: Record<string, number> = {}
  rootIds.forEach((id) => { rank[id] = 0 })
  const queue: string[] = [...rootIds]
  const inQueue  = new Set<string>(rootIds)
  const processed = new Set<string>()

  let qi = 0
  while (qi < queue.length) {
    const current = queue[qi++]
    processed.add(current)
    const currentRank = rank[current] ?? 0
    ;(kids[current] ?? []).forEach((childId) => {
      // Never update a node that has already been ranked+processed (back-edge = cycle)
      if (processed.has(childId)) return
      const newRank = currentRank + 1
      if (rank[childId] === undefined || rank[childId] < newRank) {
        rank[childId] = newRank
        if (!inQueue.has(childId)) {
          queue.push(childId)
          inQueue.add(childId)
        }
      }
    })
  }

  // Fallback for isolated members of a cycle that BFS never reached
  connectedAgents.forEach((a) => { if (rank[a.id] === undefined) rank[a.id] = 0 })

  // Group by rank into layers
  const layerMap: Record<number, string[]> = {}
  connectedAgents.forEach((a) => {
    const r = rank[a.id]
    if (!layerMap[r]) layerMap[r] = []
    layerMap[r].push(a.id)
  })

  let maxRank = connectedAgents.length > 0
    ? Math.max(...connectedAgents.map((a) => rank[a.id]))
    : -1

  // ── Apply maxPerRow wrapping ──────────────────────────────────────────────
  // When maxPerRow > 0, split any layer wider than maxPerRow into sub-layers.
  if (maxPerRow > 0 && maxRank >= 0) {
    const newLayerMap: Record<number, string[]> = {}
    let newIdx = 0
    for (let r = 0; r <= maxRank; r++) {
      const layer = layerMap[r] ?? []
      if (layer.length === 0) continue
      for (let i = 0; i < layer.length; i += maxPerRow) {
        const chunk = layer.slice(i, i + maxPerRow)
        newLayerMap[newIdx] = chunk
        chunk.forEach((id) => { rank[id] = newIdx })
        newIdx++
      }
    }
    for (const k of Object.keys(layerMap)) delete layerMap[Number(k)]
    Object.assign(layerMap, newLayerMap)
    maxRank = newIdx - 1
  }

  // Compute canvas width from the widest layer
  let maxLayerPx = 0
  for (let r = 0; r <= maxRank; r++) {
    const layer = layerMap[r] ?? []
    const px = layer.length * CARD_W + Math.max(0, layer.length - 1) * GAP_X
    if (px > maxLayerPx) maxLayerPx = px
  }
  // Standalone: cap row width at maxPerRow if set
  if (standaloneAgents.length > 0) {
    const perRow = maxPerRow > 0 ? Math.min(maxPerRow, standaloneAgents.length) : standaloneAgents.length
    const px = perRow * CARD_W + Math.max(0, perRow - 1) * GAP_X
    if (px > maxLayerPx) maxLayerPx = px
  }
  if (maxLayerPx === 0) maxLayerPx = CARD_W

  const positions: Record<string, AgentPosition> = {}

  for (let r = 0; r <= maxRank; r++) {
    const layer = layerMap[r] ?? []
    const rowWidth = layer.length * CARD_W + Math.max(0, layer.length - 1) * GAP_X
    const centerOffset = (maxLayerPx - rowWidth) / 2
    layer.forEach((agentId, idx) => {
      positions[agentId] = {
        id: agentId,
        x: PAD + centerOffset + idx * (CARD_W + GAP_X),
        y: PAD + r * (CARD_H + GAP_Y),
      }
    })
  }

  const lastConnectedY = maxRank >= 0
    ? PAD + maxRank * (CARD_H + GAP_Y) + CARD_H
    : PAD

  const standaloneY = standaloneAgents.length > 0 ? lastConnectedY + 36 : -1
  const standaloneRowY = standaloneY >= 0 ? standaloneY + 20 : 0

  let bottomOfStandalone = maxRank >= 0
    ? PAD + maxRank * (CARD_H + GAP_Y) + CARD_H
    : PAD

  if (standaloneAgents.length > 0) {
    const perRow = maxPerRow > 0 ? maxPerRow : standaloneAgents.length
    standaloneAgents.forEach((agent, idx) => {
      const rowIdx = Math.floor(idx / perRow)
      const colIdx = idx % perRow
      const itemsInThisRow = Math.min(perRow, standaloneAgents.length - rowIdx * perRow)
      const rowWidth = itemsInThisRow * CARD_W + Math.max(0, itemsInThisRow - 1) * GAP_X
      const centerOffset = (maxLayerPx - rowWidth) / 2
      positions[agent.id] = {
        id: agent.id,
        x: PAD + centerOffset + colIdx * (CARD_W + GAP_X),
        y: standaloneRowY + rowIdx * (CARD_H + GAP_Y),
      }
    })
    const standaloneRows = Math.ceil(standaloneAgents.length / perRow)
    bottomOfStandalone = standaloneRowY + (standaloneRows - 1) * (CARD_H + GAP_Y) + CARD_H
  }

  return {
    positions,
    tw: Math.max(maxLayerPx + 2 * PAD, 400),
    th: Math.max(bottomOfStandalone + PAD, 300),
    standaloneY,
    standaloneAgentIds: standaloneAgents.map((a) => a.id),
    connectedAgentIds: connectedAgents.map((a) => a.id),
  }
}

/**
 * Compute SVG path + label anchor for an orthogonal edge.
 *
 * x1,y1 = source card bottom-center
 * x2,y2 = target card top-center
 *
 * Three cases:
 *   FORWARD  (y2 > y1 + 10):  elbow down → horizontal → down
 *   SAME-ROW (y1 - y2 ≤ CARD_H + GAP_Y/2):  arc below both cards
 *   BACKWARD (y1 - y2 >  that):  right-side loop, enter target from above (arrow points ↓)
 *
 * When obstacles are provided, segments that would cross intermediate cards
 * are rerouted around them with proper clearance.
 */
export function orthoEdge(
  x1: number, y1: number,
  x2: number, y2: number,
  canvasWidth?: number,
  obstacles?: Obstacle[],
): EdgeGeometry {
  const dy = y2 - y1   // positive = target is below source (normal)
  const obs = obstacles && obstacles.length > 0 ? obstacles : undefined

  // ── FORWARD ────────────────────────────────────────────────────────────────
  if (dy > 10) {
    const labelY = y1 + 14
    const labelX = x1 + 8

    if (Math.abs(x1 - x2) < 3) {
      const safeLabel = dy <= CARD_H + GAP_Y
        ? y1 + Math.round(dy / 2)
        : labelY
      let pts: Point[] = [{ x: x1, y: y1 }, { x: x1, y: y2 }]
      if (obs) pts = rerouteAroundObstacles(pts, obs)
      return { path: pointsToPath(pts), labelX, labelY: safeLabel }
    }

    const horizY = dy <= GAP_Y + 5
      ? y1 + Math.round(dy / 2)
      : y1 + Math.round(GAP_Y * 0.4)
    let pts: Point[] = [
      { x: x1, y: y1 },
      { x: x1, y: horizY },
      { x: x2, y: horizY },
      { x: x2, y: y2 },
    ]
    if (obs) pts = rerouteAroundObstacles(pts, obs)
    return { path: pointsToPath(pts), labelX, labelY }
  }

  // ── SAME-ROW (short backward, ≤ one row gap) ──────────────────────────────
  const sameRowThresh = CARD_H + GAP_Y / 2
  if (-dy <= sameRowThresh) {
    const belowY = Math.max(y1, y2) + 33
    let pts: Point[] = [
      { x: x1, y: y1 },
      { x: x1, y: belowY },
      { x: x2, y: belowY },
      { x: x2, y: y2 },
    ]
    if (obs) pts = rerouteAroundObstacles(pts, obs)
    return { path: pointsToPath(pts), labelX: (x1 + x2) / 2, labelY: belowY + 4 }
  }

  // ── LONG BACKWARD (cycle back-edge) ─────────────────────────────────────
  const rightX = canvasWidth !== undefined
    ? canvasWidth - PAD / 2
    : Math.max(x1, x2) + CARD_W + 48
  const aboveTarget = y2 - 18
  let pts: Point[] = [
    { x: x1, y: y1 },
    { x: rightX, y: y1 },
    { x: rightX, y: aboveTarget },
    { x: x2, y: aboveTarget },
    { x: x2, y: y2 },
  ]
  if (obs) pts = rerouteAroundObstacles(pts, obs)
  return { path: pointsToPath(pts), labelX: rightX + 4, labelY: y1 + (y2 - y1) / 2 }
}

/** @deprecated use orthoEdge */
export function orthoPath(x1: number, y1: number, x2: number, y2: number): string {
  return orthoEdge(x1, y1, x2, y2).path
}
