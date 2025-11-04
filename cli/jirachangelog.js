#!/usr/bin/env node
import { Command } from "commander";
import dotenv from "dotenv";
dotenv.config();

import { importCommand } from "../src/importCommand.js";
import { exportCommand } from "../src/exportCommand.js";

const program = new Command();
program
  .name("jirachangelog")
  .description("Query and export Jira changelogs")
  .version("0.1.0");

program.addCommand(importCommand);
program.addCommand(exportCommand);

if (process.argv.length < 3) program.help();
program.parse(process.argv);
