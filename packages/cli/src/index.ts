#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";
import { registerInit } from "./commands/init.js";
import { registerStatus } from "./commands/status.js";
import { registerDiff } from "./commands/diff.js";
import { registerSync } from "./commands/sync.js";
import { registerValidate } from "./commands/validate.js";
import { registerMarkSynced } from "./commands/mark-synced.js";
import { registerCR } from "./commands/cr.js";
import { registerBug } from "./commands/bug.js";
import { registerAdapters } from "./commands/adapters.js";
import { registerUI } from "./commands/ui.js";
import { registerUpgrade } from "./commands/upgrade.js";
import { registerRemote } from "./commands/remote.js";
import { registerPull } from "./commands/pull.js";
import { registerPush } from "./commands/push.js";
import { registerDrafts } from "./commands/drafts.js";
import { registerMarkDraftsEnriched } from "./commands/mark-drafts-enriched.js";

const packageRequire = createRequire(__filename);
const packageJson = packageRequire("../package.json") as { version: string };

const program = new Command();

program
  .name("sdd")
  .description("Story Driven Development — manage apps through structured documentation")
  .version(packageJson.version);

registerInit(program);
registerStatus(program);
registerDiff(program);
registerSync(program);
registerValidate(program);
registerMarkSynced(program);
registerCR(program);
registerBug(program);
registerAdapters(program);
registerUI(program);
registerUpgrade(program);
registerRemote(program);
registerPull(program);
registerPush(program);
registerDrafts(program);
registerMarkDraftsEnriched(program);

program.parseAsync().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
