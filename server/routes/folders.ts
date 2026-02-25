import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'

const router = Router()

// GET /api/folders
router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM folders WHERE user_id = ? ORDER BY sort_order ASC, name ASC'
  ).all(req.userId)
  res.json(rows)
})

// POST /api/folders
router.post('/', (req, res) => {
  const { name, color, parent_id } = req.body as { name: string; color?: string; parent_id?: string }
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    'INSERT INTO folders (id, user_id, name, color, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.userId, name, color || null, parent_id || null, now, now)

  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id)
  res.status(201).json(row)
})

// PATCH /api/folders/:id
router.patch('/:id', (req, res) => {
  const { name, color } = req.body as { name?: string; color?: string | null }

  const updates: string[] = []
  const values: unknown[] = []
  if (name !== undefined) { updates.push('name = ?'); values.push(name) }
  if (color !== undefined) { updates.push('color = ?'); values.push(color) }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  updates.push("updated_at = datetime('now')")
  values.push(req.params.id, req.userId)

  const result = db.prepare(
    `UPDATE folders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  ).run(...values)

  if (result.changes === 0) {
    res.status(404).json({ error: 'Folder not found' })
    return
  }

  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id)
  res.json(row)
})

// DELETE /api/folders/:id
router.delete('/:id', (req, res) => {
  // Move diagrams out of folder before deleting
  db.prepare('UPDATE diagrams SET folder_id = NULL WHERE folder_id = ?').run(req.params.id)

  const result = db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  if (result.changes === 0) {
    res.status(404).json({ error: 'Folder not found' })
    return
  }
  res.json({ success: true })
})

export default router
