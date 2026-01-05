class JavaScriptSnippetsPlugin {
  constructor() {
    this.pluginId = "com.alloso.javascript.snippets";
    this.snippets = [];
    this.baseUrl = "";
    this.registeredCommandNames = [];
    this.customCompleter = null;
  }

  async init($page, { cacheFileUrl, cacheFile, R }) {
    try {
      const response = await fetch(this.baseUrl + 'javascript.json');
      if (!response.ok) {
        acode.showToast(`Error loading snippets: ${response.status}`, 5000);
        console.error(`Error loading javascript.json: ${response.status} ${response.statusText}`);
        return;
      }
      this.snippets = await response.json();
      if (!Array.isArray(this.snippets)) {
        acode.showToast("Snippets file is not a valid JSON array.", 5000);
        console.error("Snippets file is not a valid JSON array.");
        this.snippets = [];
        return;
      }

      this._registerCommandPaletteSnippets();
      this._registerAceEditorCompleter();

    } catch (error) {
      acode.showToast("Failed to initialize JavaScript Snippets plugin: " + error.message, 5000);
      console.error("Error initializing JavaScript Snippets plugin:", error);
    }
  }

  _registerCommandPaletteSnippets() {
    if (this.snippets.length === 0) {
      return;
    }
    this.registeredCommandNames = [];
    let uniqueIdCounter = 0;

    this.snippets.forEach(snippet => {
      if (snippet && typeof snippet.prefix === 'string' && typeof snippet.code === 'string') {
        const cleanPrefix = snippet.prefix.replace(/\W/g, '_');
        const commandName = `js-snippet-cmd-${cleanPrefix}-${uniqueIdCounter++}`;
        const commandDescription = snippet.description || `JS Snippet: ${snippet.prefix}`;

        acode.define(commandName, {
          exec: () => this.insertSnippetText(snippet.code),
          value: commandDescription,
        });
        this.registeredCommandNames.push(commandName);
      }
    });
  }

  _registerAceEditorCompleter() {
    if (!window.ace || this.snippets.length === 0) {
      if (!window.ace) console.warn("Ace editor not available for completer registration.");
      return;
    }

    try {
      const langTools = ace.require("ace/ext/language_tools");
      if (!langTools) {
          console.error("Ace language_tools not found.");
          acode.showToast("Ace language_tools not found for snippets.", 3000);
          return;
      }

      this.customCompleter = {
        getCompletions: (editor, session, pos, prefix, callback) => {
          const mode = session.getMode().$id;
          if (mode !== 'ace/mode/javascript' && mode !== 'ace/mode/typescript' && mode !== 'ace/mode/jsx' && mode !== 'ace/mode/tsx') {
            callback(null, []);
            return;
          }

          if (prefix.length === 0) {
            callback(null, []);
            return;
          }

          const completions = this.snippets
            .filter(s => s.prefix && typeof s.prefix === 'string' && s.prefix.toLowerCase().startsWith(prefix.toLowerCase()))
            .map(s => ({
              caption: s.prefix,
              snippet: s.code,
              value: s.prefix,
              meta: "Snippet", // Yahan badlav kiya gaya hai
              score: s.score || 1000,
              type: "snippet"
            }));
          callback(null, completions);
        }
      };

      langTools.addCompleter(this.customCompleter);
    } catch (err) {
      console.error("Error registering JavaScript snippet completer:", err);
      acode.showToast("Error setting up snippet autocompleter.", 4000);
    }
  }

  insertSnippetText(snippetCode) {
    const editor = editorManager.editor;
    if (editor && typeof editor.insertSnippet === 'function') {
      editor.insertSnippet(snippetCode);
    } else if (editor && typeof editor.insert === 'function') {
      const simplifiedCode = snippetCode
        .replace(/\$\{\d+:([^\}]+)\}/g, '$1')
        .replace(/\$\d+/g, '');
      editor.insert(simplifiedCode);
    } else {
      acode.showToast("No active editor or suitable insert method found.", 3000);
    }
  }

  async destroy() {
    this.registeredCommandNames.forEach(commandName => {
      acode.undefine(commandName);
    });
    this.registeredCommandNames = [];

    if (window.ace && this.customCompleter) {
        try {
            const langTools = ace.require("ace/ext/language_tools");
            if (langTools && langTools.removeCompleter) {
                 let completers = langTools.getCompleters ? langTools.getCompleters() : (langTools.textCompleter ? [langTools.textCompleter, langTools.keyWordCompleter] : []);
                 if (Array.isArray(completers)) {
                    langTools.setCompleters(completers.filter(c => c !== this.customCompleter));
                 }
            }
        } catch(err) {
            console.error("Error unregistering JavaScript snippet completer:", err);
        }
        this.customCompleter = null;
    }
  }
}

if (window.acode) {
  const plugin = new JavaScriptSnippetsPlugin();
  acode.setPluginInit(plugin.pluginId, async (baseUrl, $page, { cacheFileUrl, cacheFile, R }) => {
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    plugin.baseUrl = baseUrl;
    await plugin.init($page, { cacheFileUrl, cacheFile, R });
  });
  acode.setPluginUnmount(plugin.pluginId, () => {
    plugin.destroy();
  });
}