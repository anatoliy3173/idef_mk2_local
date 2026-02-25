import { supabase } from '@/services/supabaseClient'
import type { DiagramVersion, NodePositionMap } from '@/types/diagram'

const MAX_VERSIONS_PER_DIAGRAM = 100

/**
 * Creates a new version snapshot for a diagram.
 * Auto-increments version_number and enforces max cap.
 */
export async function createVersion(
  diagramId: string,
  userId: string,
  xmlContent: string,
  nodePositions: NodePositionMap,
  label?: string
): Promise<DiagramVersion | null> {
  try {
    // Get current max version number
    const { data: existing } = await supabase
      .from('diagram_versions')
      .select('version_number')
      .eq('diagram_id', diagramId)
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVersion = existing && existing.length > 0
      ? (existing[0].version_number as number) + 1
      : 1

    // Insert new version
    const { data, error } = await supabase
      .from('diagram_versions')
      .insert({
        diagram_id: diagramId,
        user_id: userId,
        version_number: nextVersion,
        label: label ?? null,
        xml_content: xmlContent,
        node_positions: nodePositions,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('[VersionService] Create failed:', error?.message)
      return null
    }

    // Update version_count on the diagram
    await supabase
      .from('diagrams')
      .update({ version_count: nextVersion })
      .eq('id', diagramId)

    // Enforce max cap: delete oldest versions if exceeded
    const { data: allVersions } = await supabase
      .from('diagram_versions')
      .select('id, version_number')
      .eq('diagram_id', diagramId)
      .order('version_number', { ascending: true })

    if (allVersions && allVersions.length > MAX_VERSIONS_PER_DIAGRAM) {
      const excess = allVersions.length - MAX_VERSIONS_PER_DIAGRAM
      const toDelete = allVersions.slice(0, excess).map((v: { id: string }) => v.id)
      await supabase
        .from('diagram_versions')
        .delete()
        .in('id', toDelete)
    }

    return data as DiagramVersion
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[VersionService] Exception:', message)
    return null
  }
}

/**
 * Lists all versions for a diagram, newest first.
 */
export async function listVersions(diagramId: string): Promise<DiagramVersion[]> {
  const { data, error } = await supabase
    .from('diagram_versions')
    .select('*')
    .eq('diagram_id', diagramId)
    .order('version_number', { ascending: false })

  if (error || !data) return []
  return data as DiagramVersion[]
}

/**
 * Gets a single version by ID.
 */
export async function getVersion(versionId: string): Promise<DiagramVersion | null> {
  const { data, error } = await supabase
    .from('diagram_versions')
    .select('*')
    .eq('id', versionId)
    .single()

  if (error || !data) return null
  return data as DiagramVersion
}

/**
 * Updates a version's label.
 */
export async function updateVersionLabel(versionId: string, label: string): Promise<boolean> {
  const { error } = await supabase
    .from('diagram_versions')
    .update({ label })
    .eq('id', versionId)

  return !error
}

/**
 * Deletes a version.
 */
export async function deleteVersion(versionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('diagram_versions')
    .delete()
    .eq('id', versionId)

  return !error
}
