# 🧰 Jira Changelog CLI — Project Plan

## 🎯 Goal

A lightweight **CLI tool** that downloads Jira issue changelogs for any JQL query, stores them locally in SQLite, and allows full SQL querying of historical data.

This enables answering complex process questions such as:

- How long was an issue in “awaiting review”?
- How long did each issue spend in every state?
- When was a ticket added to a sprint?
- When did this issue first enter “In Progress”?
- How many issues were “In Progress” on a specific date?

---

## 🧠 Overview

Jira’s UI and built‑in reports make accessing *historical* state transitions cumbersome.
This project solves that by:

1. **Fetching and flattening changelogs** via the Jira REST API.
2. **Persisting the data locally** into an SQLite database.
3. **Allowing full SQL access** for analytics — ad‑hoc exploration, dashboards, and data export.

---

## ⚙️ Tech Stack

| Purpose |  Library / Tool |
|:---------- | :---------------- |
| Language | Node.js (ES Modules, built-in `fetch` ) |
| DB | SQLite (`better-sqlite3` or similar)|
| CLI Framework|`commander`|
| Env Loading|`dotenv` (or native Node 24`.env` support)|
| Date Handling|`dayjs`|
| CSV Export|`json2csv`|
| Auth / API| Jira Cloud REST API (Basic Auth with API token)|

---

## 🧩 High-Level Architecture

```text
jirachangelog/
├─ cli/
│ └─ jirachangelog.js # CLI entry (Commander commands)
├─ src/
│ ├─ JiraUtils.js # Shared Jira API helpers (fetchIssueKeys fetchIssueChangelog)
│ ├─ importCommand.js # jirachangelog import …
│ ├─ exportCommand.js # jirachangelog export …
│ ├─ db.js # SQLite connection and schema
│ ├─ queries/ # Optional SQL snippets (cycle times, CFD, etc.)
│ └─ utils/ # Logging, helpers
├─ .env # JIRA_API_URL, credentials (if desired)
└─ package.json
```

## 🧰 Core Functions (in `src/JiraUtils.js`)

### `fetchIssueChangelog(issueKey, username, token)`

Fetches a single issue’s changelog with retry and rate‑limit handling.

### `fetchIssueKeys(jql, username, token, batchSize = 100)`

Fetches all issue keys for a given JQL, supporting pagination.

Both functions use a shared `delay()` helper to throttle requests and respect Jira’s rate limits.

---

## 🖱️ CLI Commands

### `jirachangelog import`

Fetch and import all changelogs for issues returned by a JQL query.

**Example:**

```bash
jirachangelog import \
  --jql "project = DEMO AND updated >= -30d" \
  --username marcus@umain.com \
  --token $JIRA_TOKEN \
  --db ./jira_data.db
```

Behavior:

- Fetch all issue keys via fetchIssueKeys().
- Fetch changelogs for each issue via fetchIssueChangelog().
- Flatten results and insert into SQLite tables:

```text
issues(issue_key, type, created, updated, summary, status, …)
changelog(issue_key, field, from_value, to_value, change_date, author)
```

### `jirachangelog export`

Run SQL queries on the local database and export the results in CSV or JSON.

```bash
jirachangelog export \
  --query "SELECT to_status, AVG(days_in_state) AS avg_days FROM v_issue_state_durations GROUP BY to_status" \
  --db ./jira_data.db \
  --format csv > cycle_times.csv
```

Later, pre‑made named queries (e.g., --named cycle-times) can be added.

## 🧱 Database and Derived Views

Example base schema:

```sql
CREATE TABLE IF NOT EXISTS issues (
  issue_key TEXT PRIMARY KEY,
  issue_type TEXT,
  created TEXT,
  updated TEXT,
  summary TEXT,
  status TEXT
);

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
```

Derived SQL views (auto‑created by importCommand.js):

- `v_issue_state_durations` — Calculates time in each status using LEAD() window function.
- `v_first_in_progress` — Captures when each issue first entered "In Progress".
- `v_sprint_additions` — Tracks sprint assignment changes.

## 🚀 Planned Features / Roadmap

| Milestone | Description |
| :--- | :--- |
| ✅ MVP | import and export commands working end‑to‑end. |
| 🧩 Pre‑defined queries | Built‑in SQL snippets for cycle time, cumulative flow, etc. |
| 🔁 Incremental sync |  Only pull issues updated since last import. |
| ⚙️ Config file Support  | ~/.jira-changelog.yaml or .env defaults. |
| 📊 Dashboard integration  | Compatible with tools like Metabase, Observable, or Superset. |
| ☁️ Alternative DB Backends |  DuckDB / Parquet export for large datasets. |
| 🧪 Testing & CI  | Add tests for API/utilities and database handling. |

## ✅ Current Status

- ✔ `fetchIssueChangelog()` implemented
- ✔ `fetchIssueKeys()` implemented (pagination + retry)
- 🧠 Next: Implement `importCommand.js` to combine the two and populate the DB
- 🧱 Then: Add `exportCommand.js` for SQL queries and CSV export

## 🪄 Vision

Empower agile teams and coaches to self‑serve reliable process insights from Jira data — without needing expensive BI tools or admin privileges.
The goal is transparency, traceability, and empowerment through simple, local data analytics.

> Agile insight at your command line.
