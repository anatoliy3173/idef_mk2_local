-- Add node_positions column to persist diagram layout positions
ALTER TABLE diagrams
  ADD COLUMN IF NOT EXISTS node_positions JSONB NOT NULL DEFAULT '{}';

-- Comment for clarity
COMMENT ON COLUMN diagrams.node_positions IS 'Stores node positions as { nodeId: { x, y } } for persisting user-arranged layouts';
