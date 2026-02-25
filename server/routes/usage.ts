import { Router } from 'express'
import db from '../db.js'

const router = Router()

const MONTHLY_LIMIT = Number(process.env.MONTHLY_REQUEST_LIMIT) || 300
const DAILY_LIMIT = Number(process.env.DAILY_REQUEST_LIMIT) || 250

// GET /api/usage-stats
router.get('/usage-stats', (req, res) => {
  const userId = req.userId!

  // Monthly count (UTC calendar month)
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const monthlyRow = db.prepare(
    "SELECT COUNT(*) as cnt FROM llm_usage WHERE status = 'success' AND created_at >= ?"
  ).get(monthStart.toISOString()) as { cnt: number }

  // Daily count (Pacific Time reset)
  const nowPT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const dayStartPT = new Date(nowPT)
  dayStartPT.setHours(0, 0, 0, 0)
  const ptOffset = nowPT.getTime() - new Date().getTime()
  const dayStartUTC = new Date(dayStartPT.getTime() - ptOffset)

  const dailyRow = db.prepare(
    "SELECT COUNT(*) as cnt FROM llm_usage WHERE status = 'success' AND created_at >= ?"
  ).get(dayStartUTC.toISOString()) as { cnt: number }

  // Per-user monthly count
  const userRow = db.prepare(
    "SELECT COUNT(*) as cnt FROM llm_usage WHERE status = 'success' AND user_id = ? AND created_at >= ?"
  ).get(userId, monthStart.toISOString()) as { cnt: number }

  res.json({
    monthly: { used: monthlyRow.cnt, limit: MONTHLY_LIMIT },
    daily: { used: dailyRow.cnt, limit: DAILY_LIMIT },
    user: { monthlyUsed: userRow.cnt },
  })
})

export default router
