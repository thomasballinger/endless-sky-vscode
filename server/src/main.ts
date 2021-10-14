import * as process from "process";

import * as languageserver from "vscode-languageserver";
import { getPluginDir, getResourcesDir, isCoreDataFile } from "./plugin";
import { runServer } from "./server";
import {
  parseCoreDataWithSubprocess,
  parsePluginWithSubprocess,
} from "./subprocess";

const main = async () => {
  if (process.argv[2] === "load-errors") {
    const path = process.argv[3];

    const isCore = isCoreDataFile(path);
    if (isCore) {
      console.error("parsing data files as though they are core files");
    } else {
      console.error("parsing data files as though they are a plugin");
    }
    if (isCore) {
      process.stdout.write(JSON.stringify(
        await parseCoreDataWithSubprocess(getResourcesDir(path)!)
      ));
    } else {
      const pluginDir = getPluginDir(path)!;
      process.stdout.write(JSON.stringify(await parsePluginWithSubprocess(pluginDir)));
    }
  } else {
    runServer();
  }
};

main();
