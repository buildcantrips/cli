import { Logger, ProcessUtils } from "@cantrips/core"
import tmp from "tmp"
import path from "path"

export const REGISTERED_MODULES = []

export const getRegisteredModules = () => REGISTERED_MODULES

const isValidModule = module =>
  module && "meta" in module && "exposed" in module

const isValidModuleGroup = moduleGroup =>
  moduleGroup && "moduleGroup" in moduleGroup

export function listModules() {
  Logger.info("\n" + Object.keys(REGISTERED_MODULES).join("\n"))
}

export function registerModule(module) {
  Object.keys(module).forEach(subModule => {
    if (isValidModule(module[subModule])) {
      let { meta, exposed } = module[subModule]
      REGISTERED_MODULES[meta.name] = { ...meta, name: subModule, exposed }
    } else if (isValidModuleGroup(module[subModule])) {
      delete module[subModule].moduleGroup
      registerModule(module[subModule])
    } else {
      Logger.warn(`${subModule} is not a valid module or module group.`)
    }
  })
}

async function requireModuleFromLocalPath(module) {
  Logger.debug(`Loading package from local path: ${module}`)
  return require(`${process.cwd()}/${module.replace("file:", "")}`)
}

function getModuleNameFromGitUrl(gitUrl) {
  if (!gitUrl || !gitUrl.startsWith("git@") || !gitUrl.endsWith(".git")) {
    throw new Error(
      `Invlid git url for module in configuration file: ${gitUrl}`
    )
  }
  return gitUrl
    .split("/")
    .slice(-1)[0]
    .replace(".git", "")
}

async function requireModuleFromGit(gitUrl) {
  Logger.debug(`Loading module from git: ${gitUrl}`)
  const tempDir = tmp.dirSync({ unsafeCleanup: true })

  await ProcessUtils.runCommand(
    `cd ${tempDir.name} && git clone ${gitUrl}`,
    `Cloning repository: ${gitUrl}`,
    {
      silent: true
    }
  )
  let moduleName = getModuleNameFromGitUrl(gitUrl)
  let modulePath = path.join(tempDir.name, moduleName)
  await ProcessUtils.runCommand(
    `cd ${modulePath} && npm i`,
    "Installing dependencies",
    {
      silent: true
    }
  )
  await ProcessUtils.runCommand(
    `cd ${modulePath} && npm run babel:build`,
    "Runing babel build",
    {
      silent: true
    }
  )
  return require(`${modulePath}`)
}

async function requireModuleFromNpm(module) {
  Logger.debug(`Loading module from npm: ${module}`)
  const tempDir = tmp.dirSync({ unsafeCleanup: true })
  await ProcessUtils.runCommand(`cd ${tempDir.name} && npm init --force`, "", {
    silent: true
  })
  await ProcessUtils.runCommand(
    `npm install --prefix ${tempDir.name} ${module}`,
    `Installing module ${module}`,
    { silent: true }
  )
  return require(`${tempDir.name}/node_modules/${module}`)
}

export async function loadModule(module) {
  return new Promise(async resolve => {
    Logger.debug(`Loading module: ${module}`)
    if (module.startsWith("file:")) {
      resolve(await requireModuleFromLocalPath())
    } else if (module.startsWith("git@")) {
      resolve(await requireModuleFromGit(module))
    } else {
      resolve(await requireModuleFromNpm(module))
    }
    Logger.debug(`Loading module: ${module} - Success`)
  })
}
