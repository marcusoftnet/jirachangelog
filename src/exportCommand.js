import { Command } from "commander";
import { Parser } from "json2csv";
import Database from "better-sqlite3";
import fs from "node:fs";

const formatData = (rows, format) => {
  const parser = new Parser();
  switch (format) {
    case "json":
      return JSON.stringify(rows, null, 2);
    case "csv":
      return parser.parse(rows);
    default:
      console.error(`❌ Unsupported format: ${format}. Use "csv" or "json".`);
      process.exit(1);
  }
};

const exportAction = async (opts) => {
  const { query, format, db: dbPath, output } = opts;
  const db = new Database(dbPath);
  const rows = db.prepare(query).all();
  db.close();

  const data = formatData(rows, format);

  if (!output) {
    console.log(data);
    process.exit(0);
  }

  try {
    fs.writeFileSync(output, data, "utf8");
  } catch (err) {
    console.error(`❌ Failed to write output file: ${err.message}`);
    process.exit(1);
  }
};

export const exportCommand = new Command("export")
  .description("Export query results from local DB")
  .requiredOption("--query <sql>", "SQL query to execute")
  .option("--output <filename>", "Output filename")
  .option("--format <format>", "Output format: csv|json", "csv")
  .option("--db <path>", "SQLite DB file", "./output/jira_data.db")
  .action(exportAction);
