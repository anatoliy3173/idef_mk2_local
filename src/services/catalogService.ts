import { supabase } from '@/services/supabaseClient'
import type { Folder, Tag } from '@/types/diagram'

// ── Folder Operations ──

export async function fetchFolders(userId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error || !data) return []
  return data as Folder[]
}

export async function createFolder(
  userId: string,
  name: string,
  color?: string,
  parentId?: string
): Promise<Folder | null> {
  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name,
      color: color ?? null,
      parent_id: parentId ?? null,
    })
    .select()
    .single()

  if (error || !data) return null
  return data as Folder
}

export async function updateFolder(
  folderId: string,
  updates: { name?: string; color?: string | null }
): Promise<Folder | null> {
  const { data, error } = await supabase
    .from('folders')
    .update(updates)
    .eq('id', folderId)
    .select()
    .single()

  if (error || !data) return null
  return data as Folder
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId)

  return !error
}

export async function moveDiagramToFolder(
  diagramId: string,
  folderId: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('diagrams')
    .update({ folder_id: folderId })
    .eq('id', diagramId)

  return !error
}

// ── Tag Operations ──

export async function fetchTags(userId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error || !data) return []
  return data as Tag[]
}

export async function createTag(
  userId: string,
  name: string,
  color: string
): Promise<Tag | null> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: userId, name, color })
    .select()
    .single()

  if (error || !data) return null
  return data as Tag
}

export async function updateTag(
  tagId: string,
  updates: { name?: string; color?: string }
): Promise<Tag | null> {
  const { data, error } = await supabase
    .from('tags')
    .update(updates)
    .eq('id', tagId)
    .select()
    .single()

  if (error || !data) return null
  return data as Tag
}

export async function deleteTag(tagId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId)

  return !error
}

export async function addTagToDiagram(diagramId: string, tagId: string): Promise<boolean> {
  const { error } = await supabase
    .from('diagram_tags')
    .upsert({ diagram_id: diagramId, tag_id: tagId })

  return !error
}

export async function removeTagFromDiagram(diagramId: string, tagId: string): Promise<boolean> {
  const { error } = await supabase
    .from('diagram_tags')
    .delete()
    .eq('diagram_id', diagramId)
    .eq('tag_id', tagId)

  return !error
}

export async function fetchDiagramTagIds(diagramId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('diagram_tags')
    .select('tag_id')
    .eq('diagram_id', diagramId)

  if (error || !data) return []
  return data.map((row: { tag_id: string }) => row.tag_id)
}

/**
 * Fetches all diagram_tags for a user's diagrams (batch).
 * Returns a map: diagramId -> tagId[]
 */
export async function fetchAllDiagramTags(
  diagramIds: string[]
): Promise<Record<string, string[]>> {
  if (diagramIds.length === 0) return {}

  const { data, error } = await supabase
    .from('diagram_tags')
    .select('diagram_id, tag_id')
    .in('diagram_id', diagramIds)

  if (error || !data) return {}

  const map: Record<string, string[]> = {}
  for (const row of data as Array<{ diagram_id: string; tag_id: string }>) {
    if (!map[row.diagram_id]) {
      map[row.diagram_id] = []
    }
    map[row.diagram_id].push(row.tag_id)
  }
  return map
}
