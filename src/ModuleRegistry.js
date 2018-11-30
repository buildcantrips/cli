import { Logger } from "@cantrips/core"
import fs from "fs-extra"
import os from "os"
import path from "path"

import { ModuleFactory } from "./ModuleFactory"
import { ModuleTypes } from "./Module"

const DEFAULT_CANTRIPS_FOLDER_PATH = path.join(os.homedir(), ".cantrips")

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
