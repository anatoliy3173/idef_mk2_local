import { toPng } from 'html-to-image'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import type { Node } from '@xyflow/react'

const MAX_THUMB_WIDTH = 400
const MAX_THUMB_HEIGHT = 300
const PADDING = 16

/**
 * Generates a low-resolution base64-encoded PNG thumbnail of the current diagram.
 * Renders nodes at 1:1 CSS size (same as export), then scales the output image
 * down to thumbnail dimensions via pixelRatio.
 * Returns null on any failure (thumbnails are non-critical).
 */
export async function generateThumbnail(
  element: HTMLElement,
  nodes: Node[],
  options?: { isGridMode?: boolean }
): Promise<string | null> {
  if (nodes.length === 0) return null

  const isGridMode = options?.isGridMode ?? false

  try {
    if (isGridMode) {
      // Grid mode: capture the element at its natural scroll dimensions
      const fullWidth = element.scrollWidth + PADDING * 2
      const fullHeight = element.scrollHeight + PADDING * 2

      const thumbScale = Math.min(MAX_THUMB_WIDTH / fullWidth, MAX_THUMB_HEIGHT / fullHeight, 1)

      const dataUrl = await toPng(element, {
        backgroundColor: '#ffffff',
        width: fullWidth,
        height: fullHeight,
        pixelRatio: thumbScale,
        skipFonts: true,
        style: {
          width: `${fullWidth}px`,
          height: `${fullHeight}px`,
          padding: `${PADDING}px`,
          overflow: 'visible',
        },
      })

      return dataUrl
    }

    // Flow mode: use React Flow viewport
    const nodesBounds = getNodesBounds(nodes)

    // Render at full size (1:1 zoom, same as exportToPNG)
    const fullWidth = nodesBounds.width + PADDING * 2
    const fullHeight = nodesBounds.height + PADDING * 2

    const viewport = getViewportForBounds(
      nodesBounds,
      fullWidth,
      fullHeight,
      1,    // minZoom = 1 (render nodes at actual CSS size)
      1,    // maxZoom = 1
      PADDING
    )

    // Scale the pixel output down to thumbnail dimensions via pixelRatio
    const thumbScale = Math.min(MAX_THUMB_WIDTH / fullWidth, MAX_THUMB_HEIGHT / fullHeight, 1)

    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      width: fullWidth,
      height: fullHeight,
      pixelRatio: thumbScale,  // Scales the output image to thumbnail size
      skipFonts: true,          // Avoid cross-origin CSS SecurityErrors
      style: {
        width: `${fullWidth}px`,
        height: `${fullHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    })

    return dataUrl
  } catch {
    // Thumbnail generation is non-critical; silently return null
    return null
  }
}
