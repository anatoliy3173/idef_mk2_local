import { toPng, toSvg } from 'html-to-image'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import type { Node } from '@xyflow/react'

interface ExportOptions {
  quality?: 'high' | 'ultra'
  backgroundColor?: string
  padding?: number
  isGridMode?: boolean
}

function downloadFile(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function exportToPNG(
  element: HTMLElement,
  nodes: Node[],
  options: ExportOptions = {}
): Promise<void> {
  const { quality = 'high', backgroundColor = '#ffffff', padding = 16, isGridMode = false } = options

  const pixelRatio = quality === 'ultra' ? 4 : 2

  if (isGridMode) {
    // Grid mode: capture the element at its natural dimensions
    const width = element.scrollWidth + padding * 2
    const height = element.scrollHeight + padding * 2

    const dataUrl = await toPng(element, {
      backgroundColor,
      width,
      height,
      pixelRatio,
      skipFonts: true,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        padding: `${padding}px`,
        overflow: 'visible',
      },
    })

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
    downloadFile(dataUrl, `agent-diagram-grid-${timestamp}.png`)
    return
  }

  // Flow mode: use React Flow viewport transform
  const nodesBounds = getNodesBounds(nodes)
  const width = nodesBounds.width + padding * 2
  const height = nodesBounds.height + padding * 2

  const viewport = getViewportForBounds(
    nodesBounds,
    width,
    height,
    1,
    1,
    padding
  )

  const dataUrl = await toPng(element, {
    backgroundColor,
    width,
    height,
    pixelRatio,
    skipFonts: true,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  })

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
  downloadFile(dataUrl, `agent-diagram-${timestamp}.png`)
}

export async function exportToSVG(
  element: HTMLElement,
  nodes: Node[],
  options: ExportOptions = {}
): Promise<void> {
  const { backgroundColor = '#ffffff', padding = 16, isGridMode = false } = options

  if (isGridMode) {
    // Grid mode: capture at natural dimensions
    const width = element.scrollWidth + padding * 2
    const height = element.scrollHeight + padding * 2

    const dataUrl = await toSvg(element, {
      backgroundColor,
      width,
      height,
      skipFonts: true,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        padding: `${padding}px`,
        overflow: 'visible',
      },
    })

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
    downloadFile(dataUrl, `agent-diagram-grid-${timestamp}.svg`)
    return
  }

  // Flow mode: use React Flow viewport transform
  const nodesBounds = getNodesBounds(nodes)
  const width = nodesBounds.width + padding * 2
  const height = nodesBounds.height + padding * 2

  const viewport = getViewportForBounds(
    nodesBounds,
    width,
    height,
    1,
    1,
    padding
  )

  const dataUrl = await toSvg(element, {
    backgroundColor,
    width,
    height,
    skipFonts: true,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  })

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
  downloadFile(dataUrl, `agent-diagram-${timestamp}.svg`)
}
