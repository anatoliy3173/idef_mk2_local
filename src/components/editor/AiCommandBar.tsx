import { useState, useRef, useEffect, useCallback } from 'react'
import { useDiagramStore } from '@/stores/diagramStore'
import { useUIStore } from '@/stores/uiStore'
import { generateXmlWithRetry, LlmError } from '@/services/llmService'
import { Sparkles, Loader2, X, ArrowUp } from 'lucide-react'

// ── Layout keyword detection ──────────────────────────────────────────────────

/**
 * Returns the desired maxPerRow value if the command contains layout keywords,
 * or null if no layout intent is found.
 *
 *   0  = reset to auto
 *   1  = single column
 *   2  = 2 columns  (also "more vertical", "narrow", "tall", "portrait")
 *   3  = 3 columns
 */
function detectLayoutIntent(text: string): number | null {
  const t = text.toLowerCase()
  if (/\b(auto\s*layout|reset\s*layout|more\s+horizontal|less\s+vertical|wider)\b/.test(t)) return 0
  if (/\b(single\s*col|1\s*col|one\s*col|single\s*column|1\s*column|one\s*column)\b/.test(t)) return 1
  if (/\b(2\s*col|two\s*col|2\s*column|two\s*column)\b/.test(t)) return 2
  if (/\b(3\s*col|three\s*col|3\s*column|three\s*column)\b/.test(t)) return 3
  if (/\b(more\s+vertical|less\s+horizontal|narrow|tall|portrait|vertical\s*layout)\b/.test(t)) return 2
  return null
}

/** True when the command only describes a layout change (no agent/connection edits). */
const HAS_CONTENT_ACTION = /\b(add|remove|delete|rename|change|update|fix|create|insert|edit|replace|swap|move|modify|connect|disconnect)\b/i

export function AiCommandBar() {
  const { xmlContent, setXmlContent, parseAndBuild, setLayoutMaxPerRow } = useDiagramStore()
  const { bumpUsageVersion } = useUIStore()

  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Ctrl+K to focus the command bar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // Don't intercept when inside Monaco editor
        const active = document.activeElement
        const inMonaco = active?.closest('.monaco-editor')
        if (inMonaco) return

        e.preventDefault()
        setExpanded(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && expanded && !loading) {
        setExpanded(false)
        setCommand('')
        setError(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expanded, loading])

  const handleSubmit = useCallback(async () => {
    const trimmed = command.trim()
    if (!trimmed || loading) return

    const layoutValue = detectLayoutIntent(trimmed)
    const isPureLayout = layoutValue !== null && !HAS_CONTENT_ACTION.test(trimmed)

    // Apply layout preference immediately (no API call needed)
    if (layoutValue !== null) {
      setLayoutMaxPerRow(layoutValue)
    }

    if (isPureLayout || !xmlContent.trim()) {
      // Layout-only command — done
      setCommand('')
      setExpanded(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await generateXmlWithRetry({
        description: trimmed,
        mode: 'modify',
        existingXml: xmlContent,
      })

      setXmlContent(result.xml)
      await parseAndBuild()
      bumpUsageVersion()
      setCommand('')
      setExpanded(false)
    } catch (err: unknown) {
      const message = err instanceof LlmError
        ? err.message
        : (err instanceof Error ? err.message : 'Command failed')
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [command, xmlContent, loading, setXmlContent, parseAndBuild, bumpUsageVersion, setLayoutMaxPerRow])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setExpanded(false)
      setCommand('')
      setError(null)
    }
  }

  if (!expanded) {
    return (
      <div className="border-t bg-gradient-to-r from-[#d97757]/5 to-transparent">
        <button
          type="button"
          onClick={() => {
            setExpanded(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          disabled={!xmlContent.trim()}
          className="w-full px-3 py-2.5 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-[#d97757]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="w-5 h-5 rounded bg-[#d97757]/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#d97757]" />
          </div>
          <span className="font-medium">AI Command</span>
          <span className="text-xs text-muted-foreground/60 hidden sm:inline">Describe a change or layout adjustment</span>
          <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded border font-mono">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
          </kbd>
        </button>
      </div>
    )
  }

  return (
    <div className="border-t bg-gradient-to-r from-[#d97757]/5 to-transparent">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-5 h-5 rounded bg-[#d97757]/15 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-[#d97757]" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setCommand(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder='e.g., "add a billing agent", "make it more vertical", "2 columns", "rename agent-001"'
          disabled={loading}
          className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
          autoFocus
        />
        {loading ? (
          <div className="flex items-center gap-1.5 shrink-0 text-[#d97757]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-medium">Working...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!command.trim()}
              className="p-1 rounded-md bg-[#d97757] text-white hover:bg-[#c56847] disabled:opacity-30 disabled:bg-muted disabled:text-muted-foreground transition-colors"
              title="Send (Enter)"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false)
                setCommand('')
                setError(null)
              }}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="px-3 pb-2 text-xs text-red-500 truncate" title={error}>
          {error}
        </div>
      )}
    </div>
  )
}
