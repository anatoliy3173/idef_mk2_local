-- Add thumbnail column for diagram preview images in catalog
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS thumbnail TEXT;
COMMENT ON COLUMN diagrams.thumbnail IS 'Base64-encoded low-res PNG thumbnail of the diagram';
