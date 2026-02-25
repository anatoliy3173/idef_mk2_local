import { useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Sparkles, Loader2 } from 'lucide-react'
import { useDiagramStore } from '@/stores/diagramStore'
import { useUIStore } from '@/stores/uiStore'
import { generateXml, LlmError } from '@/services/llmService'
import type { ValidationError } from '@/types/agentSystem'

export function ValidationStatus() {
  const { errors, warnings, xmlContent, setXmlContent, parseAndBuild } = useDiagramStore()
  const { bumpUsageVersion } = useUIStore()
  const [fixing, setFixing] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)

  async function handleFixWithAi() {
    if (errors.length === 0 || !xmlContent.trim()) return
    setFixing(true)
    setFixError(null)

    const errorList = errors
      .map((e: ValidationError, i: number) => `${i + 1}. ${e.line ? `Line ${e.line}: ` : ''}${e.message}`)
      .join('\n')

    const fixPrompt = `Fix the following XML validation errors. Do not change anything else:\n${errorList}`

    try {
      const result = await generateXml({
        description: fixPrompt,
        mode: 'modify',
        existingXml: xmlContent,
      })

      setXmlContent(result.xml)
      await parseAndBuild()
      bumpUsageVersion()
    } catch (err: unknown) {
      const message = err instanceof LlmError ? err.message : (err instanceof Error ? err.message : 'Fix failed')
      setFixError(message)
      setTimeout(() => setFixError(null), 5000)
    } finally {
      setFixing(false)
    }
  }

  if (!xmlContent.trim()) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5 border-t">
        <span className="text-stone-400">Paste or import XML to begin</span>
      </div>
    )
  }

  const hasErrors = errors.length > 0
  const hasWarnings = warnings.length > 0

  return (
    <div className="px-3 py-2 text-xs border-t space-y-1 max-h-[200px] overflow-y-auto">
      {!hasErrors && !hasWarnings && (
        <div className="flex items-center gap-1.5 text-green-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Valid XML - {errors.length} errors, {warnings.length} warnings</span>
        </div>
      )}
      {hasErrors && (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-600 font-medium">{errors.length} error{errors.length > 1 ? 's' : ''}</span>
            <button
              type="button"
              onClick={handleFixWithAi}
              disabled={fixing}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#d97757]/10 text-[#d97757] hover:bg-[#d97757]/20 disabled:opacity-50 transition-colors"
            >
              {fixing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {fixing ? 'Fixing...' : 'Fix with AI'}
            </button>
            {fixError && (
              <span className="text-red-500 truncate max-w-[180px]" title={fixError}>
                {fixError}
              </span>
            )}
          </div>
          {errors.map((err: ValidationError, i: number) => (
            <div key={i} className="flex items-start gap-1.5 text-red-600">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {err.line ? `Line ${err.line}: ` : ''}
                {err.message}
              </span>
            </div>
          ))}
        </div>
      )}
      {hasWarnings && (
        <div className="space-y-0.5">
          {warnings.map((warn, i: number) => (
            <div key={i} className="flex items-start gap-1.5 text-yellow-600">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{warn.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
