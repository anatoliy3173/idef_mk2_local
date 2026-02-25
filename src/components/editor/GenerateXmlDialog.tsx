import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/uiStore'
import { useDiagramStore } from '@/stores/diagramStore'
import {
  generateXmlWithRetry,
  LlmError,
  estimateTokens,
  type UsageInfo,
} from '@/services/llmService'
import type { ValidationError, ValidationWarning } from '@/types/agentSystem'
import { fetchGlobalUsageStats, type GlobalUsageStats } from '@/services/usageService'
import { CREATE_NEW_PROMPT, getModifyPrompt } from '@/lib/promptTemplates'
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  Copy,
  Clock,
  BarChart3,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'

type GenerateMode = 'create' | 'modify'
type DialogState = 'input' | 'generating' | 'preview' | 'error'

export function GenerateXmlDialog() {
  const { setShowGenerateDialog, bumpUsageVersion } = useUIStore()
  const { xmlContent, setXmlContent, parseAndBuild } = useDiagramStore()

  const [mode, setMode] = useState<GenerateMode>('create')
  const [description, setDescription] = useState('')
  const [dialogState, setDialogState] = useState<DialogState>('input')
  const [generatedXml, setGeneratedXml] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [stats, setStats] = useState<GlobalUsageStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [previewErrors, setPreviewErrors] = useState<ValidationError[]>([])
  const [previewWarnings, setPreviewWarnings] = useState<ValidationWarning[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const [showValidationDetails, setShowValidationDetails] = useState(false)

  // Fetch usage stats on mount
  useEffect(() => {
    let mounted = true
    fetchGlobalUsageStats()
      .then((data: GlobalUsageStats) => {
        if (mounted) setStats(data)
      })
      .catch(() => {
        // Non-critical — UI just won't show stats
      })
      .finally(() => {
        if (mounted) setStatsLoading(false)
      })
    return () => { mounted = false }
  }, [])

  const hasExistingXml = xmlContent.trim().length > 0

  // Estimated tokens for the current input
  const estimatedPromptTokens =
    mode === 'create'
      ? estimateTokens(CREATE_NEW_PROMPT + description)
      : estimateTokens(getModifyPrompt(xmlContent) + description)

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return

    setDialogState('generating')
    setErrorMessage('')
    setErrorCode('')
    setPreviewErrors([])
    setPreviewWarnings([])
    setRetryCount(0)
    setShowValidationDetails(false)

    try {
      const result = await generateXmlWithRetry({
        description: description.trim(),
        mode,
        existingXml: mode === 'modify' ? xmlContent : undefined,
      })

      setGeneratedXml(result.xml)
      setUsage(result.usage)
      setPreviewErrors(result.validationErrors)
      setPreviewWarnings(result.validationWarnings)
      setRetryCount(result.retryCount)
      bumpUsageVersion()
      setDialogState('preview')
    } catch (err: unknown) {
      if (err instanceof LlmError) {
        setErrorMessage(err.message)
        setErrorCode(err.code)
        if (err.usage) {
          setUsage(err.usage)
        }
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred'
        )
        setErrorCode('GENERATION_FAILED')
      }
      setDialogState('error')
    }
  }, [description, mode, xmlContent, bumpUsageVersion])

  const handleAccept = useCallback(() => {
    setXmlContent(generatedXml)
    parseAndBuild()
    setShowGenerateDialog(false)
  }, [generatedXml, setXmlContent, parseAndBuild, setShowGenerateDialog])

  const handleDiscard = useCallback(() => {
    setGeneratedXml('')
    setDialogState('input')
  }, [])

  const handleRetry = useCallback(() => {
    setDialogState('input')
    setErrorMessage('')
    setErrorCode('')
  }, [])

  async function handleCopyPrompt() {
    const prompt =
      mode === 'create'
        ? CREATE_NEW_PROMPT.replace(
            '[PASTE YOUR DESCRIPTION HERE]',
            description.trim()
          )
        : getModifyPrompt(xmlContent).replace(
            '[DESCRIBE YOUR CHANGES HERE]',
            description.trim()
          )
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard denied
    }
  }

  function getResetTimeMessage(): string {
    if (errorCode === 'MONTHLY_LIMIT_EXCEEDED') {
      const now = new Date()
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return `Monthly limit resets on ${nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`
    }
    if (errorCode === 'DAILY_LIMIT_EXCEEDED') {
      return 'Daily limit resets at midnight Pacific Time.'
    }
    if (errorCode === 'RPM_LIMIT_EXCEEDED') {
      return 'Please wait a minute before trying again.'
    }
    return ''
  }

  function getUsageColor(used: number, limit: number): string {
    const pct = used / limit
    if (pct >= 0.8) return 'text-red-600'
    if (pct >= 0.5) return 'text-amber-600'
    return 'text-green-600'
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open: boolean) => !open && setShowGenerateDialog(false)}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#d97757]" />
            AI Generate XML
          </DialogTitle>
          <DialogDescription>
            Describe your agent system and let Gemini generate the XML for you.
          </DialogDescription>
        </DialogHeader>

        {/* Usage stats bar */}
        {(stats || usage) && (
          <div className="flex items-center gap-4 text-xs border rounded-md px-3 py-2 bg-muted/50">
            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {(() => {
              const u = usage ?? stats
              if (!u) return null
              const monthly = 'monthlyUsed' in u ? u : { monthlyUsed: u.monthly.used, monthlyLimit: u.monthly.limit, dailyUsed: u.daily.used, dailyLimit: u.daily.limit }
              return (
                <>
                  <span>
                    Monthly:{' '}
                    <span className={getUsageColor(monthly.monthlyUsed, monthly.monthlyLimit)}>
                      {monthly.monthlyUsed}/{monthly.monthlyLimit}
                    </span>
                  </span>
                  <span className="text-border">|</span>
                  <span>
                    Daily:{' '}
                    <span className={getUsageColor(monthly.dailyUsed, monthly.dailyLimit)}>
                      {monthly.dailyUsed}/{monthly.dailyLimit}
                    </span>
                  </span>
                </>
              )
            })()}
            {statsLoading && (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
          </div>
        )}

        {/* ── Input State ───────────────────────────────────────────────── */}
        {dialogState === 'input' && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <Tabs
              value={mode}
              onValueChange={(v: string) => setMode(v as GenerateMode)}
              className="flex-1 min-h-0 flex flex-col"
            >
              <TabsList className="w-full">
                <TabsTrigger value="create" className="flex-1">
                  Create New
                </TabsTrigger>
                <TabsTrigger
                  value="modify"
                  className="flex-1"
                  disabled={!hasExistingXml}
                >
                  Modify Current
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="flex-1 min-h-0">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Describe the agent system you want to create. Be specific
                    about agents, their purposes, and how they interact.
                  </p>
                  <textarea
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setDescription(e.target.value)
                    }
                    placeholder='e.g., "Create a customer support system for a telecom company with agents for billing inquiries, technical support, account management, and escalation..."'
                    className="w-full h-40 px-3 py-2 text-sm border rounded-md resize-none bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  />
                </div>
              </TabsContent>

              <TabsContent value="modify" className="flex-1 min-h-0">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Describe the changes you want to make to the current XML.
                    The existing XML will be included automatically.
                  </p>
                  <textarea
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setDescription(e.target.value)
                    }
                    placeholder='e.g., "Add a sentiment analysis agent that processes customer messages before routing..."'
                    className="w-full h-40 px-3 py-2 text-sm border rounded-md resize-none bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Est. ~{estimatedPromptTokens.toLocaleString()} tokens
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPrompt}
                  disabled={!description.trim()}
                  className="h-7 text-xs"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  {copied ? 'Copied!' : 'Copy prompt'}
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!description.trim()}
                  size="sm"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Generate
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Generating State ──────────────────────────────────────────── */}
        {dialogState === 'generating' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <Loader2 className="w-10 h-10 animate-spin text-[#d97757]" />
              <Sparkles className="w-4 h-4 text-[#d97757] absolute -top-1 -right-1" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Generating XML...</p>
              <p className="text-xs text-muted-foreground mt-1">
                This usually takes 10-30 seconds
              </p>
            </div>
          </div>
        )}

        {/* ── Preview State ─────────────────────────────────────────────── */}
        {dialogState === 'preview' && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* Validation status badge */}
            {previewErrors.length === 0 && previewWarnings.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium">
                  Valid XML generated{retryCount > 0 ? ` (fixed after ${retryCount} auto-retry)` : ''}
                </span>
              </div>
            )}
            {previewErrors.length === 0 && previewWarnings.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">
                  XML generated with {previewWarnings.length} warning{previewWarnings.length > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setShowValidationDetails((v: boolean) => !v)}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  {showValidationDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
            {previewErrors.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <XCircle className="w-4 h-4" />
                <span className="font-medium">
                  {previewErrors.length} validation error{previewErrors.length > 1 ? 's' : ''}
                  {retryCount > 0 ? ` (persisted after ${retryCount} auto-retry)` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setShowValidationDetails((v: boolean) => !v)}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  {showValidationDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {/* Collapsible validation details */}
            {showValidationDetails && (previewErrors.length > 0 || previewWarnings.length > 0) && (
              <div className="text-xs border rounded-md p-2 bg-muted/50 space-y-1 max-h-[120px] overflow-y-auto">
                {previewErrors.map((err: ValidationError, i: number) => (
                  <div key={`e-${i}`} className="flex items-start gap-1.5 text-red-600">
                    <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{err.line ? `Line ${err.line}: ` : ''}{err.message}</span>
                  </div>
                ))}
                {previewWarnings.map((warn: ValidationWarning, i: number) => (
                  <div key={`w-${i}`} className="flex items-start gap-1.5 text-amber-600">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{warn.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden rounded-md border">
              <pre className="h-full max-h-[350px] overflow-y-auto p-3 text-xs bg-muted font-mono whitespace-pre-wrap break-words">
                {generatedXml}
              </pre>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handleDiscard}>
                Discard
              </Button>
              <Button variant="outline" size="sm" onClick={handleGenerate}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Regenerate
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={previewErrors.length > 0}
                title={previewErrors.length > 0 ? 'Cannot accept XML with validation errors' : undefined}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Accept &amp; Load
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Error State ───────────────────────────────────────────────── */}
        {dialogState === 'error' && (
          <div className="flex-1 flex flex-col gap-4 py-4">
            <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-md">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-800">
                  {errorMessage}
                </p>
                {getResetTimeMessage() && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {getResetTimeMessage()}
                  </p>
                )}
              </div>
            </div>

            {/* Fallback suggestion */}
            <div className="p-3 border rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">
                You can still generate XML manually by copying the prompt and
                pasting it into ChatGPT, Claude, or another LLM:
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPrompt}
                disabled={!description.trim()}
                className="h-7 text-xs"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <Copy className="w-3.5 h-3.5 mr-1" />
                )}
                {copied ? 'Copied!' : 'Copy prompt to clipboard'}
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Try Again
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
