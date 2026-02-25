import { api } from '@/services/apiClient'
import type { DiagramVersion, NodePositionMap } from '@/types/diagram'

export async function createVersion(
  diagramId: string,
  xmlContent: string,
  nodePositions: NodePositionMap,
  label?: string
): Promise<DiagramVersion | null> {
  try {
    return await api.versions.create(diagramId, {
      xml_content: xmlContent,
      node_positions: nodePositions,
      label,
    })
  } catch (e: unknown) {
    console.error('[VersionService] Create failed:', e)
    return null
  }
}

export async function listVersions(diagramId: string): Promise<DiagramVersion[]> {
  try {
    return await api.versions.list(diagramId)
  } catch {
    return []
  }
}

export async function getVersion(versionId: string): Promise<DiagramVersion | null> {
  try {
    return await api.versions.get(versionId)
  } catch {
    return null
  }
}

export async function updateVersionLabel(versionId: string, label: string): Promise<boolean> {
  try {
    await api.versions.updateLabel(versionId, label)
    return true
  } catch {
    return false
  }
}

export async function deleteVersion(versionId: string): Promise<boolean> {
  try {
    await api.versions.delete(versionId)
    return true
  } catch {
    return false
  }
}
