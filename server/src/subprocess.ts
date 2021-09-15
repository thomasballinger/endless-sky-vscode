import { exec, execFile } from "child_process";
import { homedir, tmpdir } from "os";
import { platform } from "process";
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

export function getExecutable(): string | undefined {
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
  return executable;
}

async function output() {
  const executable = getExecutable();
  if (executable) {
    execFile(executable, ["-s"]);
  }
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
  executable?: string
) => {
  const output = await withPreparedFilesystem(
    { resources: resourceDir },
    async ({ config, resources }) => {
      if (executable && !existsSync(executable)) {
        throw new Error("bad executable set in preferences!");
      }
      executable = executable || getExecutable(); // empty string is falsy
      if (!executable) {
        throw new Error(
          "No executable found! Please set the endlesssky executable location in settings."
        );
        // TODO propagate this to the client
      }
      const { stderr } = await execFileP(executable, [
        "-s",
        "--config",
        config,
        "--resources",
        resources,
      ]);
      return stderr;
    }
  );
  return parseErrors(output);
};

export const parsePluginWithSubprocess = async (
  pluginDir: string,
  executable?: string
) => {
  let tmpPath: string | undefined;

  const output = await withPreparedFilesystem(
    { pluginDir },
    async ({ config, resources, tmpPlugin }) => {
      tmpPath = tmpPlugin;
      executable = executable || getExecutable(); // empty string is falsy
      if (!executable) {
        throw new Error(
          "No executable found! Please set the endlesssky executable location in settings."
        );
        // TODO propagate this to the client
      }
      const { stderr } = await execFileP(executable, [
        "-s",
        "--config",
        config,
        "--resources",
        resources,
      ]);
      return stderr;
    }
  );

  return parseErrors(output, (p) =>
    path.join(pluginDir, path.relative(tmpPath!, p))
  );
};

const parseErrors = (
  output: string,
  fileResolver?: (path: string) => string
): { file: string; linenos: number[]; message: string, fullMessage: string }[] => {
  const traceCandidates = output.split("\n\n");

  const errors = [];
  for (const s of traceCandidates) {
    const m = s.match(/file (?<quote>"?)(?<file>.*)\k<quote>/);
    if (!m || !m.groups) continue;

    const { file } = m.groups;
    const linenos = [...s.matchAll(/L(?<lineno>[0-9]+):(?<line>.*)/g)].map(
      (m) => {
        const l = m?.groups?.lineno;
        if (!l) return -1;
        return parseInt(l, 10);
      }
    );
    const message =
      s.match(/(?<msg>\S[\s\S]*?)\nfile /)?.groups?.msg || "no message";

    const fullMessage = s;

    errors.push({
      file: fileResolver ? fileResolver(file) : file,
      linenos,
      message,
      fullMessage
    });
  }
  return errors;
};
