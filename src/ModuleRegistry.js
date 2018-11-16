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

function generateArgumentString(options) {
  const argumentNames = Object.keys(options).filter(option => !option.startsWith('_') && !['parent', 'commands', 'options'].includes(option))
  return argumentNames.map(arg => `--${arg} ${options[arg]}`).join(' ')
}

export function generateCliCommands(program) {
  Object.entries(REGISTERED_MODULES).forEach(([module, descriptor]) => {
    let command = program.command(`${module} <action>`);
    descriptor.parameters.forEach(parameter => {
      command.option(`--${parameter.name} [${parameter.name}]`, parameter.help);
    });
    Object.keys(descriptor.exposed).forEach(action => {
      //temporary backwards compatibility
      if (descriptor.exposed[action].parameters) {
        descriptor.exposed[action].parameters.forEach(parameter => {
          command.option(`--${parameter.name}${!parameter.flag ? ` [${parameter.name}]` : ''}`, parameter.help);
        })
      }
    })
    command.action(async (action, options) => {
      const actor = await new descriptor["type"](options);
      if (!command) {
        Logger.error(`Invalid command!`);
        process.exit(-1);
      }
      //temporary backward compatibility
      if (Array.isArray(descriptor.exposed)) {
        if (!descriptor.exposed.includes(action)) {
          Logger.error(`${action} is not an action of ${descriptor.name}`);
          process.exit(-1);
        }
      } else {
        if (!(action in descriptor.exposed)) {
          Logger.error(`${action} is not an action of ${descriptor.name}`);
          process.exit(-1);
        }
      }

      Logger.debug(
        `Running command ${descriptor.name} ${action} with options: ${generateArgumentString(options)}`
      );
      actor[action](options);
    });
  });
}

export async function loadModule(module) {
  const tempDir = tmp.dirSync({ unsafeCleanup: true });
  return new Promise(async resolve => {
    Logger.debug(`Loading module: ${module}`)
    if (module.startsWith("file:")) {
      resolve(await require(`${process.cwd()}/${module.replace("file:", "")}`));
    } else if (module.startsWith("git@")) {
      await Utils.runCommand(`cd ${tempDir.name} && git clone ${module}`, "", { silent:true })
      let moduleName = module.split("/").slice(-1)[0].replace(".git", "", { silent:true })
      await Utils.runCommand(`cd ${tempDir.name}/${moduleName} && npm i`, "", { silent:true })
      await Utils.runCommand(`cd ${tempDir.name}/${moduleName} && npm run babel:build`, "", { silent:true })
      resolve(require(`${tempDir.name}/${moduleName}`));
    } else {
      await Utils.runCommand(`cd ${tempDir.name} && npm init --force`, "", {
        silent: true
      });
      await Utils.runCommand(
        `npm install --prefix ${tempDir.name} ${module}`,
        `Installing module ${module}`
      );
      resolve(require(`${tempDir.name}/node_modules/${module}`));
      Logger.debug(`Loading module: ${module} - Success`)
    }
  });
}
