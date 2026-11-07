// Shared contract between Antigravity's page shell and Codex's widgets.
// See AGENTS.md for the project owner's role and the editing rules.
window.ChunkLab = {
  widgets: {},

  data: null,

  // Loads the lesson document, its messy PDF version and the game questions once.
  loadData() {
    if (!this._dataPromise) {
      const text = (path) => fetch(path).then((r) => {
        if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
        return r.text();
      });
      this._dataPromise = Promise.all([
        text("data/help-centre.txt"),
        text("data/help-centre-raw.txt"),
        text("data/questions.json").then(JSON.parse),
      ]).then(([doc, rawDoc, questions]) => (this.data = { doc, rawDoc, questions }));
    }
    return this._dataPromise;
  },

  emit(name, detail) {
    document.dispatchEvent(new CustomEvent(`chunklab:${name}`, { detail }));
  },

  on(name, handler) {
    document.addEventListener(`chunklab:${name}`, (e) => handler(e.detail));
  },
};
