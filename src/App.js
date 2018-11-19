#! /usr/bin/env node

import pjson from "../package.json"
import { ConfigParser, Logger } from "@cantrips/core"
import {
  registerModule,
  loadModule,
  getRegisteredModules
} from "./ModuleRegistry"
import {
  generateCliCommandsForModules,
  attachMiscCliCommands
} from "./CliHandler"

import program from "commander"

program.version(pjson.version);

(async () => {
  registerModule(require("@cantrips/basemodules"))
  const config = await ConfigParser.parseConfig()

  if (config && config.modules) {
    await Promise.all(
      config.modules.map(async module => {
        registerModule(await loadModule(module))
      })
    )
  }

  generateCliCommandsForModules(program, getRegisteredModules())

  attachMiscCliCommands(program)

  program.parse(process.argv)

  if (!program.args.length) program.help()
})()

process.on("uncaughtException", function(err) {
  Logger.error(err)
  process.exit(-1)
})

process.on("unhandledRejection", function(reason) {
  Logger.error(reason.message)
  if (process.env.DEBUG) {
    Logger.error(reason)
  }
  process.exit(-1)
})
