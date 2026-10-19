CREATE TABLE IF NOT EXISTS collections (
  share_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_ids TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  documentation_url TEXT NOT NULL,
  website_url TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  pricing_url TEXT,
  terms_url TEXT,
  tags_json TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS submissions_documentation_status
  ON submissions (documentation_url, status);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  api_id TEXT NOT NULL,
  details TEXT NOT NULL,
  source_url TEXT,
  created_at TEXT NOT NULL
);

