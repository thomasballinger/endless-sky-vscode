# Endless Sky data file language extension

Notice your spelling mistakes sooner!

This extension interprets every .txt file as Endless Sky data. You can change the filetype of a document back to 'plaintext' to temporarily disable this, or disable the plugin to prevent it on all files. Maybe someday there will be a way to change language based on file contents or location, but for now there seems to be no way to do this in VSCode.

When creating Endless Sky plugins, see [the GitHub wiki](https://github.com/endless-sky/endless-sky/wiki/CreatingPlugins) for instructions. Some of this information in available in-editor with this extension, but the wiki will always be the authoritative source. Some keywords may be missing from syntax highlighting in this plugin, but the error messages are directly from an Endless Sky executable.

## Features

- syntax highlighting
- errors.txt messages shown inline
- snippets for creating new planets, fleets, and stellar objects.
- more coming soon!

# Config

The plugin looks in several standard locations for Endless Sky installed on your computer, but you can choose which executable to use by setting the executable path in settings by searching for endless sky settings or setting `endlesssky.executablePath` in settings.json.

## Contributing

Please open issues with bugs and ideas [here](https://github.com/thomasballinger/endless-sky-vscode). If you're using this plugin I'd love to hear from you.

If you want to improve anything, especially the snippets or syntax highlighting, make a pull request to [this repo](https://github.com/thomasballinger/endless-sky-vscode) or let [@ballingt](https://twitter.com/ballingt) know on Twitter or message @ballingt on the [Endless Sky Discord](https://discord.gg/ZeuASSx).

Syntax highlighting of keywords is based on the text files in the syntaxgen folder. If a word isn't being highlighted, it should be added to keywords.txt.

Some features are provided by an [LSP](https://microsoft.github.io/language-server-protocol/) which will soon use the [JavaScript Endless Sky bindings](https://github.com/thomasballinger/endless-sky-bindings). Contributions to these bindings are helpful too.

## How to build for development
Are you just changing the default syntax file, snippets, or other VSCode configuration? Then just clone the repo and make the changes, not much setup required.

Are you making changes to the language server?
* install meson and ninja
* install the emscripten with [emsdk](https://emscripten.org/docs/getting_started/downloads.html)
* `~/emsdk/emsdk install tot`  # tot is "tip of tree" which we need for
* `~/emsdk/emsdk activate tot` # a fix that isn't in a released version yet
* `git clone --recursive`  # because we need quyykk's language server
* `source ~/emsdk/emsdk_env.sh`
* cd endless-sky-vscode`
* `npm install`
* `npm run vscode:prepublish`
* `code .`
* click "debug"
