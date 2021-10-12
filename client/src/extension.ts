import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { workspace, ExtensionContext } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverPath = context.asAbsolutePath(
    //path.join("server", "out", "main.js") // the old JS server, still in the repo
    path.join("es-lsp.js") // emscripten-compiled quyykk's LSP server
  );

  console.log('serverPath:', serverPath);
  const homedir = os.homedir();
  const logfile = path.join(homedir, 'es-lsp-log.txt');
  console.log('using logfile: ', logfile);
  const serverOptions: ServerOptions = {
    run: { command: 'node', args: [serverPath, '--log', logfile], transport: TransportKind.stdio },
    debug: { command: 'node', args: [serverPath, '--log', logfile], transport: TransportKind.stdio },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        scheme: "file",
        language: "endlesssky",
        // pattern: "**/data/**", // consider if this gets annoying
      },
    ],
    synchronize: {
      configurationSection: "endlesssky",
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "endlesssky",
    "Endless Sky",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
