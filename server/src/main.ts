import * as process from "process";

import { getPluginDir, getResourcesDir, isCoreDataFile } from "./plugin";
import { runServer } from "./server";
import {
  getExecutable,
  parseCoreDataWithSubprocess,
  parsePluginWithSubprocess,
} from "./subprocess";

const main = async () => {
  if (process.argv[2] === "load-errors") {
    const path = process.argv[3];

    const isCore = isCoreDataFile(path);
    if (isCore) {
      console.log("parsing data files as though they are core files");
    } else {
      console.log("parsing data files as though they are a plugin");
    }

    const sendErrorNot = (msg: string) => {
      throw new Error(msg)
    };

    const executable = getExecutable(sendErrorNot);
    if (!executable) {
      throw new Error('crashing because not executable location found');
      // TODO propagate this to the client
    }

    if (isCore) {
      const coreDir = getResourcesDir(path)!;
      return JSON.stringify(await parseCoreDataWithSubprocess(coreDir, executable));
    } else {
      const pluginDir = getPluginDir(path)!;
      return JSON.stringify(await parsePluginWithSubprocess(pluginDir, executable));
    }
  } else {
    runServer();
  }
};

main();
