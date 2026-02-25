// Supabase constants removed — now using self-hosted SQLite backend

export const AGENT_CATEGORIES = {
  'data-collection': {
    label: 'Data Collection',
    color: '#60A5FA',
    gradient: 'from-blue-400 to-blue-600',
    shades: ['#3B82F6', '#60A5FA', '#38BDF8', '#2563EB'] as readonly string[],
  },
  action: {
    label: 'Action',
    color: '#FB923C',
    gradient: 'from-orange-400 to-orange-600',
    shades: ['#F97316', '#FB923C', '#FBBF24', '#EF4444'] as readonly string[],
  },
  knowledge: {
    label: 'Knowledge',
    color: '#06B6D4',
    gradient: 'from-cyan-400 to-cyan-600',
    shades: ['#0891B2', '#06B6D4', '#22D3EE', '#0E7490'] as readonly string[],
  },
  clarification: {
    label: 'Clarification',
    color: '#C084FC',
    gradient: 'from-purple-400 to-purple-600',
    shades: ['#A855F7', '#C084FC', '#F472B6', '#8B5CF6'] as readonly string[],
  },
} as const

export type AgentCategory = keyof typeof AGENT_CATEGORIES

export const EDGE_STYLES = {
  userInput: { stroke: '#3B82F6', strokeWidth: 3 },
  potentialDelegation: { stroke: '#A78BFA', strokeWidth: 3, strokeDasharray: '6 3' },
  activeDelegation: { stroke: '#10B981', strokeWidth: 4 },
  dataFlow: { stroke: '#6B7280', strokeWidth: 3 },
  toolUsage: { stroke: '#F59E0B', strokeWidth: 3 },
  outputReturn: { stroke: '#059669', strokeWidth: 4 },
  contextRead: { stroke: '#7DD3FC', strokeWidth: 2.5, strokeDasharray: '4 4' },
  contextWrite: { stroke: '#3B82F6', strokeWidth: 2.5 },
  finalOutput: { stroke: '#10B981', strokeWidth: 3 },
} as const
