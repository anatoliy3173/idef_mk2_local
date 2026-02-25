import { supabase } from '@/services/supabaseClient'

// ── Types ────────────────────────────────────────────────────────────────────

export interface GlobalUsageStats {
  monthly: {
    used: number
    limit: number
  }
  daily: {
    used: number
    limit: number
  }
  user: {
    monthlyUsed: number
  }
}

// ── Fetch global usage stats (calls serverless function) ─────────────────────

export async function fetchGlobalUsageStats(): Promise<GlobalUsageStats> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr || !sessionData.session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch('/api/usage-stats', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Failed to fetch usage stats: ${response.status}`)
  }

  try {
    return JSON.parse(responseText) as GlobalUsageStats
  } catch {
    throw new Error(`Usage stats response is not valid JSON: ${responseText.substring(0, 100)}`)
  }
}
