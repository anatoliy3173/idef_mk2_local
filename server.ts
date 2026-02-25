import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './server/db.js'
import { initializeSchema } from './server/schema.js'
import { authMiddleware } from './server/auth.js'
import authRoutes from './server/routes/auth.js'
import diagramRoutes from './server/routes/diagrams.js'
import versionRoutes from './server/routes/versions.js'
import folderRoutes from './server/routes/folders.js'
import tagRoutes from './server/routes/tags.js'
import llmRoutes from './server/routes/llm.js'
import usageRoutes from './server/routes/usage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001

// Initialize database schema
initializeSchema(db)
console.log('[DB] Schema initialized')

const app = express()

// Body parsing
app.use(express.json({ limit: '5mb' }))

// ── Public routes (no auth required for register/login; /me has its own middleware) ──
app.use('/api/auth', authRoutes)

// ── Auth-protected routes ───────────────────────────────────────────────────
app.use('/api/diagrams', authMiddleware, diagramRoutes)
app.use('/api', authMiddleware, versionRoutes)
app.use('/api/folders', authMiddleware, folderRoutes)
app.use('/api/tags', authMiddleware, tagRoutes)
app.use('/api', authMiddleware, llmRoutes)
app.use('/api', authMiddleware, usageRoutes)

// ── Static files (built frontend) ──────────────────────────────────────────
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))

// SPA fallback: serve index.html for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`)
})
