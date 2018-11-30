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

class ModuleFactory {
  create(moduleName, version) {
    if (version.startsWith("file:")) {
      return new LocalModule(moduleName, version)
    } else if (version.startsWith("git@")) {
      return new GitModule(moduleName, version)
    } else {
      return new NpmModule(moduleName, version)
    }
  }
}

class Module {
  constructor(moduleName, version) {
    this.name = moduleName
    this.version = version
  }

  async _loadModule(delegate) {
    return new Promise(async resolve => {
      Logger.debug(`Loading module: ${this.name} from ${this.type}`)
      resolve(await delegate())
      Logger.debug(`Loading module: ${this.name} - Success`)
    })
  }

  async _loadModuleFromCache(modulesFolderPath, delegate) {
    Logger.debug(`Loading module from cache: ${this.name} - ${this.version}`)

    const moduleFullPath = path.join(modulesFolderPath, this.path)
    if (delegate) {
      await delegate()
    }

    return require(moduleFullPath)
  }

  async loadModuleFromCache(modulesFolderPath) {
    return this._loadModuleFromCache(modulesFolderPath)
  }
}

class GitModule extends Module {
  constructor(moduleName, version) {
    super(moduleName, version)
    this.type = ModuleTypes.Git

    var [repository, rawVersion] = this.version.split("#")
    repository = repository.replace(/^git@/, "").replace(/.git$/, "")
    this.path = path.join(this.name, repository, rawVersion || "master")
  }

  async loadModule(modulesFolderPath) {
    return this._loadModule(async () => {
      const moduleDirectory = path.join(modulesFolderPath, this.path)
      fs.emptyDirSync(moduleDirectory)

      await ProcessUtils.runCommand(
        `cd ${moduleDirectory} && git clone ${this.version} .`,
        `Cloning repository: ${this.version}`,
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
    })
  }
}

class NpmModule extends Module {
  constructor(moduleName, version) {
    super(moduleName, version)
    this.type = ModuleTypes.Npm
    this.path = path.join(this.name, this.version)
  }

  async loadModule(modulesFolderPath) {
    return this._loadModule(async () => {
      const tempDir = tmp.dirSync({ unsafeCleanup: true })
      const moduleDirectory = path.join(modulesFolderPath, this.path)
      fs.emptyDirSync(moduleDirectory)

      await ProcessUtils.runCommand(
        `cd ${tempDir.name} && npm init --force`,
        "",
        {
          silent: true
        }
      )
      await ProcessUtils.runCommand(
        `cd ${tempDir.name} && npm install ${this.name}@${this.version}`,
        `Installing module ${this.name}@${this.version}`,
        { silent: true }
      )

      fs.copySync(
        path.join(tempDir.name, "node_modules", this.name),
        moduleDirectory
      )
      await ProcessUtils.runCommand(
        `cd ${moduleDirectory} && npm install`,
        `Installing dependencies for ${this.name}@${this.version}`,
        { silent: true }
      )

      return require(`${moduleDirectory}`)
    })
  }
}

class LocalModule extends Module {
  constructor(moduleName, version) {
    super(moduleName, version)
    this.type = ModuleTypes.Local
    this.path = "local"
  }

  async loadModule() {
    return this._loadModule(() => {
      const rawPath = `${this.version.replace("file:", "")}`
      return require(`${process.cwd()}/${rawPath}`)
    })
  }

  async loadModuleFromCache(modulesFolderPath) {
    return this._loadModuleFromCache(modulesFolderPath, async () => {
      const moduleFullPath = path.join(modulesFolderPath, this.path)
      var result = await ProcessUtils.runCommand(
        `cd ${moduleFullPath} && git fetch && git diff @{upstream} | cat`
      )

      if (result) {
        Logger.debug(
          `Pulling new version for module ${this.name} from ${this.version}`
        )
        await ProcessUtils.runCommand(`cd ${moduleFullPath} && git pull`)
      }
    })
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
    this.moduleFactory = new ModuleFactory()
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
  isValidRequiredModule = module =>
    module && "meta" in module && "exposed" in module;

  isValidRequiredModuleGroup = moduleGroup =>
    moduleGroup && "moduleGroup" in moduleGroup;

  listModules() {
    Logger.info("\n" + Object.keys(this.registeredModules).join("\n"))
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
        cachedModule.version === module.version &&
        cachedModule.path === module.path
    )
  }

  async registerModule(moduleName, version) {
    const module = this.moduleFactory.create(moduleName, version)
    if (this.isModuleCached(module)) {
      this.registerRequiredModule(
        await module.loadModuleFromCache(this.modulesFolderPath)
      )
    } else {
      this.registerRequiredModule(
        await module.loadModule(this.modulesFolderPath)
      )
      if (module.type !== ModuleTypes.Local) {
        this.cacheModule(module)
      }
    }
  }

  registerRequiredModule(requiredModule) {
    Object.keys(requiredModule).forEach(subModule => {
      if (this.isValidRequiredModule(requiredModule[subModule])) {
        let { meta, exposed } = requiredModule[subModule]
        this.registeredModules[meta.name] = {
          ...meta,
          name: subModule,
          exposed
        }
      } else if (this.isValidRequiredModuleGroup(requiredModule[subModule])) {
        delete requiredModule[subModule].moduleGroup
        this.registerRequiredModule(requiredModule[subModule])
      } else {
        Logger.warn(
          `${subModule} is not a valid cantrips module or module group.`
        )
      }
    })
  }
}

module.exports = new ModuleRegistry()
