import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  addTagToDiagram,
  removeTagFromDiagram,
  moveDiagramToFolder,
} from '@/services/catalogService'
import {
  FileText,
  Trash2,
  Copy,
  ExternalLink,
  MoreVertical,
  FolderOpen,
  Tag,
  Check,
} from 'lucide-react'
import type { DiagramRecord, Tag as TagType, Folder } from '@/types/diagram'

interface DiagramCardProps {
  diagram: DiagramRecord
  tags: TagType[]
  allTags: TagType[]
  diagramTagIds: string[]
  folders: Folder[]
  onDelete: (id: string) => void
  onDuplicate: (diagram: DiagramRecord) => void
  onTagsChange: () => void
  onFolderChange: () => void
}

export function DiagramCard({
  diagram,
  tags,
  allTags,
  diagramTagIds,
  folders,
  onDelete,
  onDuplicate,
  onTagsChange,
  onFolderChange,
}: DiagramCardProps) {
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const updatedAt = new Date(diagram.updated_at)
  const timeAgo = getTimeAgo(updatedAt)

  async function handleToggleTag(tagId: string) {
    if (diagramTagIds.includes(tagId)) {
      await removeTagFromDiagram(diagram.id, tagId)
    } else {
      await addTagToDiagram(diagram.id, tagId)
    }
    onTagsChange()
  }

  async function handleMoveToFolder(folderId: string | null) {
    await moveDiagramToFolder(diagram.id, folderId)
    onFolderChange()
  }

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader
        className="cursor-pointer"
        onClick={() => navigate(`/editor/${diagram.id}`)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">{diagram.title}</CardTitle>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <CardDescription>
          Last updated {timeAgo}
        </CardDescription>
      </CardHeader>

      {/* Thumbnail preview */}
      <div
        className="px-4 pb-2 cursor-pointer"
        onClick={() => navigate(`/editor/${diagram.id}`)}
      >
        {diagram.thumbnail ? (
          <img
            src={diagram.thumbnail}
            alt={`Preview of ${diagram.title}`}
            className="w-full h-32 object-contain bg-stone-50 rounded border"
          />
        ) : (
          <div className="w-full h-32 bg-stone-50 rounded border flex items-center justify-center">
            <FileText className="w-10 h-10 text-stone-300" />
          </div>
        )}
      </div>

      {/* Tag badges */}
      {tags.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {tags.map((tag: TagType) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
              style={{
                backgroundColor: `${tag.color}15`,
                borderColor: `${tag.color}30`,
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <CardFooter className="flex items-center justify-between">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(diagram)}
          >
            <Copy className="w-4 h-4 mr-1" />
            Duplicate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>

        {/* Dropdown for folder/tag actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Move to folder */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderOpen className="w-3.5 h-3.5 mr-2" />
                Move to Folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleMoveToFolder(null)}>
                  <span className="flex items-center gap-2">
                    No Folder
                    {diagram.folder_id === null && <Check className="w-3 h-3 ml-auto" />}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {folders.map((folder: Folder) => (
                  <DropdownMenuItem key={folder.id} onClick={() => handleMoveToFolder(folder.id)}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: folder.color ?? '#6B7280' }}
                      />
                      {folder.name}
                      {diagram.folder_id === folder.id && <Check className="w-3 h-3 ml-auto" />}
                    </span>
                  </DropdownMenuItem>
                ))}
                {folders.length === 0 && (
                  <DropdownMenuItem disabled>
                    <span className="text-muted-foreground text-xs">No folders created</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Assign tags */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tag className="w-3.5 h-3.5 mr-2" />
                Tags
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {allTags.map((tag: TagType) => (
                  <DropdownMenuItem key={tag.id} onClick={() => handleToggleTag(tag.id)}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                      {diagramTagIds.includes(tag.id) && <Check className="w-3 h-3 ml-auto" />}
                    </span>
                  </DropdownMenuItem>
                ))}
                {allTags.length === 0 && (
                  <DropdownMenuItem disabled>
                    <span className="text-muted-foreground text-xs">No tags created</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete diagram?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{diagram.title}&rdquo;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(diagram.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return date.toLocaleDateString()
}
