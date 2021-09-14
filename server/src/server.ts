import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
} from "vscode-languageserver/node";
import { URL } from "url";
import * as fs from 'fs';

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  parseCoreDataWithSubprocess,
  parsePluginWithSubprocess,
} from "./subprocess";
import { getPluginDir, getResourcesDir, isCoreDataFile } from "./plugin";

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!capabilities?.workspace?.configuration;
  hasDiagnosticRelatedInformationCapability =
    !!capabilities.textDocument?.publishDiagnostics?.relatedInformation;

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
    const { executablePath } = globalSettings;
    if (executablePath && !fs.existsSync(executablePath)) {
      // TODO show a dialog requesting a better default be set or something
      console.log("executablePath + '" + executablePath + "' does not exist, please fix in settings");
      connection.console.log("executablePath + '" + executablePath + "' does not exist, please fix in settings");
    }
  }

  // Revalidate all open text documents
  documents.all().forEach(validateFromDisk);
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

documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

documents.onDidSave(async (e) => {
  validateFromDisk(e.document);
});

//emitted when the text document first opened or when its content has changed
documents.onDidChangeContent((change) => {
  console.log('receive didChangeContent but doing nothing for now');
});

documents.onDidOpen(change => {
  console.log('receved didOpen but doing nothing for now');
});

async function validateFromDisk(textDocument: TextDocument): Promise<void> {
  const path = new URL(textDocument.uri).pathname;
  const settings = await getDocumentSettings(textDocument.uri);

  const isCore = isCoreDataFile(path);
  console.log('parsing data files as though they are core files:', isCore);
  const pluginDir = getPluginDir(path);
  const issues = [];
  if (isCore) {
    issues.push(...(await parseCoreDataWithSubprocess(getResourcesDir(path)!, settings.executablePath)));
  } else if (pluginDir) {
    issues.push(...(await parsePluginWithSubprocess(pluginDir, settings.executablePath)));
  }
  //console.log(path, issues);
  const fileIssues = issues.filter((i) => i.file === path);
  //console.log(path, fileIssues);

  const diagnostics = [];
  for (const issue of fileIssues) {
    textDocument.positionAt;
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: { line: issue.linenos[issue.linenos.length - 1] - 1, character: 0 },
        end: {
          line: issue.linenos[issue.linenos.length - 1] - 1,
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
              start: { line: issue.linenos[issue.linenos.length - 1] - 1, character: 0 },
              end: {
                line: issue.linenos[issue.linenos.length - 1] - 1,
                character: 100000,
              },
            }
          },
          message: issue.fullMessage,
        }
      ];
    }
    diagnostics.push(diagnostic);
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// TODO implement semantic autocompletion (this will be sweet!)
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    console.log("completion requested for", _textDocumentPosition);
    // TODO autocomplete
    return [
      {
        label: "Aerie",
        kind: CompletionItemKind.Text,
        data: 1,
      },
      {
        label: "Argosy",
        kind: CompletionItemKind.Text,
        data: 2,
      },
    ];
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data === 1) {
    item.detail = "Aerie details";
    item.documentation = "Aerie documentation";
  } else if (item.data === 2) {
    item.detail = "Argosy details";
    item.documentation = "Argosy documentation";
  }
  return item;
});

documents.listen(connection);
connection.listen();