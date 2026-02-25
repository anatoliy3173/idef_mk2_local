import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ── Environment ──────────────────────────────────────────────────────────────

const PROXY_API_KEY = process.env.PROXY_API_KEY ?? ''
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const MONTHLY_LIMIT = Number(process.env.MONTHLY_REQUEST_LIMIT) || 300
const DAILY_LIMIT = Number(process.env.DAILY_REQUEST_LIMIT) || 250
const RPM_LIMIT = 12 // safety margin
const MAX_TOKEN_ESTIMATE = 100_000
const MODEL_NAME = 'gpt-4.1-mini'

// ── Supabase service-role client (bypasses RLS) ──────────────────────────────

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You generate XML describing a team of AI agents. Output ONLY raw XML — no markdown fences, no explanations, no text before or after the XML.

SCHEMA:
<?xml version="1.0" encoding="UTF-8"?>
<team name="Team Name" description="One sentence description">
  <agents>
    <agent id="snake_case_id" name="Display Name" model="GPT-4"
           type="orchestrator" role="Up to 10 words describing the agent">
      <tool>Tool Name</tool>
      <o>camelCaseOutputField</o>
      <stO>camelCaseStructuredField</stO>
    </agent>
  </agents>
  <connections>
    <connection from="source_id" to="target_id" label="verb" />
  </connections>
</team>

MINIMAL WORKING EXAMPLE:
<team name="Support Bot" description="Handles customer support requests">
  <agents>
    <agent id="router" name="Router" model="GPT-4" type="orchestrator" role="Route user requests to the right specialist">
      <tool>Intent Classification</tool>
      <o>targetAgent</o>
    </agent>
    <agent id="billing" name="Billing Agent" model="GPT-4" type="executor" role="Handle all billing and payment questions">
      <tool>Billing API</tool>
      <o>billingResponse</o>
    </agent>
  </agents>
  <connections>
    <connection from="router" to="billing" label="route" />
  </connections>
</team>

STRICT RULES — every rule must be satisfied or the output is invalid:
1. Every id value in <connection from="..." to="..."> MUST exactly match the id of an existing <agent>. No dangling references.
2. Agent id: lowercase letters, digits, and underscores only. No spaces, hyphens, or special characters. Must be unique.
3. type must be exactly one of: orchestrator, classifier, analyzer, advisor, executor, fallback, infra
4. role: plain English, maximum 10 words
5. model: short name such as GPT-4, GPT-4o, Claude-3.5, Gemini-1.5, BERT, None
6. Each agent must have 1–4 <tool> child elements with plain text names
7. Each agent may have 0–3 <o> elements (camelCase output field names)
8. Each agent may have 0–3 <stO> elements (camelCase structured output field names)
9. <connection label> must be a single verb: route, delegate, classify, escalate, monitor, validate, fetch, notify, etc.
10. At most ONE agent may have type="orchestrator". That agent must have zero incoming connections.
11. Agents with no connections (monitoring, logging, feedback) are allowed — they appear as standalone in the diagram.
12. Do NOT include coordinates, colors, positions, or layout hints.
13. Output starts with <?xml or <team and ends with </team>. Absolutely nothing before or after.`

// ── Helpers ──────────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractXml(text: string): string {
  let cleaned = text.trim()

  // Remove ```xml ... ``` wrapper if present
  const fenceMatch = cleaned.match(/```(?:xml)?\s*\n?([\s\S]*?)```/)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  // Ensure it starts with <?xml or <team
  if (!cleaned.startsWith('<?xml') && !cleaned.startsWith('<team')) {
    const xmlStart = cleaned.indexOf('<?xml')
    const teamStart = cleaned.indexOf('<team')
    const start = xmlStart >= 0 ? xmlStart : teamStart
    if (start >= 0) {
      cleaned = cleaned.substring(start)
    }
  }

  // Ensure it ends with </team>
  const endTag = '</team>'
  const endIdx = cleaned.lastIndexOf(endTag)
  if (endIdx >= 0) {
    cleaned = cleaned.substring(0, endIdx + endTag.length)
  }

  return cleaned
}

// ── Safety layer queries ─────────────────────────────────────────────────────

interface UsageCounts {
  monthly: number
  daily: number
  rpm: number
}

async function getUsageCounts(
  supabase: ReturnType<typeof createClient>
): Promise<UsageCounts> {
  // Monthly count: success requests this calendar month (UTC)
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const { count: monthlyCount, error: monthlyErr } = await supabase
    .from('llm_usage')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'success')
    .gte('created_at', monthStart.toISOString())

  if (monthlyErr) {
    console.error('[Usage] Monthly count error:', monthlyErr.message)
  }

  // Daily count: success requests today in Pacific Time
  // Reset at midnight PT
  const nowPT = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  )
  const dayStartPT = new Date(nowPT)
  dayStartPT.setHours(0, 0, 0, 0)
  // Convert back to UTC for the query
  const ptOffset = nowPT.getTime() - new Date().getTime()
  const dayStartUTC = new Date(dayStartPT.getTime() - ptOffset)

  const { count: dailyCount, error: dailyErr } = await supabase
    .from('llm_usage')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'success')
    .gte('created_at', dayStartUTC.toISOString())

  if (dailyErr) {
    console.error('[Usage] Daily count error:', dailyErr.message)
  }

  // RPM count: requests in the last 60 seconds
  const oneMinuteAgo = new Date(Date.now() - 60_000)

  const { count: rpmCount, error: rpmErr } = await supabase
    .from('llm_usage')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneMinuteAgo.toISOString())

  if (rpmErr) {
    console.error('[Usage] RPM count error:', rpmErr.message)
  }

  return {
    monthly: monthlyCount ?? 0,
    daily: dailyCount ?? 0,
    rpm: rpmCount ?? 0,
  }
}

// ── Record usage ─────────────────────────────────────────────────────────────

interface UsageRecord {
  user_id: string
  tokens_prompt: number
  tokens_completion: number
  tokens_total: number
  model: string
  status: string
  error_message?: string
}

async function recordUsage(
  supabase: ReturnType<typeof createClient>,
  record: UsageRecord
): Promise<void> {
  const { error } = await supabase.from('llm_usage').insert(record)
  if (error) {
    console.error('[Usage] Failed to record usage:', error.message)
  }
}

// ── ProxyAPI call with retry ─────────────────────────────────────────────────

interface ApiResult {
  xml: string
  tokensPrompt: number
  tokensCompletion: number
  tokensTotal: number
}

async function callProxyApi(prompt: string): Promise<ApiResult> {
  if (!PROXY_API_KEY) {
    throw new Error('Missing PROXY_API_KEY')
  }

  // Up to 4 total attempts: network retries + content-validation retries share the budget.
  const TOTAL_ATTEMPTS = 4
  const BACKOFF_MS = [1500, 3000, 6000]

  type Message = { role: string; content: string }
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]

  let lastError: Error | null = null
  let lastResult: ApiResult | null = null

  for (let attempt = 0; attempt < TOTAL_ATTEMPTS; attempt++) {
    try {
      const response = await fetch('https://api.proxyapi.ru/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PROXY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages,
          temperature: 0.2,
          max_tokens: 4000,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        const err = new Error(`API error ${response.status}: ${errorText.slice(0, 200)}`)
        const isRetryable = response.status === 429 || response.status >= 500
        if (isRetryable && attempt < TOTAL_ATTEMPTS - 1) {
          lastError = err
          const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]
          console.warn(`[ProxyAPI] HTTP ${response.status} on attempt ${attempt + 1}. Retrying in ${delay}ms…`)
          await sleep(delay)
          continue
        }
        throw err
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      }

      const text = data.choices[0]?.message?.content ?? ''
      const xml = extractXml(text)

      const tokensPrompt = data.usage?.prompt_tokens ?? estimateTokens(SYSTEM_PROMPT + prompt)
      const tokensCompletion = data.usage?.completion_tokens ?? estimateTokens(text)
      const tokensTotal = data.usage?.total_tokens ?? (tokensPrompt + tokensCompletion)

      lastResult = { xml, tokensPrompt, tokensCompletion, tokensTotal }

      // ── Content validation ──────────────────────────────────────────────
      // The XML must have a <team> root element and </team> closing tag.
      const xmlValid = xml.includes('<team') && xml.includes('</team>')
      if (!xmlValid && attempt < TOTAL_ATTEMPTS - 1) {
        console.warn(`[ProxyAPI] Response missing <team> structure on attempt ${attempt + 1}. Correcting…`)
        // Add the bad response and a correction request to the conversation
        messages.push({ role: 'assistant', content: text })
        messages.push({
          role: 'user',
          content:
            'Your response was not valid XML. It must start with <team (or <?xml…?> then <team) ' +
            'and end with </team>. Output ONLY the complete, corrected XML — no text before or after.',
        })
        lastError = new Error('Response missing <team>…</team> structure')
        continue
      }

      return lastResult
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message.toLowerCase()
      const isRetryable = msg.includes('429') || msg.includes('500') || msg.includes('503')
      if (isRetryable && attempt < TOTAL_ATTEMPTS - 1) {
        await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)])
        continue
      }
      break
    }
  }

  // Return whatever we got last (even if structure was imperfect) so the client
  // retry loop in llmService can still attempt its own fix pass.
  if (lastResult) return lastResult
  throw lastError ?? new Error('ProxyAPI call failed after retries')
}

// ── Request body validation ──────────────────────────────────────────────────

interface RequestBody {
  description: string
  mode: 'create' | 'modify'
  existingXml?: string
}

function validateBody(body: unknown): RequestBody {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object')
  }

  const obj = body as Record<string, unknown>

  if (typeof obj.description !== 'string' || obj.description.trim().length === 0) {
    throw new Error('description is required and must be a non-empty string')
  }

  if (obj.mode !== 'create' && obj.mode !== 'modify') {
    throw new Error('mode must be "create" or "modify"')
  }

  if (obj.mode === 'modify' && typeof obj.existingXml !== 'string') {
    throw new Error('existingXml is required when mode is "modify"')
  }

  return {
    description: obj.description as string,
    mode: obj.mode as 'create' | 'modify',
    existingXml: typeof obj.existingXml === 'string' ? obj.existingXml : undefined,
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let supabase: ReturnType<typeof getSupabase>
  try {
    supabase = getSupabase()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server configuration error'
    console.error('[generate-xml] Init error:', message)
    res.status(500).json({ error: message, code: 'GENERATION_FAILED' })
    return
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.slice(7)
  const { data: userData, error: authError } = await supabase.auth.getUser(token)

  if (authError || !userData.user) {
    console.error('[generate-xml] Auth error:', authError?.message)
    res.status(401).json({ error: 'Invalid or expired auth token' })
    return
  }

  const userId = userData.user.id

  // ── Validate body ────────────────────────────────────────────────────────

  let body: RequestBody
  try {
    body = validateBody(req.body)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid request body'
    res.status(400).json({ error: message })
    return
  }

  // ── Layer 1 & 2 & 3: Usage checks ───────────────────────────────────────

  let counts: UsageCounts
  try {
    counts = await getUsageCounts(supabase)
  } catch (err: unknown) {
    console.error('[Usage] Failed to fetch counts:', err)
    res.status(500).json({ error: 'Failed to check usage limits' })
    return
  }

  // Layer 1: Monthly cap
  if (counts.monthly >= MONTHLY_LIMIT) {
    res.status(429).json({
      error: 'Monthly request limit reached',
      code: 'MONTHLY_LIMIT_EXCEEDED',
      usage: {
        monthlyUsed: counts.monthly,
        monthlyLimit: MONTHLY_LIMIT,
        dailyUsed: counts.daily,
        dailyLimit: DAILY_LIMIT,
      },
    })
    return
  }

  // Layer 2: Daily cap
  if (counts.daily >= DAILY_LIMIT) {
    res.status(429).json({
      error: 'Daily request limit reached. Resets at midnight Pacific Time.',
      code: 'DAILY_LIMIT_EXCEEDED',
      usage: {
        monthlyUsed: counts.monthly,
        monthlyLimit: MONTHLY_LIMIT,
        dailyUsed: counts.daily,
        dailyLimit: DAILY_LIMIT,
      },
    })
    return
  }

  // Layer 3: RPM
  if (counts.rpm >= RPM_LIMIT) {
    res.status(429).json({
      error: 'Too many requests per minute. Please wait a moment.',
      code: 'RPM_LIMIT_EXCEEDED',
      usage: {
        monthlyUsed: counts.monthly,
        monthlyLimit: MONTHLY_LIMIT,
        dailyUsed: counts.daily,
        dailyLimit: DAILY_LIMIT,
      },
    })
    return
  }

  // ── Layer 4: Token estimation ────────────────────────────────────────────

  const userPrompt =
    body.mode === 'create'
      ? `Create a new team XML based on the following user requirements. Follow every rule from your instructions. Generate the complete, valid XML.\n\nUser requirements:\n${body.description}`
      : `You will receive an existing team XML description and a modification request. Update the XML while preserving its structure and all existing agents that are not mentioned in the request.\n\nModification request:\n${body.description}\n\nCurrent XML:\n\`\`\`xml\n${body.existingXml}\n\`\`\`\n\nOutput the COMPLETE modified XML from <?xml (or <team) to </team>, not just the changed parts. Preserve all unmodified agents and connections exactly as they are.`

  const estimatedTokens = estimateTokens(SYSTEM_PROMPT + userPrompt)

  if (estimatedTokens > MAX_TOKEN_ESTIMATE) {
    res.status(400).json({
      error: `Request too large (estimated ${estimatedTokens.toLocaleString()} tokens). Please shorten your description.`,
      code: 'TOKEN_LIMIT_EXCEEDED',
    })
    return
  }

  // ── Call ProxyAPI ────────────────────────────────────────────────────────

  try {
    const result = await callProxyApi(userPrompt)

    // Record successful usage
    await recordUsage(supabase, {
      user_id: userId,
      tokens_prompt: result.tokensPrompt,
      tokens_completion: result.tokensCompletion,
      tokens_total: result.tokensTotal,
      model: MODEL_NAME,
      status: 'success',
    })

    // Daily warning at 80%
    const dailyWarning =
      counts.daily + 1 >= Math.floor(DAILY_LIMIT * 0.8)
        ? `Approaching daily limit: ${counts.daily + 1}/${DAILY_LIMIT} used today.`
        : undefined

    res.status(200).json({
      xml: result.xml,
      tokens: {
        prompt: result.tokensPrompt,
        completion: result.tokensCompletion,
        total: result.tokensTotal,
      },
      usage: {
        monthlyUsed: counts.monthly + 1,
        monthlyLimit: MONTHLY_LIMIT,
        dailyUsed: counts.daily + 1,
        dailyLimit: DAILY_LIMIT,
      },
      warning: dailyWarning,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ProxyAPI] Generation failed:', message)

    // Record failed usage
    await recordUsage(supabase, {
      user_id: userId,
      tokens_prompt: estimatedTokens,
      tokens_completion: 0,
      tokens_total: estimatedTokens,
      model: MODEL_NAME,
      status: 'error',
      error_message: message.substring(0, 500),
    })

    const isQuotaError =
      message.toLowerCase().includes('429') ||
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('resource exhausted')

    res.status(isQuotaError ? 429 : 500).json({
      error: isQuotaError
        ? 'API quota exceeded. Please try again later.'
        : 'XML generation failed. Please try again or use the manual prompt workflow.',
      code: isQuotaError ? 'QUOTA_EXCEEDED' : 'GENERATION_FAILED',
      usage: {
        monthlyUsed: counts.monthly,
        monthlyLimit: MONTHLY_LIMIT,
        dailyUsed: counts.daily,
        dailyLimit: DAILY_LIMIT,
      },
    })
  }
}
