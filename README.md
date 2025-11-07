# The Jira Time Machine

A lightweight CLI tool that downloads Jira issue changelogs for any JQL query, stores them locally in SQLite, and allows full SQL querying of historical data.

## 🎯 Purpose

This tool enables you to answer complex process questions about your Jira issues:

- How long was an issue in "awaiting review"?
- How long did each issue spend in every state?
- When was a ticket added to a sprint?
- When did this issue first enter "In Progress"?
- How many issues were "In Progress" on a specific date?

Jira's UI and built-in reports make accessing historical state transitions cumbersome. This project solves that by fetching and flattening changelogs via the Jira REST API, persisting the data locally into an SQLite database, and allowing full SQL access for analytics.

## 📋 Prerequisites

- Node.js (with ES Modules support)
- A Jira account with API access
- A Jira API token ([How to create one](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/))

## 🚀 Installation

1. Clone this repository:

```bash
git clone <repository-url>
cd jirachangelog
```

1. Install dependencies:

```bash
npm install
```

1. Make the CLI executable (if not already):

```bash
chmod +x cli/jtm.js
```

## ⚙️ Configuration

Create a `.env` file in the project root with your Jira credentials:

```env
JIRA_API_URL=https://your-domain.atlassian.net/rest/api/3
JIRA_API_USER=your-email@example.com
JIRA_API_TOKEN=your-api-token
```

Alternatively, you can pass these values as command-line options (see Usage below).

## 📖 Usage

### Import Command

Fetch and import changelogs for issues matching a JQL query:

```bash
jtm import \
  --jql "project = DEMO AND updated >= -30d" \
  --db ./output/jira_data.db
```

**Options:**

- `--jql <query>` (required): JQL query to find issues
- `--username <username>`: Jira username/email (overrides .env)
- `--token <token>`: Jira API token (overrides .env)
- `--url <url>`: Jira API base URL (overrides .env)
- `--db <path>`: SQLite database file path (default: `./output/jira_data.db`)

**Example:**

```bash
jtm import \
  --jql "project = DEMO AND updated >= -30d" \
  --username marcus@umain.com \
  --token $JIRA_TOKEN \
  --db ./output/jira_data.db
```

### Export Command

Run SQL queries on the local database and export results to CSV or JSON:

```bash
jtm export \
  --query "SELECT * FROM changelog WHERE status = 'In Progress'" \
  --output ./output/cycle_times.csv \
  --format csv \
  --db ./output/jira_data.db
```

**Options:**

- `--query <sql>` (required): SQL query to execute
- `--output <filename>` (required): Output filename
- `--format <format>`: Output format: `csv` or `json` (default: `csv`)
- `--db <path>`: SQLite database file path (default: `./output/jira_data.db`)

**Examples:**

```bash
node cli/jtm export \
  --query "SELECT issue_key, field, from_value, to_value, change_date FROM \
  changelog" --format json \
  > output.json
```

```bash
jtm export \
  --query "SELECT to_status, AVG(days_in_state) AS avg_days FROM v_status_durations GROUP BY to_status" \
  --output ./output/avg_cycle_times.csv \
  --format csv
```

## 🗄️ Database Schema

The tool creates a SQLite database with the following structure:

### Tables

**`changelog`**

- `id` (INTEGER PRIMARY KEY)
- `issue_key` (TEXT)
- `field` (TEXT) - The field that changed (e.g., "status", "assignee")
- `from_value` (TEXT) - Previous value
- `to_value` (TEXT) - New value
- `change_date` (TEXT) - When the change occurred
- `author` (TEXT) - Who made the change

### Views

**`v_status_durations`**
A pre-built view that calculates time spent in each status for all issues:

- `issue_key` - The issue identifier
- `status` - The status name
- `entered_at` - When the issue entered this status
- `left_at` - When the issue left this status (or current time if still in this status)
- `days_in_state` - Number of days spent in this status

## 📊 Example Queries

### Average time in each status

```sql
SELECT
  status,
  AVG(days_in_state) AS avg_days,
  MIN(days_in_state) AS min_days,
  MAX(days_in_state) AS max_days
FROM v_status_durations
GROUP BY status
ORDER BY avg_days DESC;
```

### Issues currently in a specific status

```sql
SELECT
  issue_key,
  status,
  entered_at,
  days_in_state
FROM v_status_durations
WHERE status = 'In Progress'
  AND left_at > datetime('now', '-1 day')
ORDER BY days_in_state DESC;
```

### All status transitions for an issue

```sql
SELECT
  field,
  from_value,
  to_value,
  change_date,
  author
FROM changelog
WHERE issue_key = 'DEMO-123'
  AND field = 'status'
ORDER BY change_date;
```

### Issues awaiting review

```sql
SELECT
  issue_key,
  entered_at,
  days_in_state
FROM v_status_durations
WHERE status = 'Awaiting Review'
ORDER BY days_in_state DESC;
```

## 🔧 Features

- **Rate Limiting**: Automatically handles Jira API rate limits with retry logic
- **Pagination**: Supports large result sets by paginating through JQL queries
- **Error Handling**: Gracefully handles API errors and continues processing
- **SQLite Views**: Pre-built views for common analytics queries
- **Flexible Export**: Export query results as CSV or JSON

## 🛠️ Development

The project structure:

```text
jirachangelog/
├── cli/
│   └── jtm.js                # CLI entry point
├── src/
│   ├── JiraUtils.js          # Jira API helpers
│   ├── importCommand.js      # Import command implementation
│   ├── exportCommand.js      # Export command implementation
│   └── db.js                 # Database connection and schema
├── output/                   # Default location for database and exports
└── package.json
```

## 📝 Notes

- The tool respects Jira's rate limits by adding delays between requests
- Changelog data is stored locally in SQLite, so you can query it offline
- The database is created automatically on first import
- The import process may take some time for large datasets due to rate limiting

## 🐛 Troubleshooting

### Issue: "Missing credentials or API URL"

- Ensure your `.env` file is set up correctly, or pass credentials via CLI options

### Issue: Rate limiting errors

- The tool automatically retries on rate limit errors, but you may need to wait longer between imports

### Issue: "Failed to fetch issue keys"

- Verify your JQL query is valid
- Check that your API token has the necessary permissions
- Ensure the Jira API URL is correct

## 📄 License

ISC

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.
