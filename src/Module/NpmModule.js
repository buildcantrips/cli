import path from "path"
import fs from "fs-extra"
import tmp from "tmp"

import Module from "./Module"
import ModuleTypes from "./ModuleTypes"

import { ProcessUtils } from "@cantrips/core"

export default class NpmModule extends Module {
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
