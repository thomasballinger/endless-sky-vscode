/*

You're looking at a file path (or 100) and a rootURI.
- Is it a plugin? Is it a core data file? Or is it just a loose .txt?
  - 
- Is the plugin in the current executable's global plugins directory? In the player's config directory?
  - don't worry about config directory for now, we won't allow the user to use other plugin information yet.
- Is the 

Since this linter is filesystem-based for now, always parse the whole plugin directory (even if the rootURI
    is a subdirectory)
*/
import * as path from "path";
import * as fs from "fs";

export const isInDataDir = (filePath: string): boolean => {
  return path.resolve(filePath).split(path.sep).includes("data");
};

const getDataDir = (filePath: string): string | undefined => {
  const parts = path.resolve(filePath).split(path.sep);
  parts[0] = '/' + parts[0]; // there must be a nicer way to do this
  return path.join(...parts.slice(0, parts.lastIndexOf("data") + 1));
};

export const getPluginDir = (filePath: string): string | undefined => {
  if (!isInDataDir(filePath)) return undefined;
  if (isCoreDataFile(filePath)) return undefined;
  const dataDir = getDataDir(filePath);
  if (!dataDir) return undefined;
  return path.dirname(dataDir);
};

export const getResourcesDir = (filePath: string): string | undefined => {
  const dataDir = getDataDir(filePath);
  if (!dataDir) return undefined;
  const core = path.dirname(dataDir);
  if (
    fs.existsSync(path.join(core, "credits.txt")) &&
    (fs.existsSync(path.join(core, "keys.txt")) || // installed
      fs.existsSync(path.join(core, "SConstruct"))) // git checkout
  ) {
    return core;
  }
  return undefined;
};

// Either a git checkout or installed
export const isCoreDataFile = (filePath: string): boolean => {
  return !!getResourcesDir(filePath);
};

// rare case, people rarely put plugins in their resources plugins directory
export const getContainingResourcesDir = (
  filePath: string
): string | undefined => {
  throw new Error("not implemented");
  return "asdf";
};

// doens't matter yet, not going to allow editing of a plugin in the context of other plugins
export const getContainingConfigDir = (path: string): string | undefined => {
  throw new Error("not implemented");
  return "asdf";
};
