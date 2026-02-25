import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'

const router = Router()

// GET /api/diagrams — list user's diagrams
router.get('/', (req, res) => {
  const { folder_id } = req.query
  let rows
  if (folder_id) {
    rows = db.prepare(
      'SELECT * FROM diagrams WHERE user_id = ? AND folder_id = ? ORDER BY updated_at DESC'
    ).all(req.userId, folder_id)
  } else {
    rows = db.prepare(
      'SELECT * FROM diagrams WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(req.userId)
  }
  // Parse node_positions from JSON string
  const diagrams = (rows as Record<string, unknown>[]).map(r => ({
    ...r,
    node_positions: JSON.parse((r.node_positions as string) || '{}'),
  }))
  res.json(diagrams)
})

// POST /api/diagrams — create
router.post('/', (req, res) => {
  const { title, xml_content, node_positions, folder_id } = req.body as {
    title?: string; xml_content?: string; node_positions?: Record<string, unknown>; folder_id?: string | null
  }
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO diagrams (id, user_id, title, xml_content, node_positions, folder_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.userId,
    title || 'Untitled Diagram',
    xml_content || '',
    JSON.stringify(node_positions || {}),
    folder_id || null,
    now, now
  )

  const row = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ ...row, node_positions: JSON.parse((row.node_positions as string) || '{}') })
})

// GET /api/diagrams/:id — get one
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM diagrams WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ error: 'Diagram not found' })
    return
  }
  res.json({ ...row, node_positions: JSON.parse((row.node_positions as string) || '{}') })
})

// PATCH /api/diagrams/:id — update
router.patch('/:id', (req, res) => {
  const { title, xml_content, node_positions, thumbnail, folder_id } = req.body as {
    title?: string; xml_content?: string; node_positions?: Record<string, unknown>; thumbnail?: string; folder_id?: string | null
  }

  // Verify ownership
  const existing = db.prepare('SELECT id FROM diagrams WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!existing) {
    res.status(404).json({ error: 'Diagram not found' })
    return
  }

  const updates: string[] = []
  const values: unknown[] = []

  if (title !== undefined) { updates.push('title = ?'); values.push(title) }
  if (xml_content !== undefined) { updates.push('xml_content = ?'); values.push(xml_content) }
  if (node_positions !== undefined) { updates.push('node_positions = ?'); values.push(JSON.stringify(node_positions)) }
  if (thumbnail !== undefined) { updates.push('thumbnail = ?'); values.push(thumbnail) }
  if (folder_id !== undefined) { updates.push('folder_id = ?'); values.push(folder_id) }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  updates.push("updated_at = datetime('now')")
  values.push(req.params.id)

  db.prepare(`UPDATE diagrams SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  const row = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(req.params.id) as Record<string, unknown>
  res.json({ ...row, node_positions: JSON.parse((row.node_positions as string) || '{}') })
})

// DELETE /api/diagrams/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM diagrams WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  if (result.changes === 0) {
    res.status(404).json({ error: 'Diagram not found' })
    return
  }
  res.json({ success: true })
})

export default router
