import { useState, useRef, useCallback, useEffect } from 'react'
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useDiagramStore } from '@/stores/diagramStore'
import { useUIStore } from '@/stores/uiStore'
import { setValidationMarkers } from '@/services/monacoMarkerService'
import { registerXmlCompletionProvider } from '@/services/xmlCompletionProvider'
import { generateXml, LlmError } from '@/services/llmService'
import { ValidationStatus } from './ValidationStatus'
import { AiCommandBar } from './AiCommandBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Clipboard, Code, Copy, Loader2 } from 'lucide-react'

export function XmlEditorPane() {
  const {
    xmlContent,
    setXmlContent,
    parseAndBuild,
    currentTitle,
    setCurrentTitle,
  } = useDiagramStore()

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const [contextFixing, setContextFixing] = useState(false)

  // Push validation markers into Monaco after parse
  const updateMarkers = useCallback(() => {
    if (!monacoRef.current || !editorRef.current) return
    const model = editorRef.current.getModel()
    const { errors, warnings } = useDiagramStore.getState()
    setValidationMarkers(monacoRef.current, model, errors, warnings)
  }, [])

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const xml = value ?? ''
      setXmlContent(xml)

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      debounceTimer.current = setTimeout(() => {
        parseAndBuild().then(() => updateMarkers())
      }, 300)
    },
    [setXmlContent, parseAndBuild, updateMarkers]
  )

  // Parse on mount if there's content
  useEffect(() => {
    if (xmlContent.trim()) {
      parseAndBuild().then(() => updateMarkers())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 12,
      wordWrap: 'on',
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      acceptSuggestionOnCommitCharacter: false,
    })

    // Register XML autocomplete provider (idempotent)
    registerXmlCompletionProvider(monaco)

    // Set initial markers if there's content
    const { errors, warnings, xmlContent: currentXml } = useDiagramStore.getState()
    if (currentXml.trim()) {
      setValidationMarkers(monaco, editor.getModel(), errors, warnings)
    }

    // Register "Fix with AI" context menu action
    editor.addAction({
      id: 'ai-fix-context',
      label: 'Fix with AI',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 99,
      precondition: undefined,
      keybindings: [],
      run: async (ed: MonacoEditor.ICodeEditor) => {
        const model = ed.getModel()
        const position = ed.getPosition()
        if (!model || !position) return

        // Find markers (errors) at the current cursor line
        const markers = monaco.editor.getModelMarkers({ resource: model.uri })
        const lineMarkers = markers.filter(
          (m: MonacoEditor.IMarkerData) =>
            m.startLineNumber <= position.lineNumber &&
            m.endLineNumber >= position.lineNumber &&
            m.severity === monaco.MarkerSeverity.Error
        )

        if (lineMarkers.length === 0) return

        // Extract surrounding context (10 lines around cursor)
        const startLine = Math.max(1, position.lineNumber - 5)
        const endLine = Math.min(model.getLineCount(), position.lineNumber + 5)
        const contextLines = model.getLinesContent().slice(startLine - 1, endLine)
        const context = contextLines.join('\n')

        const errorMessages = lineMarkers
          .map((m: MonacoEditor.IMarkerData) => m.message)
          .join('; ')

        const fixPrompt = `Fix this specific error near line ${position.lineNumber}: "${errorMessages}"\n\nContext (lines ${startLine}-${endLine}):\n\`\`\`xml\n${context}\n\`\`\`\n\nDo not change anything outside this area unless necessary to resolve the error.`

        const store = useDiagramStore.getState()
        if (!store.xmlContent.trim()) return

        setContextFixing(true)
        try {
          const result = await generateXml({
            description: fixPrompt,
            mode: 'modify',
            existingXml: store.xmlContent,
          })
          store.setXmlContent(result.xml)
          await store.parseAndBuild()
          useUIStore.getState().bumpUsageVersion()
        } catch (err: unknown) {
          const message = err instanceof LlmError ? err.message : (err instanceof Error ? err.message : 'Fix failed')
          console.error('[AI Fix Context]', message)
        } finally {
          setContextFixing(false)
        }
      },
    })
  }

  async function handleImportFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,.txt'
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return
      const text = await file.text()
      setXmlContent(text)
      parseAndBuild()
    }
    input.click()
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      setXmlContent(text)
      parseAndBuild()
    } catch {
      // clipboard access denied
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(xmlContent)
    } catch {
      // clipboard access denied
    }
  }

  function handleFormat() {
    // Simple XML formatting
    try {
      const formatted = formatXml(xmlContent)
      setXmlContent(formatted)
    } catch {
      // formatting failed, keep as-is
    }
  }

  return (
    <div className="h-full flex flex-col bg-white border-r">
      {/* Title */}
      <div className="px-3 py-2 border-b">
        <Input
          value={currentTitle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentTitle(e.target.value)}
          className="text-sm font-medium border-none shadow-none p-0 h-auto focus-visible:ring-0"
          placeholder="Diagram title..."
        />
      </div>

      {/* Toolbar */}
      <div className="px-2 py-1.5 border-b flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={handleImportFile} className="h-7 text-xs">
          <Upload className="w-3.5 h-3.5 mr-1" />
          Import
        </Button>
        <Button variant="ghost" size="sm" onClick={handlePaste} className="h-7 text-xs">
          <Clipboard className="w-3.5 h-3.5 mr-1" />
          Paste
        </Button>
        <Button variant="ghost" size="sm" onClick={handleFormat} className="h-7 text-xs">
          <Code className="w-3.5 h-3.5 mr-1" />
          Format
        </Button>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs">
          <Copy className="w-3.5 h-3.5 mr-1" />
          Copy
        </Button>
        {contextFixing && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-[#d97757]">
            <Loader2 className="w-3 h-3 animate-spin" />
            AI fixing...
          </span>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="xml"
          value={xmlContent}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: 'on',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            acceptSuggestionOnCommitCharacter: false,
          }}
        />
      </div>

      {/* AI Command Bar */}
      <AiCommandBar />

      {/* Validation Status */}
      <ValidationStatus />
    </div>
  )
}

function formatXml(xml: string): string {
  let formatted = ''
  let indent = ''
  const tab = '  '

  xml.split(/>\s*</).forEach((node: string) => {
    if (node.match(/^\/\w/)) {
      indent = indent.substring(tab.length)
    }
    formatted += indent + '<' + node + '>\r\n'
    if (node.match(/^<?\w[^>]*[^/]$/) && !node.startsWith('?')) {
      indent += tab
    }
  })

  return formatted.substring(1, formatted.length - 3)
}
