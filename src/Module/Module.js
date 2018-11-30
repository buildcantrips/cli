import path from "path"

import { Logger } from "@cantrips/core"

export default class Module {
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
