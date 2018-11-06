#! /usr/bin/env node

import pjson from "../package.json";
import { ConfigParser, Logger } from "cantrips-core";
import {
  registerModule,
  generateCliCommands,
  loadModule
} from "./ModuleRegistry";

import program from "commander";

program.version(pjson.version);

(async () => {
  registerModule(require("cantrips-basemodules"));
  const config = await ConfigParser.parseConfig();

  await Promise.all(
    config.modules.map(async module => {
      registerModule(await loadModule(module));
    })
  );

  generateCliCommands(program);

  program.parse(process.argv);

  if (!program.args.length) program.help();
})();

process.on("uncaughtException", function(err) {
  Logger.error(err);
});

process.on("unhandledRejection", function(reason, p) {
  Logger.error(reason.message);
  if (process.env.DEBUG) {
    Logger.error(reason);
  }
});
