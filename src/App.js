#! /usr/bin/env node

import { ConfigParser, Logger } from "@cantrips/core"
import ModuleRegistry from "./ModuleRegistry"
import { generateCliCommandsForModules, attachMiscCliCommands } from "./CliHandler"

import * as Cli from "nested-yargs"
;(async () => {
  ModuleRegistry.registerRequiredModule(require("@cantrips/basemodules"))
  const config = await ConfigParser.parseConfig()
  if (config && config.modules) {
    await Promise.all(
      Object.keys(config.modules).map(async moduleName => {
        return ModuleRegistry.registerModule(moduleName, config.modules[moduleName])
      })
    )
  }

  let app = Cli.createApp()

  app = await generateCliCommandsForModules(app, ModuleRegistry.getRegisteredModules(), config)

  app = attachMiscCliCommands(app)
  if (process.env.NODE_ENV !== "test") {
    Cli.run(app)
  }
})()

process.on("uncaughtException", function(error) {
  Logger.error(error.message)
  if (process.env.DEBUG) {
    Logger.error(error.stack)
  }
  process.exit(-1)
})

process.on("unhandledRejection", function(reason, promise) {
  Logger.error(reason)

  if (process.env.DEBUG) {
    Logger.error(promise)
  }
  process.exit(-1)
})
