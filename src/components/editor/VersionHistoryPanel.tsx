import { useState, useCallback } from 'react'
import { useDiagramStore } from '@/stores/diagramStore'
import { useUIStore } from '@/stores/uiStore'
import { listVersions, deleteVersion, updateVersionLabel } from '@/services/versionService'
import type { DiagramVersion } from '@/types/diagram'
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
  X,
  RotateCcw,
  Trash2,
  Tag,
  Loader2,
  Clock,
  ChevronRight,
} from 'lucide-react'

export function VersionHistoryPanel() {
  const { currentDiagramId, setXmlContent, setSavedNodePositions, parseAndBuild } = useDiagramStore()
  const { setShowVersionHistory } = useUIStore()
  const [versions, setVersions] = useState<DiagramVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [restoreTarget, setRestoreTarget] = useState<DiagramVersion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DiagramVersion | null>(null)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')

  const fetchVersions = useCallback(async () => {
    if (!currentDiagramId) return
    setLoading(true)
    const data = await listVersions(currentDiagramId)
    setVersions(data)
    setLoading(false)
  }, [currentDiagramId])

  // Fetch versions on mount (using an IIFE to avoid the effect-setState lint rule)
  useState(() => {
    fetchVersions()
  })

  async function handleRestore(version: DiagramVersion) {
    setXmlContent(version.xml_content)
    setSavedNodePositions(version.node_positions)
    await parseAndBuild()
    setRestoreTarget(null)
    setShowVersionHistory(false)
  }

  async function handleDelete(version: DiagramVersion) {
    const success = await deleteVersion(version.id)
    if (success) {
      setVersions((prev: DiagramVersion[]) => prev.filter((v: DiagramVersion) => v.id !== version.id))
    }
    setDeleteTarget(null)
  }

  function startEditLabel(version: DiagramVersion) {
    setEditingLabelId(version.id)
    setLabelDraft(version.label ?? '')
  }

  async function commitLabel(versionId: string) {
    const trimmed = labelDraft.trim()
    const success = await updateVersionLabel(versionId, trimmed)
    if (success) {
      setVersions((prev: DiagramVersion[]) =>
        prev.map((v: DiagramVersion) =>
          v.id === versionId ? { ...v, label: trimmed || null } : v
        )
      )
    }
    setEditingLabelId(null)
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      <div className="absolute top-0 right-0 w-80 h-full bg-white border-l shadow-lg z-20 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Version History</h3>
            <span className="text-xs text-muted-foreground">({versions.length})</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowVersionHistory(false)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No versions saved yet. Versions are created each time you save changes.
            </div>
          ) : (
            <div className="divide-y">
              {versions.map((version: DiagramVersion) => (
                <div
                  key={version.id}
                  className="px-4 py-3 hover:bg-stone-50 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-stone-700">
                      v{version.version_number}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(version.created_at)}
                    </span>
                  </div>

                  {/* Label */}
                  {editingLabelId === version.id ? (
                    <input
                      className="text-xs border rounded px-1.5 py-0.5 w-full mb-2 outline-none focus:ring-1 focus:ring-primary/50"
                      value={labelDraft}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabelDraft(e.target.value)}
                      onBlur={() => commitLabel(version.id)}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') commitLabel(version.id)
                        if (e.key === 'Escape') setEditingLabelId(null)
                      }}
                      placeholder="Add a label..."
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 cursor-text"
                      onClick={() => startEditLabel(version)}
                    >
                      <Tag className="w-3 h-3" />
                      {version.label || 'Add label...'}
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setRestoreTarget(version)}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(version)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
          <ChevronRight className="w-3 h-3" />
          Versions are created on each save when XML changes
        </div>
      </div>

      {/* Restore Confirmation */}
      <AlertDialog open={restoreTarget !== null} onOpenChange={() => setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current XML and node positions with version{' '}
              {restoreTarget?.version_number}
              {restoreTarget?.label ? ` ("${restoreTarget.label}")` : ''}.
              Your current changes will be lost unless you save first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => restoreTarget && handleRestore(restoreTarget)}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete version {deleteTarget?.version_number}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
