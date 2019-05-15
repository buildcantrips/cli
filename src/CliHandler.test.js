import chai, { expect } from "chai"
const chaiAsPromised = require("chai-as-promised")

chai.use(chaiAsPromised)

import * as Cli from "nested-yargs"
import { generateCliCommandsForModules, createCommandHandler } from "./CliHandler"

const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

const validModuleName = "test-module"
const validCommandName = "test-command"

const testModules = {
  [validModuleName]: {
    description: "This is a test module",
    parameters: [
      {
        name: "testGlobalParam",
        description: "A parameter for the module"
      }
    ],
    exposed: {
      [validCommandName]: {
        description: "This is a command of test-commmand",
        parameters: [
          {
            name: "testParam",
            description: "A parameter for the command"
          }
        ]
      }
    }
  }
}

const minimalTestModules = {
  [validModuleName]: {
    exposed: {
      [validCommandName]: {}
    }
  }
}

const createTestCommandHandler = ({ commandAction, timeout, descriptor, isModuleExpectedToHandleTimeout }) => {
  class Test {
    async [validCommandName]() {
      return commandAction()
    }
  }
  const testDescriptor = {
    type: Test,
    ...descriptor
  }
  return createCommandHandler(testDescriptor, validCommandName, {}, timeout, isModuleExpectedToHandleTimeout)
}

describe("CliHandler", () => {
  describe("attachSubCommandsForModule", () => {
    describe("dynamically generates cli", () => {
      var app, minimalApp
      beforeEach(async () => {
        app = Cli.createApp()
        await generateCliCommandsForModules(app, testModules, {})
        minimalApp = Cli.createApp()
        await generateCliCommandsForModules(minimalApp, minimalTestModules, {})
      })
      describe("module", () => {
        it("should add module", () => {
          expect(app.commands).to.have.own.property(validModuleName)
        })
        it("should add module description", () => {
          expect(app.commands[validModuleName].description).to.equal(testModules[validModuleName].description)
        })
        it("should default module description if not provided", () => {
          expect(minimalApp.commands[validModuleName].description).to.equal("TBD")
        })
      })
      describe("command", () => {
        it("should add command of module", () => {
          expect(app.commands[validModuleName].commands[validCommandName].name).to.equal(validCommandName)
        })
        it("should add description to command", () => {
          const validCommand = app.commands[validModuleName].commands[validCommandName]
          expect(app.commands[validModuleName].commands[validCommandName].description).to.equal(
            validCommand.description
          )
        })
        it("should add default description to command if not provided", () => {
          expect(minimalApp.commands[validModuleName].commands[validCommandName].description).to.equal("TBD")
        })
        it("should add module parameter to command", () => {
          expect(app.commands[validModuleName].commands[validCommandName].options.options).to.have.own.property(
            testModules[validModuleName].parameters[0].name
          )
        })
        it("should add parameter to command", () => {
          expect(app.commands[validModuleName].commands[validCommandName].options.options).to.have.own.property(
            testModules[validModuleName].exposed[validCommandName].parameters[0].name
          )
        })
        it("should register command with no module parameters, and attach default cli paramters", () => {
          expect(minimalApp.commands[validModuleName].commands[validCommandName].options.options).to.have.keys([
            "timeout"
          ])
        })
        it("should add description to command parameter", () => {
          const testParam = testModules[validModuleName].exposed[validCommandName].parameters[0]
          expect(
            app.commands[validModuleName].commands[validCommandName].options.options[testParam.name].description
          ).to.equal(testParam.description)
        })
      })
    })
  })
})
