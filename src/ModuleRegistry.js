import { Logger, ProcessUtils } from "@cantrips/core"
import tmp from "tmp"
import fs from "fs-extra"
import os from "os"
import path from "path"

const DEFAULT_CANTRIPS_FOLDER_PATH = path.join(os.homedir(), ".cantrips")

const ModuleTypes = Object.freeze({
  Local: "Local",
  Git: "Git",
  Npm: "Npm"
})

// TODO: factory
class Module {
  constructor(moduleName, version) {
    this.type = this.determineModuleType(version)
    this.name = moduleName
    this.version = version
    this.path = this.determineModulePath(version)
  }

  determineModulePath() {
    switch (this.type) {
      case ModuleTypes.Npm:
        return path.join(this.name, this.version)
      case ModuleTypes.Local:
        return path.join("local")
      case ModuleTypes.Git:
        var [repository, rawVersion] = this.version.split("#")
        repository = repository.replace(/^git@/, "").replace(/.git$/, "")
        return path.join(this.name, repository, rawVersion || "master")
    }
  }

  determineModuleType(moduleEntryString) {
    if (moduleEntryString.startsWith("file:")) {
      return ModuleTypes.Local
    } else if (moduleEntryString.startsWith("git@")) {
      return ModuleTypes.Git
    } else {
      return ModuleTypes.Npm
    }
  }
}

class ModuleRegistry {
  constructor(modulesPath = DEFAULT_CANTRIPS_FOLDER_PATH) {
    this.cantripsFolderPath = modulesPath
    this.registeredModules = []
    this.cachedModulesDescriptor = {}
    this.cachedModules = []
    this.modulesFolderPath = path.join(this.cantripsFolderPath, "modules")
    this.modulesDescriptorPath = path.join(
      this.modulesFolderPath,
      "modules.json"
    )
    this.initializeRegistry()

    Logger.debug(`ModuleCache initialized on path: ${this.modulesFolderPath}`)
  }

  initializeRegistry() {
    fs.ensureDirSync(this.cantripsFolderPath)
    fs.ensureDirSync(this.modulesFolderPath)
    if (!fs.existsSync(this.modulesDescriptorPath)) {
      fs.writeFileSync(
        this.modulesDescriptorPath,
        JSON.stringify({ modules: [] }, null, 2)
      )
    }
    this.cachedModulesDescriptor = JSON.parse(
      fs.readFileSync(this.modulesDescriptorPath)
    )
    this.cachedModules = this.cachedModulesDescriptor.modules
  }

  getRegisteredModules = () => this.registeredModules;
  isValidModule = module => module && "meta" in module && "exposed" in module;

  isValidModuleGroup = moduleGroup =>
    moduleGroup && "moduleGroup" in moduleGroup;

  listModules() {
    Logger.info("\n" + Object.keys(this.registeredModules).join("\n"))
  }

  async isModuleUpToDate(module) {
    switch (module.type) {
      case ModuleTypes.Local:
        return false
      case ModuleTypes.Git:
        var result = await ProcessUtils.runCommand(
          `cd ${this.path} && git diff @{upstream} | cat`
        )
        if (result) {
          await ProcessUtils.runCommand(`cd ${this.path} && git pull`)
        }
        break
      case ModuleTypes.Npm:
        return false
    }
  }
  async registerExternalModule(moduleName, version) {
    const module = new Module(moduleName, version)
    if (this.isModuleCached(module)) {
      await this.loadCachedModule(module)
    } else {
      this.registerModule(await this.loadModule(module))
      if (module.type !== ModuleTypes.Local) {
        this.cacheModule(module)
      }
    }
  }

  saveModuleCacheDescriptor() {
    fs.writeFileSync(
      this.modulesDescriptorPath,
      JSON.stringify({ modules: this.cachedModules }, null, 2)
    )
  }

  cacheModule(newModule) {
    this.cachedModules.push(newModule)
    this.saveModuleCacheDescriptor()
    Logger.debug(`Cached module: ${newModule.name}`)
  }

  isModuleCached(module) {
    return this.cachedModules.some(
      cachedModule =>
        cachedModule.name === module.name &&
        cachedModule.type === module.type &&
        cachedModule.version === module.version
    )
  }

  async loadCachedModule(module) {
    Logger.debug(
      `Loading module from cache: ${module.name} - ${module.version}`
    )
    // todo: handle this with separate module types
    const moduleFullPath = path.join(this.modulesFolderPath, module.path)
    if (module.type === ModuleTypes.Git) {
      var result = await ProcessUtils.runCommand(
        `cd ${moduleFullPath} && git fetch && git diff @{upstream} | cat`
      )

      if (result) {
        Logger.debug(
          `Pulling new version for module ${module.name} from ${module.version}`
        )
        await ProcessUtils.runCommand(`cd ${moduleFullPath} && git pull`)
      }
    }

    this.registerModule(require(moduleFullPath))
  }

  async requireModuleFromLocalPath(module) {
    const rawPath = `${module.version.replace("file:", "")}`
    Logger.debug(`Loading package from local path: ${rawPath}`)
    return require(`${process.cwd()}/${rawPath}`)
  }

  async requireModuleFromGit(module) {
    Logger.debug(`Loading module from git: ${module.version}`)
    const moduleDirectory = path.join(this.modulesFolderPath, module.path)
    fs.emptyDirSync(moduleDirectory)

    await ProcessUtils.runCommand(
      `cd ${moduleDirectory} && git clone ${module.version} .`,
      `Cloning repository: ${module.version}`,
      {
        silent: true
      }
    )
    await ProcessUtils.runCommand(
      `cd ${moduleDirectory} && npm i`,
      "Installing dependencies",
      {
        silent: true
      }
    )
    // todo fix babel reference
    await ProcessUtils.runCommand(
      `cd ${moduleDirectory} && node_modules/.bin/babel src -d lib`,
      "Runing babel build",
      {
        silent: true
      }
    )
    return require(`${moduleDirectory}`)
  }

  async requireModuleFromNpm(module) {
    Logger.debug(`Loading module from npm: ${module.name}`)
    const tempDir = tmp.dirSync({ unsafeCleanup: true })
    const moduleDirectory = path.join(this.modulesFolderPath, module.path)
    fs.emptyDirSync(moduleDirectory)

    await ProcessUtils.runCommand(
      `cd ${tempDir.name} && npm init --force`,
      "",
      {
        silent: true
      }
    )
    await ProcessUtils.runCommand(
      `cd ${tempDir.name} && npm install ${module.name}@${module.version}`,
      `Installing module ${module.name}@${module.version}`,
      { silent: true }
    )

    fs.copySync(
      path.join(tempDir.name, "node_modules", module.name),
      moduleDirectory
    )
    await ProcessUtils.runCommand(
      `cd ${moduleDirectory} && npm install`,
      `Installing dependencies for ${module.name}@${module.version}`,
      { silent: true }
    )

    return require(`${moduleDirectory}`)
  }

  loadModuleFromCache(module) {
    return require(path.join(this.modulesFolderPath, module.path))
  }

  async loadModule(module) {
    return new Promise(async resolve => {
      Logger.debug(`Loading module: ${module.name} from ${module.type}`)
      switch (module.type) {
        case ModuleTypes.Local:
          resolve(await this.requireModuleFromLocalPath(module))
          break;
        case ModuleTypes.Git:
          resolve(await this.requireModuleFromGit(module))
          break;
        case ModuleTypes.Npm:
          resolve(await this.requireModuleFromNpm(module))
          break;
      }

      Logger.debug(`Loading module: ${module.name} - Success`)
    })
  }

  registerModule(module) {
    Object.keys(module).forEach(subModule => {
      if (this.isValidModule(module[subModule])) {
        let { meta, exposed } = module[subModule]
        this.registeredModules[meta.name] = {
          ...meta,
          name: subModule,
          exposed
        }
      } else if (this.isValidModuleGroup(module[subModule])) {
        delete module[subModule].moduleGroup
        this.registerModule(module[subModule])
      } else {
        Logger.warn(`${subModule} is not a valid module or module group.`)
      }
    })
  }
}

module.exports = new ModuleRegistry()
