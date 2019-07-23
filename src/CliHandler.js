import { Logger, ParameterProvider } from "@cantrips/core"
import ModuleRegistry from "./ModuleRegistry"

import packageJson from "../package.json"

import * as Cli from "nested-yargs"

const removeUndefinedProperites = (obj = {}) =>
  Object.keys(obj).reduce((acc, key) => {
    if (obj[key]) acc[key] = obj[key]
    return acc
  }, {})

export function attachMiscCliCommands(app) {
  app.command(
    Cli.createCommand("describeCI", "Prints the information about the current CI environment.", {
      handler: function() {
        new ParameterProvider().describeCI()
      }
    })
  )

  app.command(
    Cli.createCommand("listModules", "List the registered cantrip modules", {
      handler: function() {
        ModuleRegistry.listModules()
      }
    })
  )

  app.command(
    Cli.createCommand("version", "Show the version of the Cantrips cli", {
      handler: function() {
        Logger.info(packageJson.version)
      }
    })
  )
  return app
}

const DEFAUL_OPTIONS = {
  timeout: 60000
}

function generateOptionsForCommand(descriptor, actionName) {
  const options = {}
  if (descriptor.parameters) {
    descriptor.parameters.forEach(parameter => {
      options[parameter.name] = {
        description: parameter.description,
        boolean: parameter.flag
      }
    })
  }

  if (descriptor.exposed[actionName] && descriptor.exposed[actionName].parameters) {
    descriptor.exposed[actionName].parameters.forEach(parameter => {
      options[parameter.name] = {
        description: parameter.description,
        boolean: parameter.flag || false
      }
    })
  }

  return options
}

export const createCommandHandler = (descriptor, actionName, moduleSetting) => argv => {
  const commandOptions = removeUndefinedProperites(argv)

  delete commandOptions._
  delete commandOptions.help
  delete commandOptions["$0"]
  return new Promise(resolve => {
    const actor = new descriptor["type"]({
      ...removeUndefinedProperites(moduleSetting),
      ...commandOptions
    })
    Logger.debug(
      `Running command ${descriptor.name} ${actionName} with options: ${JSON.stringify(commandOptions, null, 2)}`
    )
    resolve(actor[actionName]({ ...removeUndefinedProperites(moduleSetting), ...commandOptions }))
  })
}

async function attachSubCommandsForModule(moduleCli, descriptor, moduleSetting) {
  //temporary backward compatibility
  let validActions = Array.isArray(descriptor.exposed) ? descriptor.exposed : Object.keys(descriptor.exposed)

  validActions.forEach(actionName => {
    const options = generateOptionsForCommand(descriptor, actionName)
    const isModuleExpectedToHandleTimeout = !!options.timeout
    if (!isModuleExpectedToHandleTimeout) {
      options.timeout = {
        description: `Timeout for the command, default: ${DEFAUL_OPTIONS.timeout}ms`,
        boolean: false
      }
    }
    moduleCli.command(
      Cli.createCommand(
        actionName,
        (descriptor.exposed[actionName] && descriptor.exposed[actionName].description) || "TBD",
        {
          options,
          handler: createCommandHandler(
            descriptor,
            actionName,
            moduleSetting,
            DEFAUL_OPTIONS.timeout,
            isModuleExpectedToHandleTimeout
          )
        }
      )
    )
  })

  return moduleCli
}

export function generateCliCommandsForModules(app, registeredModules, config = {}) {
  Object.entries(registeredModules).forEach(async ([module, descriptor]) => {
    const moduleSetting = config[module] || {}
    await generateCliCommandsForModule(app, module, descriptor, moduleSetting)
  })
  return app
}

async function generateCliCommandsForModule(app, module, descriptor, moduleSetting) {
  var moduleCli = Cli.createCategory(module, descriptor.description || "TBD")

  moduleCli = await attachSubCommandsForModule(moduleCli, descriptor, moduleSetting)
  app.command(moduleCli)
  return app
}
