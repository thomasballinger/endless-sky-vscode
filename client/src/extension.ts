import * as path from "path";
import { workspace, ExtensionContext, commands, window, Range } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "main.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
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

  commands.registerCommand('endlesssky.talk', async () => {
    const editor = window.activeTextEditor;

    let document = editor.document;
    let curPos = editor.selection.active;
    let offset = document.offsetAt(curPos);

    const selection = editor.selection;
    const cursorLineNumber = document.lineAt(selection.start.line).lineNumber
    let i = cursorLineNumber;
    let conversationStartsLine: number|undefined = undefined;
    while (i >= 0) {
      const line = document.lineAt(i);
      if (line.text.match(/^\s*"?conversation/)) {
        conversationStartsLine = i;
        break;
      }
      i--;
    }
    if (conversationStartsLine === undefined) {
      window.showErrorMessage('No conversation starts at or above the cursor');
      return;
    }

    let firstNonConversationLine: number|undefined = undefined;
    const startIndentation = document.lineAt(conversationStartsLine).text.match(/^\s*/)[0]
    // first first non-empty line with less indentation
    i = conversationStartsLine;
    while (++i < document.lineCount - 1) {
      const line = document.lineAt(i);
      if (!line.text.match(/\S/)) continue; // skip whitespace lines
      if (line.text.match(/^\s*#/)) continue; // skip comment lines
      const indent = line.text.match(/^\s*/)[0];
      if (indent.length < startIndentation.length) {
        firstNonConversationLine = i;
        break;
      }
    }
    if (firstNonConversationLine === undefined) {
      firstNonConversationLine = document.lineCount;
    }
    if (cursorLineNumber >= firstNonConversationLine) {
      window.showErrorMessage('No conversation found with cursor inside');
      return;
    }

    const firstLine = editor.document.lineAt(conversationStartsLine)
    const lastLine = editor.document.lineAt(firstNonConversationLine - 1);
    const textRange = new Range(firstLine.range.start, lastLine.range.end);
    const text = document.getText(textRange);
    const indent = firstLine.text.match(/^\s*/)[0];
    const dedented = text.split(/\r?\n/).map(line => line.slice(indent.length)).join('\n') + '\n';
    //console.log('text:', dedented);
    await client.onReady();
    client.sendNotification("custom/runConversation", {text: dedented, textDocumentUri: document.uri.toString()});
});

}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
