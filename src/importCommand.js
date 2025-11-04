import { Command } from "commander";
import dotenv from "dotenv";
import { fetchIssueKeys, fetchIssueChangelog } from "./JiraUtils.js";
import { createConnection } from "./db.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);

dotenv.config(); // loads .env -> process.env

const normalizeJiraDate = (input) => {
  if (!input) return null;
  const parsed = dayjs.utc(input);
  if (!parsed.isValid()) return input;
  return parsed.format("YYYY‑MM‑DD HH:mm:ss");
};

const createChangeLogRow = (issueKey, item, entry) => ({
  issue_key: issueKey,
  field: item.field,
  from_value: item.fromString || null,
  to_value: item.toString || null,
  change_date: normalizeJiraDate(entry.created),
  author: entry.author?.displayName ?? "",
});

const fetchChangeLogs = async (issueKeys, username, token) => {
  const changelogPromises = issueKeys.map((key) =>
    fetchIssueChangelog(key, username, token).then((changes) => ({
      key,
      changes,
    }))
  );
  return Promise.all(changelogPromises);
};

const insertSQL = `
  INSERT INTO changelog (issue_key, field, from_value, to_value, change_date, author)
  VALUES (@issue_key, @field, @from_value, @to_value, @change_date, @author)
`;

const writeChangeLogRowsToDb = (changeLogRows, dbPath) => {
  const db = createConnection(dbPath);
  try {
    console.debug(`Inserting ${changeLogRows.length} change log rows into DB`);
    const insert = db.prepare(insertSQL);

    const insertMany = db.transaction((rows) => {
      for (const row of rows) insert.run(row);
    });

    insertMany(changeLogRows);
  } catch (error) {
    console.error(`❌ Failed to write to DB: ${error.message}`);
    process.exit(1);
  } finally {
    db.close();
  }
};

const changeLogsToRows = (changeLogs) =>
  changeLogs.flatMap(({ key, changes }) =>
    changes.flatMap((entry) =>
      entry.items.map((item) => createChangeLogRow(key, item, entry))
    )
  );

const exportAction = async (opts) => {
  const jql = opts.jql;
  const username = opts.username || process.env.JIRA_API_USER;
  const token = opts.token || process.env.JIRA_API_TOKEN;
  const dbPath = opts.db;
  const apiUrl = opts.url || process.env.JIRA_API_URL;

  if (!username || !token || !apiUrl) {
    console.error("❌ Missing credentials or API URL.");
    console.error(
      "Please set JIRA_API_URL, JIRA_API_USER, JIRA_API_TOKEN in .env or use CLI options."
    );
    process.exit(1);
  }
  const jiraParams = { apiUrl, username, token };

  const issueKeys = await fetchIssueKeys(jql, jiraParams);

  const changeLogs = await fetchChangeLogs(issueKeys, jiraParams);
  const changeLogRows = changeLogsToRows(changeLogs);

  writeChangeLogRowsToDb(changeLogRows, dbPath);

  console.log(`✅ Import complete for ${issueKeys.length} issues.`);
};

export const importCommand = new Command("import")
  .description("Import Jira changelogs into a local SQLite database")
  .requiredOption("--jql <query>", "JQL query")
  .option("--username <username>", "Jira username/email (overrides .env)")
  .option("--token <token>", "Jira API token (overrides .env)")
  .option("--url <url>", "Jira API base URL (overrides .env)")
  .option("--db <path>", "SQLite file", "./output/jira_data.db")
  .action(exportAction);
