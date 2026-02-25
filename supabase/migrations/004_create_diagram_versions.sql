-- Version history for diagrams
CREATE TABLE IF NOT EXISTS diagram_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  label TEXT,
  xml_content TEXT NOT NULL,
  node_positions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE diagram_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own diagram versions"
  ON diagram_versions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_diagram_versions_diagram_id
  ON diagram_versions(diagram_id, version_number DESC);

-- Add version_count tracker to diagrams
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS version_count INTEGER NOT NULL DEFAULT 0;
