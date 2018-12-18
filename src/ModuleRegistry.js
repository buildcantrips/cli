import { Logger } from "@cantrips/core"
import fs from "fs-extra"
import os from "os"
import path from "path"

import { ModuleFactory } from "./ModuleFactory"
import { ModuleTypes } from "./Module"
import { ModuleCache } from "./ModuleCache"

const DEFAULT_CANTRIPS_FOLDER_PATH = path.join(os.homedir(), ".cantrips")

class ModuleRegistry {
  constructor(modulesPath = DEFAULT_CANTRIPS_FOLDER_PATH) {
    this.cantripsFolderPath = modulesPath
    this.registeredModules = []
    this.modulesFolderPath = path.join(this.cantripsFolderPath, "modules")
    this.moduleFactory = new ModuleFactory()
    this.initializeRegistry()
  }

  initializeRegistry() {
    fs.ensureDirSync(this.cantripsFolderPath)
    fs.ensureDirSync(this.modulesFolderPath)
    this.cache = new ModuleCache(this.modulesFolderPath)
  }

  getRegisteredModules = () => this.registeredModules
  isValidRequiredModule = module => module && "meta" in module && "exposed" in module

  isValidRequiredModuleGroup = moduleGroup => moduleGroup && "moduleGroup" in moduleGroup

  listModules() {
    Logger.info("\n" + Object.keys(this.registeredModules).join("\n"))
  }

  async registerModule(moduleName, version) {
    const module = this.moduleFactory.create(moduleName, version)
    if (this.cache.isModuleCached(module)) {
      this.registerRequiredModule(await module.loadModuleFromCache(this.modulesFolderPath))
    } else {
      this.registerRequiredModule(await module.loadModule(this.modulesFolderPath))
      if (module.type !== ModuleTypes.Local) {
        this.cache.cacheModule(module)
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
        Logger.warn(`${subModule} is not a valid cantrips module or module group.`)
      }
    })
  }
}

module.exports = new ModuleRegistry()
