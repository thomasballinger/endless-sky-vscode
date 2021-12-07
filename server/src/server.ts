import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
  MessageType,
} from "vscode-languageserver/node";

import * as fs from "fs";
import * as url from "url";
import { resolve } from "path";

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  getExecutable,
  parseCoreDataWithSubprocess,
  parsePluginWithSubprocess,
  runConversationWithSubprocess,
} from "./subprocess";
import { getPluginDir, getResourcesDir, isCoreDataFile } from "./plugin";
import { exec } from "child_process";

export const runServer = () => {
  const connection = createConnection(ProposedFeatures.all);
  const documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument
  );

  let hasConfigurationCapability = false;
  let hasDiagnosticRelatedInformationCapability = false;
  let lastExecutablePath: string|undefined = undefined;

  function sendErrorNot(message: string){
    connection.sendNotification('window/showMessage', {
      type: MessageType.Error,
      message
    })
  }

  connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!capabilities?.workspace?.configuration;
    hasDiagnosticRelatedInformationCapability = !!capabilities.textDocument
      ?.publishDiagnostics?.relatedInformation;

    const result: InitializeResult = {
      capabilities: {
        /*
    For some reason specifying an object here breaks everything!
    But we still receive save events with TextDocumentSyncKind.Incremental
    so we're not losing anything but some explicitness.
    https://github.com/microsoft/vscode-languageserver-node/issues/813
    textDocumentSync: {
      change: TextDocumentSyncKind.Incremental,
      save: true,
    },
    */
        textDocumentSync: TextDocumentSyncKind.Incremental,
        //Autocompletion is TODO
        /*
    completionProvider: {
      resolveProvider: true,
    },
    */
      },
    };

    return result;
  });

  connection.onInitialized(() => {
    if (hasConfigurationCapability) {
      // Register for all configuration changes.
      connection.client.register(
        DidChangeConfigurationNotification.type,
        undefined
      );
    }
  });

  interface EndlessSkySettings {
    executablePath: string;
  }

  const defaultSettings: EndlessSkySettings = {
    executablePath: "",
  };
  let globalSettings: EndlessSkySettings = defaultSettings;

  // Cache the settings of all open documents
  const documentSettings: Map<string, Thenable<EndlessSkySettings>> = new Map();

  connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
      documentSettings.clear();
    } else {
      globalSettings = <EndlessSkySettings>(
        (change.settings.endlesssky || defaultSettings)
      );
    }
    const {executablePath} = change.settings.endlesssky;

    if (executablePath && executablePath !== lastExecutablePath) {
      lastExecutablePath = executablePath;
      const executableExists = !!getExecutable(sendErrorNot, executablePath);
      if (executableExists) {
        connection.sendNotification('window/showMessage', {
          type: MessageType.Info,
          message: "Endless Sky executable from preferences looks good: '" + executablePath + "'"
        })
      } else {
        return;
      }
    }
      
    // Revalidate all open text documents
    documents.all().forEach(validateFromDisk);
  });

  connection.onNotification("custom/runConversation", async (args: {text: string, textDocumentUri: string}) => {
    // TODO is there a way to get document settings for this custom notification?
    // are there document-scoped notifications?
    const {textDocumentUri, text} = args;
    const executable = getExecutable(sendErrorNot, lastExecutablePath);
    if (!executable) return;
    const path = url.fileURLToPath(textDocumentUri);
    await runConversationWithSubprocess(text, executable, getResourcesDir(path)!);
  })

  documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
  });

  documents.onDidSave(async (e) => {
    validateFromDisk(e.document);
  });

  //emitted when the text document first opened or when its content has changed
  documents.onDidChangeContent((change) => {
    console.log("receive didChangeContent but doing nothing for now");
  });

  documents.onDidOpen((change) => {
    console.log("receved didOpen but doing nothing for now");
  });

  function getDocumentSettings(resource: string): Thenable<EndlessSkySettings> {
    if (!hasConfigurationCapability) {
      return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
      result = connection.workspace.getConfiguration({
        scopeUri: resource,
        section: "endlesssky",
      });
      documentSettings.set(resource, result);
    }
    return result;
  }

  async function validateFromDisk(textDocument: TextDocument): Promise<void> {
    const path = url.fileURLToPath(textDocument.uri);
    const settings = await getDocumentSettings(textDocument.uri);

    const isCore = isCoreDataFile(path);
    if (isCore) {
      console.log("parsing data files as though they are core files");
    } else {
      console.log("parsing data files as though they are a plugin");
    }

    const executable = getExecutable(sendErrorNot, settings.executablePath)
    if (!executable) {
      return
    }

    const pluginDir = getPluginDir(path);
    const issues = [];
    if (isCore) {
      issues.push(
        ...(await parseCoreDataWithSubprocess(
          getResourcesDir(path)!,
          executable
        ))
      );
    } else if (pluginDir) {
      issues.push(
        ...(await parsePluginWithSubprocess(pluginDir, executable))
      );
    }
    console.log(`found ${issues.length} issues`);
    //console.log(path, issues);
    const fileIssues = issues.filter((i) => i.file && resolve(i.file) === resolve(path));
    //console.log(path, fileIssues);
    console.log(
      `...of which ${fileIssues.length} match the queried path '${path}'`
    );
    if (issues.length && !fileIssues.length) {
      console.log(
        `no matching issues, file paths look like '${issues[0].file}''`
      );
    }

    const diagnostics = [];
    for (const issue of fileIssues) {
      if (!issue.lineno || !issue.file) continue; // TODO locate entities
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: issue.lineno - 1, character: 0 },
          end: {
            line: issue.lineno - 1,
            character: 100000,
          },
        },
        message: issue.message,
        source: "Endless Sky",
      };
      if (hasDiagnosticRelatedInformationCapability) {
        // these can be in other files so will be useful to link to related resources
        diagnostic.relatedInformation = [
          {
            location: {
              uri: textDocument.uri,
              range: {
                start: { line: issue.lineno - 1, character: 0 },
                end: {
                  line: issue.lineno - 1,
                  character: 100000,
                },
              },
            },
            message: issue.fullMessage,
          },
        ];
      }
      diagnostics.push(diagnostic);
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  }

  console.log(process.argv);
  documents.listen(connection);
  connection.listen();
};
