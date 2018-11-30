import { NpmModule, LocalModule, GitModule } from "./Module"

export class ModuleFactory {
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
