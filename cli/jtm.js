#!/usr/bin/env node
import { Command } from "commander";
import dotenv from "dotenv";
dotenv.config();

import { importCommand } from "../src/importCommand.js";
import { exportCommand } from "../src/exportCommand.js";

const program = new Command();
program
  .name("jtm")
  .description("The Jira Time Machine - Query and export Jira changelogs")
  .version("1.0.0");

program.addCommand(importCommand);
program.addCommand(exportCommand);

if (process.argv.length < 3) program.help();
program.parse(process.argv);
