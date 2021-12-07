import { ChildProcess, exec, execFile, spawn } from "child_process";
import { homedir, tmpdir } from "os";
import { platform, env, off } from "process";
import {
  readdirSync,
  existsSync,
  mkdirSync,
  rmdirSync,
  mkdtempSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import * as path from "path";
import * as util from "util";
const execFileP = util.promisify(execFile);

function getEslauncher2Executables(
  instancesPath: string,
  executablePath: string
): string[] {
  const executables = [];
  const instances = [];
  try {
    instances.push(...readdirSync(instancesPath));
  } catch (e) {
    // assume it was ENOENT: no such file or dir
  }
  executables.push(
    ...instances.map((inst) => {
      return path.join(instancesPath, inst, executablePath);
    })
  );
  return executables;
}

// Return the executable to use for linting.
export function getExecutable(sendErrorNot: (msg: string) => void, preferencesExecutable?: string | undefined): string | undefined {
  if (env.CI) {
    let hardcoded;
    // Use hardcoded paths in CI
    if (platform === "linux") {
      hardcoded = 'es/endless-sky';
    } else if (platform === 'darwin') {
      hardcoded = 'Endless Sky.app/Contents/MacOS/Endless Sky';
    } else if (platform === 'win32') {
      hardcoded = 'es/EndlessSky.exe';
    } else {
      throw new Error('unsupported platform');
    }
    if (!existsSync(hardcoded)) {
      throw new Error("bad CI environment, provide Endless Sky executable");
    }
    return hardcoded;
  }

  // If a path is specified in preferences, use it and only it!
  if (preferencesExecutable) {
    if (existsSync(preferencesExecutable)) {
      return preferencesExecutable;
    }
    const unescapedPreferencesExecutable = preferencesExecutable.replace(/\\ /g, ' ');
    if (existsSync(unescapedPreferencesExecutable)) {
      return unescapedPreferencesExecutable;
    }
    sendErrorNot("Endless Sky executable path from preferences does not exist. Please check the path in preferences.")
    return undefined;
  }

  const candidates = [];
  // TODO add steam locations for all platforms

  if (platform === "darwin") {
    candidates.push("/Applications/Endless Sky.app/Contents/MacOS/Endless Sky");
    const eslauncher2 = path.join(
      homedir(),
      "Library/Application Support/ESLauncher2/instances/"
    );
    const instanceExecutablePath = "Endless Sky.app/Contents/MacOS/Endless Sky";
    candidates.push(
      ...getEslauncher2Executables(eslauncher2, instanceExecutablePath)
    );
  }
  if (platform === "win32") {
    // TODO add normal install location
    const eslauncher2 = path.join(
      homedir(),
      "LocalAppData\\Roaming\\ESLauncher2\\instances"
    );
    candidates.push(
      ...getEslauncher2Executables(eslauncher2, "EndlessSky.exe")
    );
  }
  // TODO add Linux locations
  const executable = candidates.filter((p) => existsSync(p))[0];
  if (!executable) {
    sendErrorNot!(
      "No executable found! Please set the endlesssky executable location in settings."
    );
  }
  return executable;
}

type PreparedFilesystemOptions = {
  resources: string | undefined; // prepare a resources directory
  // TODO  config: string|undefined, // prepare a temp config directory
  pluginDir: string | undefined; // link in a plugin
  // TODO  pluginFile: string|undefined, // link in a plugin
};

type PreparedFilesystem = {
  config: string;
  resources: string;
  tmpPlugin: string | undefined;
};

export const TEMP_PLUGIN_NAME = "zzzTemp";

export async function withPreparedFilesystem<T>(
  options: Partial<PreparedFilesystemOptions>,
  cb: (filesystem: PreparedFilesystem) => Promise<T>
): Promise<T> {
  const configDir = mkdtempSync(path.join(tmpdir(), "es-config-"));
  mkdirSync(path.join(configDir, "saves"));
  mkdirSync(path.join(configDir, "plugins"));

  let tmpPlugin: string | undefined;
  let tmpResources: string | undefined;
  if (options.pluginDir) {
    // symlink it in!
    if (!existsSync(options.pluginDir)) {
      throw new Error("bad pluginDir path: " + options.pluginDir);
    }
    tmpPlugin = path.join(configDir, "plugins", TEMP_PLUGIN_NAME);
    symlinkSync(path.resolve(options.pluginDir), tmpPlugin);
  }
  if (!options.resources) {
    // if no resources, create blank one!
    tmpResources = mkdtempSync(path.join(tmpdir(), "es-resources-"));
    mkdirSync(path.join(tmpResources, "data"));
    mkdirSync(path.join(tmpResources, "sounds"));
    mkdirSync(path.join(tmpResources, "images"));
    writeFileSync(
      path.join(tmpResources, "credits.txt"),
      "mostly MZ but lots of help\n"
    );
  }

  try {
    return await cb({
      config: configDir,
      tmpPlugin,
      resources: tmpResources || options.resources!,
    });
  } finally {
    if (options.pluginDir) {
      unlinkSync(path.join(configDir, "plugins", TEMP_PLUGIN_NAME));
    }
    rmdirSync(configDir, { recursive: true });
    if (tmpResources) {
      rmdirSync(tmpResources, { recursive: true });
    }
  }
}

export const parseCoreDataWithSubprocess = async (
  resourceDir: string,
  executable: string,
) => {
  const output = await withPreparedFilesystem(
    { resources: resourceDir },
    async ({ config, resources }) => {
      console.log('resources:', resources);
      const { stderr } = await execFileP(executable, [
        "-s",
        "--config",
        config,
        "--resources",
        resources,
      ]);
      console.log('stderr:', util.inspect(stderr))
      return stderr;
    }
  );
  return parseErrors(output);
};

export const parsePluginWithSubprocess = async (
  pluginDir: string,
  executable: string,
) => {
  let tmpPath: string | undefined;

  if (!existsSync(executable)) {
    throw new Error("bad executable: "+executable);
  }

  const output = await withPreparedFilesystem(
    { pluginDir },
    async ({ config, resources, tmpPlugin }) => {
      tmpPath = tmpPlugin;
      const { stderr } = await execFileP(executable, [
        "-s",
        "--config",
        config,
        "--resources",
        resources,
      ]);
      //console.log('stderr from Endless Sky:', util.inspect(stderr));
      return stderr;
    }
  );

  return parseErrors(output, (p) =>
    path.join(pluginDir, path.relative(tmpPath!, p))
  );
};

let lastConversationProcess: ChildProcess | undefined;

export async function runConversationWithSubprocess(
  text: string,
  executable: string,
  resourceDir: string,
) {
  await withPreparedFilesystem({
    resources: resourceDir
  }, async ({ config, resources }) => {
    return new Promise<void>((resolve) => {
      if (lastConversationProcess && lastConversationProcess.exitCode === null) {
        lastConversationProcess.kill();
      }
      const p = spawn(executable, [
        "--config",
        config, // this should not matter at all
        "--resources",
        resources,
        "--talk",
      ]);
      lastConversationProcess = p;

      /*
      p.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
      });
      p.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
      })
      */
      p.stdin.write(text);
      p.stdin.end();
      p.on('close', (code: number) => {
        resolve()
      })
    });
  });
};


// DataNode::PrintTrace() always writes a blank line at the beginning
// essages can't begin with ( because shipEntityErrors have that (and might not have a blank line)
export const dataNodeError = /(?<=\n\n)(?<msg>.*)\nfile (?<quote>"?)(?<file>.*)\k<quote>(\nL(?<lineno>[0-9]+):(?<line>.*))+(?=\n)/g;

// Files::LogError always adds a newline, so sensible messages ending in \n
// produce a blank line after
export const shipEntityError = /(?<=\n)(?<entity>[(][^()]+(?<variant>[(][^()]*[)])?[)]):\n(?<msg>.*)\nhas outfits:(?<outfit>\n\t.*)*(?=\n\n)/g;

// Argosy: outfit "Me..." is equipped but not included
// these don't have blank lines on either side
export const shipMissingEquippedOutfit = /(?<=\n)(?<entity>.*?): (?<msg>outfit "(?<outfit>.*?)".*[.])(?=\n)/g;



// exported for testing
export const parseErrors = (
  output: string,
  fileResolver?: (path: string) => string
): { file?: string; lineno?: number; message: string, fullMessage: string, pat: string }[] => {
  //console.log('full es stderr output:')
  //console.log(output);
  const r = (p: string) => {

    // Endless Sky swaps \ for / so need to swap back
    if (path.sep === '\\') {
      p = p.replace(/\//g, '\\');
    }
    if (!fileResolver) return p;
    return fileResolver(p);
  }
  // Windows line endings!
  let s = output.replace(/\r\n/g, '\n');
  // add a \n at the beginning to avoid missing first message
  s = '\n' + s;

  const errors = [];

  for (const m of s.matchAll(dataNodeError)) {
    errors.push({
      file: r(m.groups!.file!),
      lineno: parseInt(m.groups!.lineno!, 10), // the last lineno captured
      message: m.groups?.msg!,
      fullMessage: m[0],
      pat: 'dataNodeError'
    });
  }

  for (const m of s.matchAll(shipEntityError)) {
    errors.push({
      entity: r(m.groups!.entity!),
      file: undefined,
      lineno: undefined,
      message: m.groups!.msg,
      fullMessage: m[0],
      pat: 'shipEntityError'
    });
  }

  for (const m of s.matchAll(shipMissingEquippedOutfit)) {
    errors.push({
      entity: r(m.groups!.entity!),
      file: undefined,
      lineno: undefined,
      message: m.groups!.msg,
      fullMessage: m[0],
      pat: 'shipMissingOutfitEquipped'
    });
  }

  return errors;
};
