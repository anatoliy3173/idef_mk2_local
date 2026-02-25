export interface NodePositionMap {
  [nodeId: string]: { x: number; y: number }
}

export interface DiagramRecord {
  id: string
  user_id: string
  title: string
  xml_content: string
  node_positions: NodePositionMap
  thumbnail: string | null
  version_count: number
  folder_id: string | null
  created_at: string
  updated_at: string
  tags?: Tag[]
}

export interface DiagramVersion {
  id: string
  diagram_id: string
  user_id: string
  version_number: number
  label: string | null
  xml_content: string
  node_positions: NodePositionMap
  created_at: string
}

export interface Folder {
  id: string
  user_id: string
  name: string
  color: string | null
  parent_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface InputNode {
  id: string
  name: string
  source: string
  connectedAgents: string[]
}
