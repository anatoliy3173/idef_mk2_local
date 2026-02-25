import type { DiagramRecord, DiagramVersion, Folder, Tag } from '@/types/diagram'

const API_BASE = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error((data as Record<string, string>).error || `Request failed: ${response.status}`)
    ;(error as Error & { status: number; code?: string }).status = response.status
    ;(error as Error & { status: number; code?: string }).code = (data as Record<string, string>).code
    throw error
  }

  return response.json() as Promise<T>
}

export const api = {
  auth: {
    register: (username: string, password: string) =>
      request<{ user: { id: string; username: string }; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    login: (username: string, password: string) =>
      request<{ user: { id: string; username: string }; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    me: () => request<{ user: { id: string; username: string; created_at: string } }>('/auth/me'),
  },

  diagrams: {
    list: (folderId?: string | null) =>
      request<DiagramRecord[]>(folderId ? `/diagrams?folder_id=${folderId}` : '/diagrams'),
    get: (id: string) => request<DiagramRecord>(`/diagrams/${id}`),
    create: (data: { title?: string; xml_content?: string; node_positions?: Record<string, unknown>; folder_id?: string | null }) =>
      request<DiagramRecord>('/diagrams', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<DiagramRecord>(`/diagrams/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/diagrams/${id}`, { method: 'DELETE' }),
  },

  versions: {
    list: (diagramId: string) => request<DiagramVersion[]>(`/diagrams/${diagramId}/versions`),
    get: (id: string) => request<DiagramVersion>(`/versions/${id}`),
    create: (diagramId: string, data: { xml_content: string; node_positions?: Record<string, unknown>; label?: string }) =>
      request<DiagramVersion>(`/diagrams/${diagramId}/versions`, { method: 'POST', body: JSON.stringify(data) }),
    updateLabel: (id: string, label: string) =>
      request<{ success: boolean }>(`/versions/${id}`, { method: 'PATCH', body: JSON.stringify({ label }) }),
    delete: (id: string) => request<{ success: boolean }>(`/versions/${id}`, { method: 'DELETE' }),
  },

  folders: {
    list: () => request<Folder[]>('/folders'),
    create: (data: { name: string; color?: string; parent_id?: string }) =>
      request<Folder>('/folders', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; color?: string | null }) =>
      request<Folder>(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/folders/${id}`, { method: 'DELETE' }),
  },

  tags: {
    list: () => request<Tag[]>('/tags'),
    create: (data: { name: string; color: string }) =>
      request<Tag>('/tags', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; color?: string }) =>
      request<Tag>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/tags/${id}`, { method: 'DELETE' }),
  },

  diagramTags: {
    add: (diagramId: string, tagId: string) =>
      request<{ success: boolean }>('/tags/diagram-tags', { method: 'POST', body: JSON.stringify({ diagram_id: diagramId, tag_id: tagId }) }),
    remove: (diagramId: string, tagId: string) =>
      request<{ success: boolean }>('/tags/diagram-tags', { method: 'DELETE', body: JSON.stringify({ diagram_id: diagramId, tag_id: tagId }) }),
    batchFetch: (diagramIds: string[]) =>
      request<Record<string, string[]>>(`/tags/diagram-tags?diagram_ids=${diagramIds.join(',')}`),
  },
}

export type { DiagramRecord, DiagramVersion, Folder, Tag }
