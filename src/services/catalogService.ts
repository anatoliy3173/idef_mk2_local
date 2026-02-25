import { api } from '@/services/apiClient'
import type { Folder, Tag } from '@/types/diagram'

// ── Folder Operations ──

export async function fetchFolders(): Promise<Folder[]> {
  try {
    return await api.folders.list()
  } catch {
    return []
  }
}

export async function createFolder(
  name: string,
  color?: string,
  parentId?: string
): Promise<Folder | null> {
  try {
    return await api.folders.create({ name, color, parent_id: parentId })
  } catch {
    return null
  }
}

export async function updateFolder(
  folderId: string,
  updates: { name?: string; color?: string | null }
): Promise<Folder | null> {
  try {
    return await api.folders.update(folderId, updates)
  } catch {
    return null
  }
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  try {
    await api.folders.delete(folderId)
    return true
  } catch {
    return false
  }
}

export async function moveDiagramToFolder(
  diagramId: string,
  folderId: string | null
): Promise<boolean> {
  try {
    await api.diagrams.update(diagramId, { folder_id: folderId })
    return true
  } catch {
    return false
  }
}

// ── Tag Operations ──

export async function fetchTags(): Promise<Tag[]> {
  try {
    return await api.tags.list()
  } catch {
    return []
  }
}

export async function createTag(
  name: string,
  color: string
): Promise<Tag | null> {
  try {
    return await api.tags.create({ name, color })
  } catch {
    return null
  }
}

export async function updateTag(
  tagId: string,
  updates: { name?: string; color?: string }
): Promise<Tag | null> {
  try {
    return await api.tags.update(tagId, updates)
  } catch {
    return null
  }
}

export async function deleteTag(tagId: string): Promise<boolean> {
  try {
    await api.tags.delete(tagId)
    return true
  } catch {
    return false
  }
}

export async function addTagToDiagram(diagramId: string, tagId: string): Promise<boolean> {
  try {
    await api.diagramTags.add(diagramId, tagId)
    return true
  } catch {
    return false
  }
}

export async function removeTagFromDiagram(diagramId: string, tagId: string): Promise<boolean> {
  try {
    await api.diagramTags.remove(diagramId, tagId)
    return true
  } catch {
    return false
  }
}

export async function fetchDiagramTagIds(diagramId: string): Promise<string[]> {
  try {
    const map = await api.diagramTags.batchFetch([diagramId])
    return map[diagramId] ?? []
  } catch {
    return []
  }
}

export async function fetchAllDiagramTags(
  diagramIds: string[]
): Promise<Record<string, string[]>> {
  if (diagramIds.length === 0) return {}
  try {
    return await api.diagramTags.batchFetch(diagramIds)
  } catch {
    return {}
  }
}
