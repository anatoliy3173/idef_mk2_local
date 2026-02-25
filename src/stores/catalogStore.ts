import { create } from 'zustand'
import type { Folder, Tag } from '@/types/diagram'
import {
  fetchFolders as fetchFoldersApi,
  fetchTags as fetchTagsApi,
} from '@/services/catalogService'

interface CatalogState {
  folders: Folder[]
  tags: Tag[]
  activeFolderId: string | null // null = "All Diagrams"
  activeTagIds: string[]
  searchQuery: string

  setActiveFolderId: (id: string | null) => void
  toggleTagFilter: (tagId: string) => void
  setSearchQuery: (query: string) => void
  loadFolders: () => Promise<void>
  loadTags: () => Promise<void>
  setFolders: (folders: Folder[]) => void
  setTags: (tags: Tag[]) => void
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  folders: [],
  tags: [],
  activeFolderId: null,
  activeTagIds: [],
  searchQuery: '',

  setActiveFolderId: (id: string | null) => set({ activeFolderId: id }),

  toggleTagFilter: (tagId: string) => {
    const { activeTagIds } = get()
    if (activeTagIds.includes(tagId)) {
      set({ activeTagIds: activeTagIds.filter((id: string) => id !== tagId) })
    } else {
      set({ activeTagIds: [...activeTagIds, tagId] })
    }
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  loadFolders: async () => {
    const folders = await fetchFoldersApi()
    set({ folders })
  },

  loadTags: async () => {
    const tags = await fetchTagsApi()
    set({ tags })
  },

  setFolders: (folders: Folder[]) => set({ folders }),
  setTags: (tags: Tag[]) => set({ tags }),
}))
