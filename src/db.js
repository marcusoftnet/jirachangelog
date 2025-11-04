import Database from "better-sqlite3";

export function createConnection(dbPath) {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS changelog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_key TEXT,
      field TEXT,
      from_value TEXT,
      to_value TEXT,
      change_date TEXT,
      author TEXT
    );
    CREATE VIEW IF NOT EXISTS v_status_durations AS
    SELECT
      issue_key,
      field,
      to_value AS status,
      change_date AS entered_at,
      COALESCE(
        LEAD(change_date) OVER (PARTITION BY issue_key ORDER BY datetime(change_date)),
        CURRENT_TIMESTAMP
      ) AS left_at,
      ROUND(
        JULIANDAY(
          COALESCE(
            LEAD(change_date) OVER (PARTITION BY issue_key ORDER BY datetime(change_date)),
            CURRENT_TIMESTAMP
          )
        ) - JULIANDAY(datetime(change_date)),
        3
      ) AS days_in_state
    FROM changelog
    WHERE field = 'status';
    CREATE INDEX IF NOT EXISTS idx_changelog_date ON changelog(change_date);
  `);

  return db;
}