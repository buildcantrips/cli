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

const createTestCommandHandler = ({ commandAction, timeout }) => {
  class Test {
    async [validCommandName]() {
      return commandAction()
    }
  }
  const descriptor = {
    type: Test
  }
  const commandHandler = createCommandHandler(descriptor, validCommandName, {}, timeout)
  return () => commandHandler({ _: [] })
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
        it("should register command with no parameters", () => {
          expect(minimalApp.commands[validModuleName].commands[validCommandName].options.options).to.be.empty
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
  describe("createCommandHandler", () => {
    describe("timeout", () => {
      it("rejects with timeout error if action takes more time than the timeout", () => {
        const commandHandler = createTestCommandHandler({
          commandAction: () => sleep(30),
          timeout: 10
        })
        return expect(commandHandler()).to.be.rejectedWith(/timed out/)
      })
      it("resolves with the command resolve value if the command takes less time than the timeout", () => {
        const testCommandResolveValue = "test-resolve-value"
        const commandHandler = createTestCommandHandler({
          commandAction: async () => {
            await sleep(10)
            return testCommandResolveValue
          },
          timeout: 30
        })
        return expect(commandHandler()).to.eventually.equal(testCommandResolveValue)
      })
    })
  })
})
