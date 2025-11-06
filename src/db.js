import Database from "better-sqlite3";

export function createConnection(dbPath) {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      issue_key TEXT PRIMARY KEY,
      summary TEXT,
      created datetime,
      resolution TEXT,
      issue_type TEXT,
      status_category TEXT,
      status TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_issue_type ON issues(issue_type);
    CREATE INDEX IF NOT EXISTS idx_issue_created ON issues(created);

    CREATE TABLE IF NOT EXISTS changelog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_key TEXT,
      field TEXT,
      from_value TEXT,
      to_value TEXT,
      change_date TEXT,
      author TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_changelog_date ON changelog(change_date);

    CREATE VIEW IF NOT EXISTS v_status_durations AS
    WITH status_changes AS (
      SELECT
        issue_key,
        to_value AS status,
        datetime(change_date) AS entered_at,
        LEAD(datetime(change_date)) OVER (
          PARTITION BY issue_key ORDER BY datetime(change_date)
        ) AS left_at
      FROM changelog
      WHERE field = 'status'
    )
    SELECT
      issue_key,
      status,
      entered_at,
      COALESCE(left_at, CURRENT_TIMESTAMP) AS left_at,
      ROUND(
        JULIANDAY(COALESCE(left_at, CURRENT_TIMESTAMP)) -
        JULIANDAY(entered_at),
        3
      ) AS days_in_state
    FROM status_changes;
  `);

  return db;
}