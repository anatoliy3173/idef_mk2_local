-- Folders (flat initially, parent_id allows future nesting)
CREATE TABLE IF NOT EXISTS folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own folders"
  ON folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_folders_user_id ON folders(user_id);

-- Auto-update updated_at for folders
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tags"
  ON tags FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Junction table: diagram <-> tag (many-to-many)
CREATE TABLE IF NOT EXISTS diagram_tags (
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (diagram_id, tag_id)
);

ALTER TABLE diagram_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own diagram tags"
  ON diagram_tags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM diagrams WHERE diagrams.id = diagram_tags.diagram_id AND diagrams.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM diagrams WHERE diagrams.id = diagram_tags.diagram_id AND diagrams.user_id = auth.uid())
  );

-- Add folder_id to diagrams
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX idx_diagrams_folder_id ON diagrams(folder_id);
