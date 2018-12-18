/* eslint-env mocha */

import { ModuleCache } from "./ModuleCache"
import { Module } from "./Module"
import path from "path"
import * as tmp from "tmp"
import fs from "fs-extra"

import { expect } from "chai"

let testModulesPath
let testModulesCleanup

describe("ModuleCache", () => {
  beforeEach(() => {
    const tmpobj = tmp.dirSync({ unsafeCleanup: true })
    testModulesPath = tmpobj.name
    testModulesCleanup = tmpobj.removeCallback
  })
  afterEach(() => {
    testModulesCleanup()
  })
  describe("initialization", () => {
    it("should load module from file descriptor on initialization", () => {
      const testModule = { name: "testModule", version: "1.0.0" }
      const modulesDir = path.join(testModulesPath, "modules")
      fs.ensureDirSync(modulesDir)
      fs.writeFileSync(path.join(modulesDir, "modules.json"), JSON.stringify({ modules: [testModule] }, null, 2))
      const cache = new ModuleCache(testModulesPath)
      const module = new Module(testModule.name, testModule.version)
      expect(cache.isModuleCached(module)).to.equal(true)
    })
  })
  describe("isModuleCached", () => {
    let cache, module
    beforeEach(() => {
      cache = new ModuleCache(testModulesPath)
      module = new Module("testModule", "1.0.0")
    })
    it("returns false if the module is not cached", async () => {
      expect(cache.isModuleCached(module)).to.equal(false)
    })
    it("returns false if an older version of the module is cached", async () => {
      cache.cacheModule(module)
      const newModule = new Module("testModule", "1.1.0")
      expect(cache.isModuleCached(newModule)).to.equal(false)
    })
    it("returns true if the module is cached", async () => {
      cache.cacheModule(module)
      expect(cache.isModuleCached(module)).to.equal(true)
    })
  })
  describe("cacheModule", () => {
    it("saves the cache descriptor to the modules path", async () => {
      const cache = new ModuleCache(testModulesPath)
      const testModule = { name: "testModule", version: "1.0.0" }
      const module = new Module(testModule.name, testModule.version)
      cache.cacheModule(module)
      const descriptorPath = path.join(testModulesPath, "modules", "modules.json")
      expect(fs.existsSync(descriptorPath)).to.equal(true)
      expect(JSON.parse(fs.readFileSync(descriptorPath))).to.deep.equal({ modules: [testModule] })
    })
  })
})
