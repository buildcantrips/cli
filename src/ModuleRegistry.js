import { Logger, Utils } from "@cantrips/core";
import tmp from "tmp";

export const REGISTERED_MODULES = [];

function isValidModule(module) {
  if (!module) return false;
  return "meta" in module && "exposed" in module;
}

function isValidModuleGroup(module) {
  if (!module) return false;
  return "moduleGroup" in module;
}

export function registerModule(module) {
  Object.keys(module).forEach(subModule => {
    if (isValidModule(module[subModule])) {
      let { meta, exposed } = module[subModule];
      REGISTERED_MODULES[meta.name] = { ...meta, name: subModule, exposed };
    } else if (isValidModuleGroup(module[subModule])) {
      delete module[subModule].moduleGroup;
      registerModule(module[subModule]);
    } else {
      Logger.warn(`${subModule} is not a valid module or module group.`);
    }
  });
}

export function generateCliCommands(program) {
  Object.entries(REGISTERED_MODULES).forEach(([module, descriptor]) => {
    let command = program.command(`${module} <args>`);
    descriptor.parameters.forEach(parameter => {
      command.option(`--${parameter.name} [${parameter.name}]`, parameter.help);
    });
    command.action(async (args, options) => {
      const actor = await new descriptor["type"](options);
      for (const action of args.split(" ")) {
        if (!descriptor.exposed.includes(action)) {
          Logger.error(`${action} is not an action of ${descriptor.name}`);
          process.exit(-1);
        }
        actor[action]();
      }
    });
  });
}

export async function loadModule(module) {
  const tempDir = tmp.dirSync({ unsafeCleanup: true });
  return new Promise(async resolve => {
    if (module.startsWith("file:")) {
      resolve(await require(`${process.cwd()}/${module.replace("file:", "")}`));
    } else {
      await Utils.runCommand(`cd ${tempDir.name} && npm init --force`, "", {
        silent: true
      });
      await Utils.runCommand(
        `npm install --prefix ${tempDir} ${module}`,
        `Installing module ${module}`
      );
      resolve(require(`${tempDir}/node_modules/${module.replace("../", "")}`));
    }
  });
}
