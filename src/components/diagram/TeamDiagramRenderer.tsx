import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { toPng } from 'html-to-image'
import type { TeamDiagram } from '@/types/teamDiagram'
import { buildLayout } from '@/services/teamLayoutEngine'
import { useDiagramStore } from '@/stores/diagramStore'
import { DiagramCanvas, type DiagramCanvasHandle } from './DiagramCanvas'
import { DiagramToolbar } from './DiagramToolbar'
import { DiagramLegend } from './DiagramLegend'

interface TeamDiagramRendererProps {
  diagram: TeamDiagram
}

const EXPORT_NOTES = `Word Document Integration Notes:

When inserting the exported PNG into Word:
1. Disable image compression:
   File → Options → Advanced → uncheck "Do not compress images in file"
   (or set target output to "High fidelity (maximum ppi)")
2. Use Print to PDF (not Save as PDF)
   "Save as PDF" silently downsamples images to ~200 DPI.
   "Print to PDF" preserves the full 300 DPI source quality.`

export function TeamDiagramRenderer({ diagram }: TeamDiagramRendererProps) {
  const canvasHandle = useRef<DiagramCanvasHandle>(null)
  const [zoom, setZoom] = useState(0.82)
  const [isExporting, setIsExporting] = useState(false)
  const [showExportNotes, setShowExportNotes] = useState(false)

  const { layoutMaxPerRow } = useDiagramStore()
  const layout = useMemo(
    () => buildLayout(diagram, { maxPerRow: layoutMaxPerRow }),
    [diagram, layoutMaxPerRow],
  )

  // Sync zoom from canvas handle to display in toolbar
  useEffect(() => {
    const interval = setInterval(() => {
      if (canvasHandle.current) {
        setZoom(canvasHandle.current.getZoom())
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  const handleZoomIn = useCallback(() => {
    canvasHandle.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    canvasHandle.current?.zoomOut()
  }, [])

  const handleFitView = useCallback(() => {
    canvasHandle.current?.fitView()
  }, [])

  const handleExport = useCallback(async () => {
    const canvasEl = canvasHandle.current?.getCanvasEl()
    if (!canvasEl) return

    setIsExporting(true)
    try {
      const dataUrl = await toPng(canvasEl, {
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        width: layout.tw,
        height: layout.th,
        style: {
          transform: 'none',
          left: '0px',
          top: '0px',
        },
      })

      const link = document.createElement('a')
      link.download = `${diagram.meta.name.replace(/[^a-z0-9]/gi, '_')}_diagram.png`
      link.href = dataUrl
      link.click()

      // Show Word integration notes after export
      setShowExportNotes(true)
    } catch (err) {
      console.error('[Export] Failed to export diagram:', err)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [diagram.meta.name, layout.tw, layout.th])

  const agentTypes = diagram.agents.map((a) => a.type)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DiagramToolbar
        meta={diagram.meta}
        agentCount={diagram.agents.length}
        connectionCount={diagram.connections.length}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onExport={handleExport}
        isExporting={isExporting}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <DiagramCanvas
          ref={canvasHandle}
          diagram={diagram}
          layout={layout}
        />
      </div>

      <DiagramLegend agentTypes={agentTypes} />

      {/* Export notes modal */}
      {showExportNotes && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowExportNotes(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
              PNG Exported Successfully
            </h3>
            <pre
              style={{
                fontSize: 12,
                color: '#475569',
                background: '#f8fafc',
                borderRadius: 6,
                padding: 12,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                border: '1px solid #e2e8f0',
              }}
            >
              {EXPORT_NOTES}
            </pre>
            <button
              onClick={() => setShowExportNotes(false)}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
