class JSSnippets {
  constructor() {
    this.id = "com.alloso.javascript.snippets";
    this.data = [];
    this.root = "";
    this.commands = [];
    this.completer = null;
  }

  async init($page, cache) {
    try {
      const res = await fetch(`${this.root}javascript.json`);
      
      if (!res.ok) {
        this.logError(`Load failed: ${res.status}`);
        return;
      }

      const list = await res.json();
      if (!Array.isArray(list)) {
        this.logError("Invalid JSON format.");
        return;
      }

      this.data = list;
      this.setupPalette();
      this.setupAutocomplete();

    } catch (err) {
      this.logError("Init error: " + err.message);
    }
  }

  logError(msg) {
    acode.showToast(msg, 5000);
    console.error(`[JSSnippets] ${msg}`);
  }

  setupPalette() {
    if (this.data.length === 0) return;
    this.commands = [];
    this.data.forEach((item, index) => {
      if (item?.prefix && item?.code) {
        const idName = `snippet-${item.prefix.replace(/\W/g, '_')}-${index}`;
        acode.define(idName, {
          exec: () => this.writeSnippet(item.code),
          value: item.description || `Insert ${item.prefix}`,
        });
        this.commands.push(idName);
      }
    });
  }

  setupAutocomplete() {
    if (!window.ace || this.data.length === 0) return;
    try {
      const tools = ace.require("ace/ext/language_tools");
      this.completer = {
        getCompletions: (editor, session, pos, prefix, callback) => {
          const fileMode = session.getMode().$id;
          const allowed = ['javascript', 'typescript', 'jsx', 'tsx'];
          if (!allowed.some(m => fileMode.includes(m)) || !prefix) return callback(null, []);

          const matches = this.data
            .filter(s => s.prefix?.toLowerCase().startsWith(prefix.toLowerCase()))
            .map(s => ({
              caption: s.prefix,
              snippet: s.code,
              meta: "EJ Snippet",
              score: 1000,
              type: "snippet"
            }));
          callback(null, matches);
        }
      };
      tools.addCompleter(this.completer);
    } catch (e) {
      this.logError("Autocomplete error.");
    }
  }

  writeSnippet(content) {
    const { editor } = editorManager;
    if (editor?.insertSnippet) {
      editor.insertSnippet(content);
    } else if (editor) {
      const clean = content.replace(/\$\{\d+:([^\}]+)\}/g, '$1').replace(/\$\d+/g, '');
      editor.insert(clean);
    }
  }

  async destroy() {
    this.commands.forEach(cmd => acode.undefine(cmd));
    if (window.ace && this.completer) {
      const tools = ace.require("ace/ext/language_tools");
      const list = tools.getCompleters();
      if (Array.isArray(list)) {
        tools.setCompleters(list.filter(c => c !== this.completer));
      }
      this.completer = null;
    }
  }
}

if (window.acode) {
  const jsPlugin = new JSSnippets();
  
  acode.setPluginInit(jsPlugin.id, async (baseUrl, $page, cache) => {
    jsPlugin.root = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    await jsPlugin.init($page, cache);
  });

  acode.setPluginUnmount(jsPlugin.id, () => jsPlugin.destroy());
}
