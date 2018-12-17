import Module from "./Module"
import ModuleTypes from "./ModuleTypes"

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
}
