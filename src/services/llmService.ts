import { supabase } from '@/services/supabaseClient'
import { parseXml } from '@/services/xmlService'
import { parseTeamXml } from '@/services/teamXmlParser'
import type { ValidationError, ValidationWarning } from '@/types/agentSystem'

// ── Types ────────────────────────────────────────────────────────────────────

export interface GenerateXmlParams {
  description: string
  mode: 'create' | 'modify'
  existingXml?: string
}

export interface UsageInfo {
  monthlyUsed: number
  monthlyLimit: number
  dailyUsed: number
  dailyLimit: number
}

export interface GenerateXmlResult {
  xml: string
  tokens: {
    prompt: number
    completion: number
    total: number
  }
  usage: UsageInfo
  warning?: string
}

export type LlmErrorCode =
  | 'MONTHLY_LIMIT_EXCEEDED'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'RPM_LIMIT_EXCEEDED'
  | 'TOKEN_LIMIT_EXCEEDED'
  | 'GOOGLE_QUOTA_EXCEEDED'
  | 'GENERATION_FAILED'
  | 'UNAUTHORIZED'
  | 'NETWORK_ERROR'

export class LlmError extends Error {
  code: LlmErrorCode
  usage?: UsageInfo

  constructor(message: string, code: LlmErrorCode, usage?: UsageInfo) {
    super(message)
    this.name = 'LlmError'
    this.code = code
    this.usage = usage
  }
}

// ── Token estimation (client-side, for UI feedback) ──────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ── API caller ───────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    throw new LlmError('Not authenticated', 'UNAUTHORIZED')
  }
  return data.session.access_token
}

export async function generateXml(
  params: GenerateXmlParams
): Promise<GenerateXmlResult> {
  const token = await getAuthToken()

  let response: Response
  try {
    response = await fetch('/api/generate-xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        description: params.description,
        mode: params.mode,
        existingXml: params.existingXml,
      }),
    })
  } catch {
    throw new LlmError(
      'Network error. Please check your connection.',
      'NETWORK_ERROR'
    )
  }

  const responseText = await response.text()

  let data: Record<string, unknown>
  try {
    data = JSON.parse(responseText) as Record<string, unknown>
  } catch {
    throw new LlmError(
      'Server returned an invalid response. The API may be unavailable.',
      'GENERATION_FAILED'
    )
  }

  if (!response.ok) {
    const code = (data.code as LlmErrorCode | undefined) ?? 'GENERATION_FAILED'
    const message = (data.error as string | undefined) ?? 'Generation failed'
    const usage = data.usage as UsageInfo | undefined
    throw new LlmError(message, code, usage)
  }

  return {
    xml: data.xml as string,
    tokens: data.tokens as GenerateXmlResult['tokens'],
    usage: data.usage as UsageInfo,
    warning: data.warning as string | undefined,
  }
}

// ── Generate with validation + auto-retry feedback loop ─────────────────────

export interface GenerateXmlWithRetryResult extends GenerateXmlResult {
  validationErrors: ValidationError[]
  validationWarnings: ValidationWarning[]
  retryCount: number
}

const MAX_VALIDATION_RETRIES = 3

export async function generateXmlWithRetry(
  params: GenerateXmlParams
): Promise<GenerateXmlWithRetryResult> {
  let result = await generateXml(params)
  let retryCount = 0

  // ── New <team> format ────────────────────────────────────────────────────
  // Detect by presence of <team in the output (not by format arg) so we handle
  // cases where the server correctly generated team XML but it has minor errors.
  if (result.xml.includes('<team')) {
    let teamParsed = parseTeamXml(result.xml)

    if (teamParsed.data !== null) {
      // Successfully parsed on first try
      return { ...result, validationErrors: [], validationWarnings: [], retryCount }
    }

    // Parse failed — retry with the specific error message
    while (teamParsed.data === null && retryCount < MAX_VALIDATION_RETRIES) {
      retryCount++
      const errMsg = teamParsed.error ?? 'Invalid <team> XML structure'

      try {
        const retryResult = await generateXml({
          description:
            `Fix this XML error and output the complete corrected XML:\n${errMsg}\n\n` +
            `Original request:\n${params.description}`,
          mode: 'create',
        })

        const retryParsed = parseTeamXml(retryResult.xml)

        if (retryParsed.data !== null) {
          return { ...retryResult, validationErrors: [], validationWarnings: [], retryCount }
        }

        // Accept the new result if it at least improved (shorter error / has <team>)
        if (retryResult.xml.includes('<team')) {
          result = retryResult
          teamParsed = retryParsed
        }
      } catch {
        break
      }
    }

    // Still failed after retries — surface the error
    const ve: ValidationError = {
      type: 'error',
      message: teamParsed.error ?? 'Generated XML could not be parsed as a valid team diagram',
    }
    return { ...result, validationErrors: [ve], validationWarnings: [], retryCount }
  }

  // ── Legacy <agentSystem> format — existing validation + retry loop ────────
  let parsed = parseXml(result.xml)

  while (parsed.errors.length > 0 && retryCount < MAX_VALIDATION_RETRIES) {
    retryCount++

    const errorList = parsed.errors
      .map((e: ValidationError, i: number) => `${i + 1}. ${e.line ? `Line ${e.line}: ` : ''}${e.message}`)
      .join('\n')

    const fixPrompt = `The XML you generated has ${parsed.errors.length} validation error(s):\n${errorList}\n\nFix these errors and output the corrected complete XML. Do not change anything else.`

    try {
      const retryResult = await generateXml({
        description: fixPrompt,
        mode: 'modify',
        existingXml: result.xml,
      })

      const retryParsed = parseXml(retryResult.xml)

      if (retryParsed.errors.length <= parsed.errors.length) {
        result = retryResult
        parsed = retryParsed
      }

      if (retryParsed.errors.length === 0) break
    } catch {
      break
    }
  }

  return {
    ...result,
    validationErrors: parsed.errors,
    validationWarnings: parsed.warnings,
    retryCount,
  }
}
