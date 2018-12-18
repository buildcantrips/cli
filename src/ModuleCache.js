import { Logger } from "@cantrips/core"
import fs from "fs-extra"
import path from "path"

// Assumes the modules save themselves to modulesFolderPath
export class ModuleCache {
  _cachedModules = []

  constructor(modulesFolderPath) {
    this.modulesFolderPath = modulesFolderPath
    this.modulesDescriptorPath = path.join(this.modulesFolderPath, "modules.json")
    this._initializeCache()
  }

  isModuleCached(module) {
    return this._cachedModules.some(
      cachedModule =>
        cachedModule.name === module.name &&
        cachedModule.type === module.type &&
        cachedModule.version === module.version &&
        cachedModule.path === module.path
    )
  }

  cacheModule(module) {
    this._cachedModules.push(module)
    this._saveModuleCacheDescriptor()
    Logger.debug(`Cached module: ${module.name}`)
  }

  _initializeCache() {
    fs.ensureDirSync(this.modulesFolderPath)
    if (!fs.existsSync(this.modulesDescriptorPath)) {
      fs.writeFileSync(this.modulesDescriptorPath, JSON.stringify({ modules: [] }, null, 2))
    }
    this.cachedModulesDescriptor = JSON.parse(fs.readFileSync(this.modulesDescriptorPath))
    this._cachedModules = this.cachedModulesDescriptor.modules
    Logger.debug(`ModuleCache initialized on path: ${this.modulesFolderPath}`)
  }

  _saveModuleCacheDescriptor() {
    fs.writeFileSync(this.modulesDescriptorPath, JSON.stringify({ modules: this._cachedModules }, null, 2))
  }
}
