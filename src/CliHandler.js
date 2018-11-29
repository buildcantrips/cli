import { Logger, ParameterProvider } from "@cantrips/core"
import ModuleRegistry from "./ModuleRegistry"

export function attachMiscCliCommands(program) {
  program.command("describeCI").action(() => {
    new ParameterProvider().describeCI()
  })
  program.command("listModules").action(() => {
    ModuleRegistry.listModules()
  })
}

const getRealArgumentNames = optionNames =>
  optionNames.filter(
    optionName =>
      !optionName.startsWith("_") &&
      !["parent", "commands", "options"].includes(optionName)
  )

function generateArgumentString(options) {
  const argumentNames = getRealArgumentNames(Object.keys(options))
  return argumentNames.map(arg => `--${arg} ${options[arg]}`).join(" ")
}

export function generateCliCommandsForModules(program, registeredModules) {
  Object.entries(registeredModules).forEach(([module, descriptor]) => {
    generateCliCommandsForModule(program, module, descriptor)
  })
}

function generateParametersForCommand(descriptor, command) {
  descriptor.parameters.forEach(parameter => {
    command.option(`--${parameter.name} [${parameter.name}]`, parameter.help)
  })
  Object.keys(descriptor.exposed).forEach(action => {
    //temporary backwards compatibility
    if (descriptor.exposed[action].parameters) {
      descriptor.exposed[action].parameters.forEach(parameter => {
        command.option(
          `--${parameter.name}${!parameter.flag ? ` [${parameter.name}]` : ""}`,
          parameter.help
        )
      })
    }
  })
}

function registerActionForCommand(command, descriptor) {
  command.action(async (action, options) => {
    const actor = await new descriptor["type"](options)

    //temporary backward compatibility
    let validActions = Array.isArray(descriptor.exposed)
      ? descriptor.exposed
      : Object.keys(descriptor.exposed)

    if (!validActions.includes(action)) {
      Logger.error(`${action} is not an action of ${descriptor.name}`)
      process.exit(-1)
    }

    Logger.debug(
      `Running command ${
        descriptor.name
      } ${action} with options: ${generateArgumentString(options)}`
    )
    actor[action](options)
  })
}

function generateCliCommandsForModule(program, module, descriptor) {
  let command = program.command(`${module} <action>`)
  generateParametersForCommand(descriptor, command)
  registerActionForCommand(command, descriptor)
}
