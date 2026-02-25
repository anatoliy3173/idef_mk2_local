import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCatalogStore } from '@/stores/catalogStore'
import {
  createTag,
  updateTag,
  deleteTag as deleteTagApi,
} from '@/services/catalogService'
import type { Tag } from '@/types/diagram'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'

const TAG_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#6366F1', '#14B8A6',
]

interface TagManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TagManager({ open, onOpenChange }: TagManagerProps) {
  const { user } = useAuthStore()
  const { tags, setTags } = useCatalogStore()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(TAG_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  async function handleCreate() {
    if (!user || !newName.trim()) return
    const tag = await createTag(user.id, newName.trim(), newColor)
    if (tag) {
      setTags([...tags, tag])
    }
    setNewName('')
    setNewColor(TAG_COLORS[(tags.length + 1) % TAG_COLORS.length])
    setCreating(false)
  }

  async function handleUpdate(tagId: string) {
    if (!editName.trim()) return
    const updated = await updateTag(tagId, { name: editName.trim(), color: editColor })
    if (updated) {
      setTags(tags.map((t: Tag) => (t.id === tagId ? updated : t)))
    }
    setEditingId(null)
  }

  async function handleDelete(tagId: string) {
    const success = await deleteTagApi(tagId)
    if (success) {
      setTags(tags.filter((t: Tag) => t.id !== tagId))
    }
  }

  function startEditing(tag: Tag) {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {tags.map((tag: Tag) => (
            <div key={tag.id} className="flex items-center gap-2">
              {editingId === tag.id ? (
                <>
                  <div className="flex gap-1 shrink-0">
                    {TAG_COLORS.map((color: string) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          editColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setEditColor(color)}
                      />
                    ))}
                  </div>
                  <Input
                    className="h-7 text-sm flex-1"
                    value={editName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') handleUpdate(tag.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdate(tag.id)}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm flex-1">{tag.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => startEditing(tag)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(tag.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          ))}

          {tags.length === 0 && !creating && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tags created yet. Create your first tag to organize diagrams.
            </p>
          )}
        </div>

        {/* Create new tag */}
        {creating ? (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex gap-1 flex-wrap">
              {TAG_COLORS.map((color: string) => (
                <button
                  key={color}
                  type="button"
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    newColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewColor(color)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={newName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') setCreating(false)
                }}
                placeholder="Tag name..."
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={handleCreate}>
                Create
              </Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Tag
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
