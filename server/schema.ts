import type Database from 'better-sqlite3'

export function initializeSchema(db: InstanceType<typeof Database>): void {
  // ── Tables ─────────────────────────────────────────────────────────────────

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `)

  // folders must exist before diagrams references it
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      name        TEXT NOT NULL,
      color       TEXT,
      parent_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS diagrams (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id),
      title           TEXT NOT NULL DEFAULT 'Untitled Diagram',
      xml_content     TEXT NOT NULL DEFAULT '',
      node_positions  TEXT DEFAULT '{}',
      thumbnail       TEXT,
      version_count   INTEGER DEFAULT 0,
      folder_id       TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS diagram_versions (
      id              TEXT PRIMARY KEY,
      diagram_id      TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      user_id         TEXT NOT NULL REFERENCES users(id),
      version_number  INTEGER NOT NULL,
      label           TEXT,
      xml_content     TEXT NOT NULL,
      node_positions  TEXT DEFAULT '{}',
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id),
      name       TEXT NOT NULL,
      color      TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS diagram_tags (
      diagram_id TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
      tag_id     TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (diagram_id, tag_id)
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_usage (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL REFERENCES users(id),
      created_at        TEXT DEFAULT (datetime('now')),
      tokens_prompt     INTEGER DEFAULT 0,
      tokens_completion INTEGER DEFAULT 0,
      tokens_total      INTEGER DEFAULT 0,
      model             TEXT DEFAULT 'gpt-4.1-mini',
      status            TEXT NOT NULL,
      error_message     TEXT
    );
  `)

  // ── Indexes ────────────────────────────────────────────────────────────────

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_diagrams_user_id   ON diagrams(user_id);
    CREATE INDEX IF NOT EXISTS idx_diagrams_updated_at ON diagrams(updated_at);
    CREATE INDEX IF NOT EXISTS idx_diagrams_folder_id  ON diagrams(folder_id);

    CREATE INDEX IF NOT EXISTS idx_diagram_versions_diagram_version
      ON diagram_versions(diagram_id, version_number DESC);

    CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

    CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at
      ON llm_usage(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_llm_usage_user_created
      ON llm_usage(user_id, created_at DESC);
  `)
}
