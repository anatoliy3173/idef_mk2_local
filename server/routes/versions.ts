import { Router } from 'express'
import crypto from 'crypto'
import db from '../db.js'

const router = Router()
const MAX_VERSIONS_PER_DIAGRAM = 100

// GET /api/diagrams/:diagramId/versions
router.get('/diagrams/:diagramId/versions', (req, res) => {
  // Verify diagram ownership
  const diagram = db.prepare('SELECT id FROM diagrams WHERE id = ? AND user_id = ?').get(req.params.diagramId, req.userId)
  if (!diagram) {
    res.status(404).json({ error: 'Diagram not found' })
    return
  }

  const rows = db.prepare(
    'SELECT * FROM diagram_versions WHERE diagram_id = ? ORDER BY version_number DESC'
  ).all(req.params.diagramId) as Record<string, unknown>[]

  const versions = rows.map(r => ({
    ...r,
    node_positions: JSON.parse((r.node_positions as string) || '{}'),
  }))
  res.json(versions)
})

// POST /api/diagrams/:diagramId/versions
router.post('/diagrams/:diagramId/versions', (req, res) => {
  const { xml_content, node_positions, label } = req.body as {
    xml_content: string; node_positions?: Record<string, unknown>; label?: string
  }

  // Verify diagram ownership
  const diagram = db.prepare('SELECT id FROM diagrams WHERE id = ? AND user_id = ?').get(req.params.diagramId, req.userId)
  if (!diagram) {
    res.status(404).json({ error: 'Diagram not found' })
    return
  }

  // Get next version number
  const latest = db.prepare(
    'SELECT version_number FROM diagram_versions WHERE diagram_id = ? ORDER BY version_number DESC LIMIT 1'
  ).get(req.params.diagramId) as { version_number: number } | undefined
  const nextVersion = (latest?.version_number ?? 0) + 1

  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO diagram_versions (id, diagram_id, user_id, version_number, label, xml_content, node_positions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.params.diagramId, req.userId, nextVersion, label || null, xml_content, JSON.stringify(node_positions || {}))

  // Update version_count on diagram
  db.prepare('UPDATE diagrams SET version_count = ? WHERE id = ?').run(nextVersion, req.params.diagramId)

  // Enforce max cap
  const allVersions = db.prepare(
    'SELECT id FROM diagram_versions WHERE diagram_id = ? ORDER BY version_number ASC'
  ).all(req.params.diagramId) as { id: string }[]

  if (allVersions.length > MAX_VERSIONS_PER_DIAGRAM) {
    const excess = allVersions.length - MAX_VERSIONS_PER_DIAGRAM
    const toDelete = allVersions.slice(0, excess).map(v => v.id)
    const placeholders = toDelete.map(() => '?').join(',')
    db.prepare(`DELETE FROM diagram_versions WHERE id IN (${placeholders})`).run(...toDelete)
  }

  const row = db.prepare('SELECT * FROM diagram_versions WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ ...row, node_positions: JSON.parse((row.node_positions as string) || '{}') })
})

// GET /api/versions/:id
router.get('/versions/:id', (req, res) => {
  const row = db.prepare(
    `SELECT dv.* FROM diagram_versions dv
     JOIN diagrams d ON dv.diagram_id = d.id
     WHERE dv.id = ? AND d.user_id = ?`
  ).get(req.params.id, req.userId) as Record<string, unknown> | undefined

  if (!row) {
    res.status(404).json({ error: 'Version not found' })
    return
  }
  res.json({ ...row, node_positions: JSON.parse((row.node_positions as string) || '{}') })
})

// PATCH /api/versions/:id
router.patch('/versions/:id', (req, res) => {
  const { label } = req.body as { label: string }

  const result = db.prepare(
    `UPDATE diagram_versions SET label = ?
     WHERE id = ? AND user_id = ?`
  ).run(label, req.params.id, req.userId)

  if (result.changes === 0) {
    res.status(404).json({ error: 'Version not found' })
    return
  }
  res.json({ success: true })
})

// DELETE /api/versions/:id
router.delete('/versions/:id', (req, res) => {
  const result = db.prepare(
    `DELETE FROM diagram_versions
     WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.userId)

  if (result.changes === 0) {
    res.status(404).json({ error: 'Version not found' })
    return
  }
  res.json({ success: true })
})

export default router
