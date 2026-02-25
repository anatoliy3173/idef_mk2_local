import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'

const router = Router()

// GET /api/tags
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(req.userId)
  res.json(rows)
})

// POST /api/tags
router.post('/', (req, res) => {
  const { name, color } = req.body as { name: string; color: string }

  if (!name || !color) {
    res.status(400).json({ error: 'name and color are required' })
    return
  }

  const id = crypto.randomUUID()
  try {
    db.prepare('INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)').run(id, req.userId, name, color)
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Tag name already exists' })
      return
    }
    throw err
  }

  const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(id)
  res.status(201).json(row)
})

// PATCH /api/tags/:id
router.patch('/:id', (req, res) => {
  const { name, color } = req.body as { name?: string; color?: string }

  const updates: string[] = []
  const values: unknown[] = []
  if (name !== undefined) { updates.push('name = ?'); values.push(name) }
  if (color !== undefined) { updates.push('color = ?'); values.push(color) }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  values.push(req.params.id, req.userId)
  const result = db.prepare(
    `UPDATE tags SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  ).run(...values)

  if (result.changes === 0) {
    res.status(404).json({ error: 'Tag not found' })
    return
  }

  const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id)
  res.json(row)
})

// DELETE /api/tags/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(req.params.id, req.userId)
  if (result.changes === 0) {
    res.status(404).json({ error: 'Tag not found' })
    return
  }
  res.json({ success: true })
})

// POST /api/diagram-tags — add tag to diagram
router.post('/diagram-tags', (req, res) => {
  const { diagram_id, tag_id } = req.body as { diagram_id: string; tag_id: string }

  // Verify diagram ownership
  const diagram = db.prepare('SELECT id FROM diagrams WHERE id = ? AND user_id = ?').get(diagram_id, req.userId)
  if (!diagram) {
    res.status(404).json({ error: 'Diagram not found' })
    return
  }

  try {
    db.prepare('INSERT OR IGNORE INTO diagram_tags (diagram_id, tag_id) VALUES (?, ?)').run(diagram_id, tag_id)
  } catch {
    // ignore duplicate
  }
  res.json({ success: true })
})

// DELETE /api/diagram-tags
router.delete('/diagram-tags', (req, res) => {
  const { diagram_id, tag_id } = req.body as { diagram_id: string; tag_id: string }
  db.prepare('DELETE FROM diagram_tags WHERE diagram_id = ? AND tag_id = ?').run(diagram_id, tag_id)
  res.json({ success: true })
})

// GET /api/diagram-tags?diagram_ids=id1,id2,...
router.get('/diagram-tags', (req, res) => {
  const ids = (req.query.diagram_ids as string || '').split(',').filter(Boolean)
  if (ids.length === 0) {
    res.json({})
    return
  }

  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT diagram_id, tag_id FROM diagram_tags WHERE diagram_id IN (${placeholders})`
  ).all(...ids) as { diagram_id: string; tag_id: string }[]

  const map: Record<string, string[]> = {}
  for (const row of rows) {
    if (!map[row.diagram_id]) map[row.diagram_id] = []
    map[row.diagram_id].push(row.tag_id)
  }
  res.json(map)
})

export default router
