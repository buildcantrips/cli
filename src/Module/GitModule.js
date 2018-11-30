import path from "path"
import fs from "fs-extra"

import Module from "./Module"
import ModuleTypes from "./ModuleTypes"

import { ProcessUtils } from "@cantrips/core"

export default class GitModule extends Module {
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
