import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { hashPassword, verifyPassword, createToken, authMiddleware } from '../auth.js'

const router = Router()

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string }

    // Validate
    if (!username || typeof username !== 'string' || username.length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 characters' })
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' })
      return
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }

    // Check uniqueness
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) {
      res.status(409).json({ error: 'Username already taken' })
      return
    }

    const id = crypto.randomUUID()
    const passwordHash = await hashPassword(password)

    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, passwordHash)

    const user = { id, username }
    const token = createToken(user)

    res.status(201).json({ user, token })
  } catch (err) {
    console.error('[Auth] Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string }

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' })
      return
    }

    const row = db
      .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
      .get(username) as { id: string; username: string; password_hash: string } | undefined

    if (!row) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    const valid = await verifyPassword(password, row.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    const user = { id: row.id, username: row.username }
    const token = createToken(user)

    res.json({ user, token })
  } catch (err) {
    console.error('[Auth] Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const row = db
    .prepare('SELECT id, username, created_at FROM users WHERE id = ?')
    .get(req.userId) as { id: string; username: string; created_at: string } | undefined

  if (!row) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({ user: { id: row.id, username: row.username, created_at: row.created_at } })
})

export default router
