import { TYPE_COLORS, type TeamDiagram, type TeamAgent, type TeamConnection } from '@/types/teamDiagram'

export function parseTeamXml(xmlString: string): { data: TeamDiagram | null; error: string | null } {
  if (!xmlString.trim()) {
    return { data: null, error: null }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    return { data: null, error: 'Invalid XML: ' + (parseError.textContent ?? '').slice(0, 120) }
  }

  const teamEl = doc.querySelector('team')
  if (!teamEl) {
    // Not a team XML — return null without error (may be old format)
    return { data: null, error: null }
  }

  const meta = {
    name: teamEl.getAttribute('name') ?? 'Untitled Team',
    description: teamEl.getAttribute('description') ?? '',
  }

  const agents: TeamAgent[] = []
  doc.querySelectorAll('agent').forEach((el) => {
    const id = el.getAttribute('id')
    if (!id) return
    const type = el.getAttribute('type') ?? 'executor'
    const color = TYPE_COLORS[type] ?? '#6b7280'

    // Parse <stO> and <sto> tags (handle both cases)
    const structuredOutput: string[] = []
    el.querySelectorAll('stO, sto').forEach((o) => {
      const text = o.textContent?.trim()
      if (text) structuredOutput.push(text)
    })

    agents.push({
      id,
      name: el.getAttribute('name') ?? id,
      model: el.getAttribute('model') ?? '—',
      role: el.getAttribute('role') ?? '',
      type,
      color,
      tools: Array.from(el.querySelectorAll('tool')).map((t) => t.textContent?.trim() ?? '').filter(Boolean),
      output: Array.from(el.querySelectorAll('o')).map((o) => o.textContent?.trim() ?? '').filter(Boolean),
      structuredOutput,
    })
  })

  const connections: TeamConnection[] = []
  doc.querySelectorAll('connection').forEach((el) => {
    const from = el.getAttribute('from')
    const to = el.getAttribute('to')
    if (from && to) {
      connections.push({ from, to, label: el.getAttribute('label') ?? '' })
    }
  })

  if (agents.length === 0) {
    return { data: null, error: 'No agents found in XML' }
  }

  return { data: { meta, agents, connections }, error: null }
}
