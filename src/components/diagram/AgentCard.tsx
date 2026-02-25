import type { TeamAgent } from '@/types/teamDiagram'
import { CARD_W, CARD_H } from '@/services/teamLayoutEngine'

interface AgentCardProps {
  agent: TeamAgent
  x: number
  y: number
}

export function AgentCard({ agent, x, y }: AgentCardProps) {
  const toolsText = agent.tools.length > 0 ? agent.tools.join(', ') : '—'
  const outputText = agent.output.length > 0 ? `{${agent.output.join(', ')}}` : null
  const structuredText = agent.structuredOutput.length > 0 ? `{${agent.structuredOutput.join(', ')}}` : null

  const showOutput = outputText !== null
  const showStructured = structuredText !== null

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: CARD_W,
        height: CARD_H,
        border: `2px solid ${agent.color}`,
        borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        background: '#ffffff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: agent.color,
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          minHeight: 28,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#ffffff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            marginRight: 6,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {agent.name}
        </span>
        <span
          style={{
            fontSize: 9,
            color: '#ffffff',
            background: 'rgba(255,255,255,0.22)',
            padding: '2px 6px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {agent.model}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '5px 10px',
          lineHeight: 1.6,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* ROLE row */}
        <div style={{ display: 'flex', alignItems: 'baseline', overflow: 'hidden' }}>
          <span style={labelStyle}>ROLE</span>
          <span
            style={{
              fontSize: 12,
              color: '#334155',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {agent.role || '—'}
          </span>
        </div>

        {/* TOOLS row */}
        <div style={{ display: 'flex', alignItems: 'baseline', overflow: 'hidden' }}>
          <span style={labelStyle}>TOOLS</span>
          <span
            style={{
              fontSize: 12,
              color: '#4f46e5',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {toolsText}
          </span>
        </div>

        {/* OUT row (regular output) */}
        {(showOutput || (!showOutput && !showStructured)) && (
          <div style={{ display: 'flex', alignItems: 'baseline', overflow: 'hidden' }}>
            <span style={labelStyle}>OUT</span>
            <span style={outputStyle}>
              {outputText ?? '—'}
            </span>
          </div>
        )}

        {/* S.OUT row (structured output) */}
        {showStructured && (
          <div style={{ display: 'flex', alignItems: 'baseline', overflow: 'hidden' }}>
            <span style={labelStyle}>S.OUT</span>
            <span style={outputStyle}>
              {structuredText}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#94a3b8',
  width: 38,
  flexShrink: 0,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  lineHeight: 1.6,
}

const outputStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#059669',
  fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
}
