import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabaseClient'
import { useAuthStore } from '@/stores/authStore'
import { useCatalogStore } from '@/stores/catalogStore'
import { fetchAllDiagramTags } from '@/services/catalogService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DiagramCard } from './DiagramCard'
import { CatalogSidebar } from './CatalogSidebar'
import { TagManager } from './TagManager'
import type { DiagramRecord, Tag } from '@/types/diagram'
import { Plus, LogOut, Loader2, FileText, Search } from 'lucide-react'

export function CatalogPage() {
  const [diagrams, setDiagrams] = useState<DiagramRecord[]>([])
  const [diagramTagMap, setDiagramTagMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [showTagManager, setShowTagManager] = useState(false)
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const {
    activeFolderId,
    activeTagIds,
    searchQuery,
    setSearchQuery,
    tags,
    loadFolders,
    loadTags,
  } = useCatalogStore()

  const fetchDiagrams = useCallback(async () => {
    if (!user) return
    setLoading(true)

    let query = supabase
      .from('diagrams')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (activeFolderId !== null) {
      query = query.eq('folder_id', activeFolderId)
    }

    const { data, error } = await query

    if (!error && data) {
      const records = data as DiagramRecord[]
      setDiagrams(records)

      // Fetch tag associations for all diagrams
      const ids = records.map((d: DiagramRecord) => d.id)
      const tagMap = await fetchAllDiagramTags(ids)
      setDiagramTagMap(tagMap)
    }
    setLoading(false)
  }, [user, activeFolderId])

  useEffect(() => {
    fetchDiagrams()
  }, [fetchDiagrams])

  // Load folders and tags on mount
  useEffect(() => {
    if (user) {
      loadFolders(user.id)
      loadTags(user.id)
    }
  }, [user, loadFolders, loadTags])

  async function handleCreateNew() {
    if (!user) return
    const insertData: Record<string, unknown> = {
      user_id: user.id,
      title: 'Untitled Diagram',
      xml_content: '',
    }
    if (activeFolderId) {
      insertData.folder_id = activeFolderId
    }

    const { data, error } = await supabase
      .from('diagrams')
      .insert(insertData)
      .select()
      .single()

    if (!error && data) {
      navigate(`/editor/${data.id}`)
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('diagrams').delete().eq('id', id)
    if (!error) {
      setDiagrams((prev: DiagramRecord[]) => prev.filter((d: DiagramRecord) => d.id !== id))
    }
  }

  async function handleDuplicate(diagram: DiagramRecord) {
    if (!user) return
    const { data, error } = await supabase
      .from('diagrams')
      .insert({
        user_id: user.id,
        title: `${diagram.title} (Copy)`,
        xml_content: diagram.xml_content,
        node_positions: diagram.node_positions ?? {},
        folder_id: diagram.folder_id ?? null,
      })
      .select()
      .single()

    if (!error && data) {
      setDiagrams((prev: DiagramRecord[]) => [data as DiagramRecord, ...prev])
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  // Filter diagrams by tags and search query (client-side)
  const filteredDiagrams = diagrams.filter((d: DiagramRecord) => {
    // Tag filter: diagram must have ALL active tags
    if (activeTagIds.length > 0) {
      const diagramTags = diagramTagMap[d.id] ?? []
      const hasAllTags = activeTagIds.every((tagId: string) => diagramTags.includes(tagId))
      if (!hasAllTags) return false
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (!d.title.toLowerCase().includes(q)) return false
    }

    return true
  })

  // Compute folder diagram counts (from unfiltered diagrams)
  const folderCounts: Record<string, number> = {}
  for (const d of diagrams) {
    const fid = d.folder_id ?? '__none__'
    folderCounts[fid] = (folderCounts[fid] ?? 0) + 1
  }

  // Get tag objects for a diagram
  function getTagsForDiagram(diagramId: string): Tag[] {
    const tagIds = diagramTagMap[diagramId] ?? []
    return tags.filter((t: Tag) => tagIds.includes(t.id))
  }

  const username = user?.email?.split('@')[0] ?? 'User'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shrink-0">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#d97757] rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <h1 className="text-lg font-semibold">Agent Diagram Generator</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Hello, {username}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <CatalogSidebar
          diagramCounts={folderCounts}
          totalDiagrams={diagrams.length}
          onManageTags={() => setShowTagManager(true)}
        />

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {activeFolderId
                    ? useCatalogStore.getState().folders.find((f) => f.id === activeFolderId)?.name ?? 'Folder'
                    : 'My Diagrams'}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {filteredDiagrams.length} diagram{filteredDiagrams.length !== 1 ? 's' : ''}
                  {activeTagIds.length > 0 ? ` (filtered by ${activeTagIds.length} tag${activeTagIds.length > 1 ? 's' : ''})` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 w-56 pl-8 text-sm"
                    placeholder="Search diagrams..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreateNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Diagram
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDiagrams.length === 0 ? (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-stone-900 mb-2">
                  {searchQuery || activeTagIds.length > 0 ? 'No matching diagrams' : 'No diagrams yet'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery || activeTagIds.length > 0
                    ? 'Try adjusting your search or filters.'
                    : 'Create your first agent system diagram to get started.'}
                </p>
                {!searchQuery && activeTagIds.length === 0 && (
                  <Button onClick={handleCreateNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Diagram
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDiagrams.map((diagram: DiagramRecord) => (
                  <DiagramCard
                    key={diagram.id}
                    diagram={diagram}
                    tags={getTagsForDiagram(diagram.id)}
                    allTags={tags}
                    diagramTagIds={diagramTagMap[diagram.id] ?? []}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onTagsChange={() => fetchDiagrams()}
                    onFolderChange={() => fetchDiagrams()}
                    folders={useCatalogStore.getState().folders}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Tag Manager Dialog */}
      <TagManager open={showTagManager} onOpenChange={setShowTagManager} />
    </div>
  )
}
