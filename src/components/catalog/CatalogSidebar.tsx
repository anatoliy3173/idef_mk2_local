import { useState } from 'react'
import { useCatalogStore } from '@/stores/catalogStore'
import { useAuthStore } from '@/stores/authStore'
import {
  createFolder,
  updateFolder,
  deleteFolder as deleteFolderApi,
} from '@/services/catalogService'
import type { Folder, Tag as TagType } from '@/types/diagram'
import { Button } from '@/components/ui/button'
import {
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
  Check,
  X,
  Tag,
  LayoutGrid,
} from 'lucide-react'

const FOLDER_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#6B7280',
]

interface DiagramCountMap {
  [folderId: string]: number
}

interface CatalogSidebarProps {
  diagramCounts: DiagramCountMap
  totalDiagrams: number
  onManageTags: () => void
}

export function CatalogSidebar({ diagramCounts, totalDiagrams, onManageTags }: CatalogSidebarProps) {
  const { user } = useAuthStore()
  const {
    folders,
    tags,
    activeFolderId,
    activeTagIds,
    setActiveFolderId,
    toggleTagFilter,
    setFolders,
  } = useCatalogStore()

  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editFolderName, setEditFolderName] = useState('')

  async function handleCreateFolder() {
    if (!user || !newFolderName.trim()) return
    const folder = await createFolder(user.id, newFolderName.trim(), FOLDER_COLORS[folders.length % FOLDER_COLORS.length])
    if (folder) {
      setFolders([...folders, folder])
    }
    setNewFolderName('')
    setCreatingFolder(false)
  }

  async function handleRenameFolder(folderId: string) {
    if (!editFolderName.trim()) return
    const updated = await updateFolder(folderId, { name: editFolderName.trim() })
    if (updated) {
      setFolders(folders.map((f: Folder) => (f.id === folderId ? updated : f)))
    }
    setEditingFolderId(null)
  }

  async function handleDeleteFolder(folderId: string) {
    const success = await deleteFolderApi(folderId)
    if (success) {
      setFolders(folders.filter((f: Folder) => f.id !== folderId))
      if (activeFolderId === folderId) {
        setActiveFolderId(null)
      }
    }
  }

  return (
    <div className="w-56 shrink-0 bg-white border-r h-full flex flex-col">
      {/* All Diagrams */}
      <div className="px-3 pt-4 pb-2">
        <button
          type="button"
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
            activeFolderId === null
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-stone-700 hover:bg-stone-100'
          }`}
          onClick={() => setActiveFolderId(null)}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>All Diagrams</span>
          <span className="ml-auto text-xs text-muted-foreground">{totalDiagrams}</span>
        </button>
      </div>

      {/* Folders */}
      <div className="px-3 pt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Folders
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setCreatingFolder(true)}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="space-y-0.5">
          {folders.map((folder: Folder) => (
            <div key={folder.id} className="group">
              {editingFolderId === folder.id ? (
                <div className="flex items-center gap-1 py-0.5">
                  <input
                    className="flex-1 text-sm border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
                    value={editFolderName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditFolderName(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') handleRenameFolder(folder.id)
                      if (e.key === 'Escape') setEditingFolderId(null)
                    }}
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => handleRenameFolder(folder.id)}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => setEditingFolderId(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    activeFolderId === folder.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                  onClick={() => setActiveFolderId(folder.id)}
                >
                  <FolderOpen
                    className="w-4 h-4 shrink-0"
                    style={{ color: folder.color ?? '#6B7280' }}
                  />
                  <span className="truncate text-left flex-1">{folder.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {diagramCounts[folder.id] ?? 0}
                  </span>
                  {/* Hover actions */}
                  <span className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
                    <span
                      role="button"
                      tabIndex={0}
                      className="p-0.5 rounded hover:bg-stone-200"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        setEditFolderName(folder.name)
                        setEditingFolderId(folder.id)
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation()
                          setEditFolderName(folder.name)
                          setEditingFolderId(folder.id)
                        }
                      }}
                    >
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="p-0.5 rounded hover:bg-red-100"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation()
                        handleDeleteFolder(folder.id)
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation()
                          handleDeleteFolder(folder.id)
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </span>
                  </span>
                </button>
              )}
            </div>
          ))}

          {/* Create new folder inline */}
          {creatingFolder && (
            <div className="flex items-center gap-1 py-0.5">
              <input
                className="flex-1 text-sm border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
                value={newFolderName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFolderName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') setCreatingFolder(false)
                }}
                placeholder="Folder name..."
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={handleCreateFolder}
              >
                <Check className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => setCreatingFolder(false)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          {folders.length === 0 && !creatingFolder && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              No folders yet
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="px-3 pt-4 flex-1 min-h-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tags
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onManageTags}
          >
            <Tag className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-1">
          {tags.map((tag: TagType) => (
            <button
              key={tag.id}
              type="button"
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border ${
                activeTagIds.includes(tag.id)
                  ? 'ring-2 ring-offset-1 ring-primary/30'
                  : 'opacity-80 hover:opacity-100'
              }`}
              style={{
                backgroundColor: `${tag.color}20`,
                borderColor: `${tag.color}40`,
                color: tag.color,
              }}
              onClick={() => toggleTagFilter(tag.id)}
            >
              {tag.name}
            </button>
          ))}
          {tags.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">
              No tags yet
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
