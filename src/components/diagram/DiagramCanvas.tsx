import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { TeamDiagram, LayoutResult } from '@/types/teamDiagram'
import { AgentCard } from './AgentCard'
import { EdgeLayer } from './EdgeLayer'

interface DiagramCanvasProps {
  diagram: TeamDiagram
  layout: LayoutResult
}

export interface DiagramCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  fitView: () => void
  getZoom: () => number
  getCanvasEl: () => HTMLDivElement | null
}

export const DiagramCanvas = forwardRef<DiagramCanvasHandle, DiagramCanvasProps>(
  function DiagramCanvas({ diagram, layout }, ref) {
    const [zoom, setZoom] = useState(0.82)
    const [pan, setPan] = useState({ x: 20, y: 20 })
    const isPanning = useRef(false)
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
    const viewportRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLDivElement>(null)

    const zoomIn = useCallback(() => {
      setZoom((z) => Math.min(z * 1.25, 4))
    }, [])

    const zoomOut = useCallback(() => {
      setZoom((z) => Math.max(z / 1.25, 0.1))
    }, [])

    const fitView = useCallback(() => {
      const vp = viewportRef.current
      if (!vp || !vp.clientWidth) { setZoom(0.82); setPan({ x: 20, y: 20 }); return }
      const scaleX = (vp.clientWidth - 40) / layout.tw
      const scaleY = (vp.clientHeight - 40) / layout.th
      setZoom(Math.min(Math.max(Math.min(scaleX, scaleY), 0.1), 1))
      setPan({ x: 20, y: 20 })
    }, [layout.tw, layout.th])

    // Auto-fit whenever diagram layout changes
    useEffect(() => { fitView() }, [fitView])

    useImperativeHandle(ref, () => ({
      zoomIn,
      zoomOut,
      fitView,
      getZoom: () => zoom,
      getCanvasEl: () => canvasRef.current,
    }), [zoomIn, zoomOut, fitView, zoom])

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      // Only pan on left mouse / primary touch
      if (e.button !== 0 && e.pointerType === 'mouse') return
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      e.currentTarget.setPointerCapture(e.pointerId)
    }, [pan])

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning.current) return
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy })
    }, [])

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      isPanning.current = false
      e.currentTarget.releasePointerCapture(e.pointerId)
    }, [])

    return (
      <div
        ref={viewportRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#f1f5f9',
          cursor: 'grab',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Canvas (white rectangle with diagram content) */}
        <div
          ref={canvasRef}
          style={{
            position: 'absolute',
            width: layout.tw,
            height: layout.th,
            background: '#ffffff',
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            left: pan.x,
            top: pan.y,
          }}
        >
          {/* Standalone section divider */}
          {layout.standaloneY >= 0 && (
            <div
              style={{
                position: 'absolute',
                top: layout.standaloneY,
                left: 0,
                right: 0,
                borderTop: '1.5px dashed #cbd5e1',
                paddingTop: 4,
                paddingLeft: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: '#94a3b8',
                  letterSpacing: '1px',
                  fontWeight: 500,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  textTransform: 'uppercase',
                }}
              >
                Standalone Agents
              </span>
            </div>
          )}

          {/* Agent cards */}
          {diagram.agents.map((agent) => {
            const pos = layout.positions[agent.id]
            if (!pos) return null
            return (
              <AgentCard
                key={agent.id}
                agent={agent}
                x={pos.x}
                y={pos.y}
              />
            )
          })}

          {/* SVG edge layer */}
          <EdgeLayer diagram={diagram} layout={layout} />
        </div>
      </div>
    )
  }
)
