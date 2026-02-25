export interface GlobalUsageStats {
  monthly: {
    used: number
    limit: number
  }
  daily: {
    used: number
    limit: number
  }
  user: {
    monthlyUsed: number
  }
}

export async function fetchGlobalUsageStats(): Promise<GlobalUsageStats> {
  const token = localStorage.getItem('auth_token')
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch('/api/usage-stats', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch usage stats: ${response.status}`)
  }

  return response.json() as Promise<GlobalUsageStats>
}
