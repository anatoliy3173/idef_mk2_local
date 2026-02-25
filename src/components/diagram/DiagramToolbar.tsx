import { ZoomIn, ZoomOut, Maximize2, Download, Loader2 } from 'lucide-react'
import type { TeamMeta } from '@/types/teamDiagram'

interface DiagramToolbarProps {
  meta: TeamMeta
  agentCount: number
  connectionCount: number
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onExport: () => void
  isExporting: boolean
}

export function DiagramToolbar({
  meta,
  agentCount,
  connectionCount,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  onExport,
  isExporting,
}: DiagramToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        flexShrink: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Left: team info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
          {meta.name}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {agentCount} agents · {connectionCount} connections
        </span>
      </div>

      {/* Right: controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#64748b', marginRight: 8 }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={onZoomIn} title="Zoom in" style={btnStyle}>
          <ZoomIn size={14} />
        </button>
        <button onClick={onZoomOut} title="Zoom out" style={btnStyle}>
          <ZoomOut size={14} />
        </button>
        <button onClick={onFitView} title="Fit view" style={btnStyle}>
          <Maximize2 size={14} />
        </button>
        <div style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' }} />
        <button
          onClick={onExport}
          disabled={isExporting}
          title="Export PNG"
          style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
        >
          {isExporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
          <span style={{ fontSize: 11 }}>Export PNG</span>
        </button>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  background: '#ffffff',
  cursor: 'pointer',
  color: '#475569',
  padding: 0,
}
