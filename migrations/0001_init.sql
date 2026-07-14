-- Pieces: one row per saved palette. Both tokens are unguessable 128-bit
-- capability tokens; the edit token grants edit, the share token is read-only.
CREATE TABLE IF NOT EXISTS pieces (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  edit_token   TEXT NOT NULL UNIQUE,
  share_token  TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL DEFAULT '',
  data_json    TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pieces_edit  ON pieces(edit_token);
CREATE INDEX IF NOT EXISTS idx_pieces_share ON pieces(share_token);
CREATE INDEX IF NOT EXISTS idx_pieces_updated ON pieces(updated_at);

-- Write log for per-IP rate limiting on create.
CREATE TABLE IF NOT EXISTS write_log (
  ip          TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_write_log_ip ON write_log(ip, created_at);
