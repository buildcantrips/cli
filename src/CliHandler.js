import { Logger, ParameterProvider } from "@cantrips/core"
import ModuleRegistry from "./ModuleRegistry"

import packageJson from "../package.json"

import * as Cli from "nested-yargs"

const removeUndefinedProperites = obj =>
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

export const createCommandHandler = (descriptor, actionName, moduleSetting, timeout) => argv =>
  Promise.race([
    new Promise(async resolve => {
      const actor = await new descriptor["type"]({
        ...removeUndefinedProperites(moduleSetting),
        ...removeUndefinedProperites(argv)
      })
      Logger.debug(`Running command ${descriptor.name} ${actionName} with options: ${argv._.slice(2).join(" ")}`)
      resolve(
        await actor[actionName]({ ...removeUndefinedProperites(moduleSetting), ...removeUndefinedProperites(argv) })
      )
    }),
    new Promise((_, reject) =>
      setTimeout(() => {
        reject(`Operations timed out after ${timeout} ms`)
      }, timeout)
    )
  ])

async function attachSubCommandsForModule(moduleCli, descriptor, moduleSetting) {
  //temporary backward compatibility
  let validActions = Array.isArray(descriptor.exposed) ? descriptor.exposed : Object.keys(descriptor.exposed)

  validActions.forEach(actionName => {
    moduleCli.command(
      Cli.createCommand(
        actionName,
        (descriptor.exposed[actionName] && descriptor.exposed[actionName].description) || "TBD",
        {
          options: generateOptionsForCommand(descriptor, actionName),
          handler: createCommandHandler(descriptor, actionName, moduleSetting, 10000)
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
