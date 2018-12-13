/* eslint-env mocha */

import ModuleRegistry from "./ModuleRegistry"
import { Module } from "./Module"

import { expect } from "chai"

describe("ModuleRegistry", () => {
  describe("isModuleCached", () => {
    it("returns false if the module is not cached", async () => {
      expect(
        ModuleRegistry.isModuleCached(new Module("testModule", "1.0.0"))
      ).to.equal(false)
    })
  })
})
