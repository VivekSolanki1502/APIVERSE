CREATE TABLE IF NOT EXISTS request_limits (
  client_hash TEXT NOT NULL,
  route TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  PRIMARY KEY (client_hash, route)
);
