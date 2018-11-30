import path from "path"

import Module from "./Module"
import ModuleTypes from "./ModuleTypes"

import { ProcessUtils, Logger } from "@cantrips/core"

export default class LocalModule extends Module {
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
