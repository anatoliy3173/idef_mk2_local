import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const MONTHLY_LIMIT = Number(process.env.MONTHLY_REQUEST_LIMIT) || 300
const DAILY_LIMIT = Number(process.env.DAILY_REQUEST_LIMIT) || 250

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let supabase: ReturnType<typeof getSupabase>
  try {
    supabase = getSupabase()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server configuration error'
    console.error('[usage-stats] Init error:', message)
    res.status(500).json({ error: message })
    return
  }

  // Auth
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.slice(7)
  const { data: userData, error: authError } = await supabase.auth.getUser(token)

  if (authError || !userData.user) {
    console.error('[usage-stats] Auth error:', authError?.message)
    res.status(401).json({ error: 'Invalid or expired auth token' })
    return
  }

  // Monthly count
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

  // Daily count (Pacific Time reset)
  const nowPT = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  )
  const dayStartPT = new Date(nowPT)
  dayStartPT.setHours(0, 0, 0, 0)
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

  // Per-user monthly count
  const { count: userMonthlyCount, error: userErr } = await supabase
    .from('llm_usage')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'success')
    .eq('user_id', userData.user.id)
    .gte('created_at', monthStart.toISOString())

  if (userErr) {
    console.error('[Usage] User count error:', userErr.message)
  }

  res.status(200).json({
    monthly: {
      used: monthlyCount ?? 0,
      limit: MONTHLY_LIMIT,
    },
    daily: {
      used: dailyCount ?? 0,
      limit: DAILY_LIMIT,
    },
    user: {
      monthlyUsed: userMonthlyCount ?? 0,
    },
  })
}
