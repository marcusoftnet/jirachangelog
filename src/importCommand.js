import { Command } from "commander";
import dotenv from "dotenv";
import { fetchIssuesByJql, fetchIssueChangelog } from "./JiraUtils.js";
import { createConnection } from "./db.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);

dotenv.config(); // loads .env -> process.env

const normalizeJiraDate = (input) => {
  if (!input) return null;
  const parsed = dayjs.utc(input);
  if (!parsed.isValid()) return input;
  return parsed.format("YYYY-MM-DD HH:mm:ss");
};

const createChangeLogRow = (issue_key, item, entry) => ({
  issue_key,
  field: item.field,
  from_value: item.fromString || null,
  to_value: item.toString || null,
  change_date: normalizeJiraDate(entry.created),
  author: entry.author?.displayName ?? "",
});

const fetchChangeLogs = async (issues, username, token) => {
  const changelogPromises = issues.map(({ issue_key }) =>
    fetchIssueChangelog(issue_key, username, token).then((changes) => ({
      issue_key,
      changes,
    }))
  );
  return Promise.all(changelogPromises);
};

const SQL_INSERT_CHANGELOG = `
  INSERT INTO changelog (issue_key, field, from_value, to_value, change_date, author)
  VALUES (@issue_key, @field, @from_value, @to_value, @change_date, @author)
`;

const SQL_INSERT_ISSUES = `
  INSERT INTO issues (issue_key, created, issue_type, status_category, status)
  VALUES (@issue_key, @created, @issue_type, @status_category, @status)
`;

const writeToDb = (objects, sql, dbPath) => {
  const db = createConnection(dbPath);
  try {
    console.debug(`Inserting ${objects.length} rows to DB`);
    const insert = db.prepare(sql);

    const insertMany = db.transaction((rows) => {
      for (const row of rows) insert.run(row);
    });

    insertMany(objects);
  } catch (error) {
    console.error(`❌ Failed to write to DB: ${error.message}`);
    process.exit(1);
  } finally {
    db.close();
  }
};

const changeLogsToRows = (changeLogs) =>
  changeLogs.flatMap(({ issue_key, changes }) =>
    changes.flatMap((entry) =>
      entry.items.map((item) => createChangeLogRow(issue_key, item, entry))
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

  const issues = await fetchIssuesByJql(jql, jiraParams);
  const changeLogs = await fetchChangeLogs(issues, jiraParams);
  const changeLogRows = changeLogsToRows(changeLogs);

  writeToDb(issues, SQL_INSERT_ISSUES, dbPath);
  writeToDb(changeLogRows, SQL_INSERT_CHANGELOG, dbPath);

  console.log(`✅ Import complete for ${issues.length} issues.`);
};

export const importCommand = new Command("import")
  .description("Import Jira changelogs into a local SQLite database")
  .requiredOption("--jql <query>", "JQL query")
  .option("--username <username>", "Jira username/email (overrides .env)")
  .option("--token <token>", "Jira API token (overrides .env)")
  .option("--url <url>", "Jira API base URL (overrides .env)")
  .option("--db <path>", "SQLite file", "./output/jira_data.db")
  .action(exportAction);
