(() => {
  const kit = ChunkLab.widgetKit;
  const DEFAULT_LIMIT = 50;
  const separatorLabels = new Map([
    ["\n\n", "¶ paragraph"],
    ["\n", "↵ line"],
    [". ", "· sentence"],
    [" ", "␣ word"],
  ]);

  function separators(call) {
    return call.args.separators?.values || [];
  }

  function drawTree(tree, preview, { calls, truncated }) {
    const parents = new Set(calls.map(({ parent }) => parent));
    let selected;
    const items = calls.map((call) => {
      const item = document.createElement("li");
      item.style.setProperty("--depth", Math.min(call.depth, 5));
      if (call.depth) item.classList.add("fc-branch");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fc-node";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-controls", preview.id);
      const words = call.args.text?.words;
      const chunks = call.result?.length;
      const fits = !parents.has(call.id) && Number.isInteger(words) && words <= call.args.max_words;
      const labels = separators(call).map((value) => separatorLabels.get(value) || JSON.stringify(value));
      button.classList.toggle("fc-node-fits", fits);
      button.textContent = `Level ${call.depth + 1} · ${kit.wordCountLabel(words ?? "?")} in · ${chunks ?? "?"} ${chunks === 1 ? "chunk" : "chunks"} out${fits ? " · ✓ fits" : ""}`;
      const detail = document.createElement("span");
      detail.textContent = labels.length ? labels.join(" / ") : "No separators left";
      button.append(detail);
      button.addEventListener("click", () => {
        selected?.setAttribute("aria-pressed", "false");
        selected = button;
        button.setAttribute("aria-pressed", "true");
        preview.textContent = call.args.text?.preview || "No text to preview.";
        if (call.args.text?.preview?.length === 40) preview.append("…");
      });
      item.append(button);
      return item;
    });
    tree.replaceChildren(...items);
    preview.textContent = "Choose a call to see the start of its text.";
    const depth = calls.reduce((max, call) => Math.max(max, call.depth + 1), 0);
    const count = `${calls.length} ${calls.length === 1 ? "call" : "calls"}`;
    return `${count} · deepest level ${depth}${truncated ? " · trace shortened to the first 200 calls" : ""}`;
  }

  function mount(el, { data, py, mode }) {
    el.innerHTML = `
      <div class="fc-card">
        <p>The splitter has a limit of ${DEFAULT_LIMIT} words per chunk. Which separator does it try first?</p>
        <div class="fc-controls">
          <button type="button" data-guess="paragraph" aria-pressed="false">Blank line (paragraph)</button>
          <button type="button" data-guess="line" aria-pressed="false">New line</button>
          <button type="button" data-guess="sentence" aria-pressed="false">". " (sentence)</button>
          <button type="button" data-guess="word" aria-pressed="false">Space</button>
        </div>
        <p class="fc-prediction" role="status"></p>
      </div>
      <div class="fc-activity" hidden>
        <div class="fc-columns">
          <div class="fc-card">
            <h3>Try the code</h3>
            <div class="fc-editor"></div>
            <div class="fc-settings">
              <label>max_words <input type="range" name="max_words" min="15" max="80" value="${DEFAULT_LIMIT}"> <span data-value="max_words" aria-hidden="true">${DEFAULT_LIMIT}</span></label>
            </div>
            <button class="fc-reset" type="button">Reset code</button>
            <p class="fc-error" role="alert" hidden></p>
          </div>
          <div class="fc-card">
            <h3>Call tree</h3>
            <p>Only calls that had to split appear here. Pieces that already fit go straight into the output.</p>
            <p class="fc-status" role="status"></p>
            <div class="fc-tree-results" hidden>
              <p class="fc-tree-count"></p>
              <ol class="fc-tree" aria-label="Recursive calls"></ol>
              <p class="fc-preview" id="recursive-preview" role="status"></p>
            </div>
          </div>
        </div>
        <div class="fc-card fc-comparison">
          <h3>Compare strategies</h3>
          <fieldset class="fc-strategies" disabled>
            <legend>Strategy</legend>
            <label><input type="radio" name="compare-strategy" value="fixed"> Fixed</label>
            <label><input type="radio" name="compare-strategy" value="sentences"> Sentences</label>
            <label><input type="radio" name="compare-strategy" value="recursive" checked> Recursive</label>
          </fieldset>
          <p class="fc-status" role="status"></p>
          <p class="fc-error" role="alert" hidden></p>
          <p class="fc-cut-count" role="status"></p>
          <div class="fc-chunks" role="region" aria-label="Comparison chunks" tabindex="0" hidden></div>
        </div>
        <div class="fc-card fc-goal">
          <p>Lower max_words until the splitter has to break a line into sentences.</p>
          <p class="fc-success" role="status"></p>
        </div>
      </div>`;

    const find = (selector) => el.querySelector(selector);
    const treeResults = find(".fc-tree-results");
    const comparePanel = find(".fc-comparison");
    const strategy = comparePanel.querySelector("fieldset");
    const output = comparePanel.querySelector(".fc-chunks");
    const cutCount = comparePanel.querySelector(".fc-cut-count");
    const messages = kit.feedback(comparePanel, [output, cutCount]);
    const goal = kit.showGoal(el, "s4");
    const headings = data.doc.trim().split(/\r?\n(?:[ \t]*\r?\n)+/).map((section) =>
      kit.splitWords(section.split(/\r?\n/, 1)[0]).join(" ")
    );
    let latestTrace;
    let comparison = 0;

    function cutsSentence(chunk) {
      const text = kit.splitWords(chunk).join(" ");
      return !/[.?!]$/.test(text) && !headings.some((heading) => text === heading || text.endsWith(" " + heading));
    }

    async function compare() {
      if (!latestTrace) return;
      const current = ++comparison;
      const choice = strategy.querySelector("input:checked").value;
      const { chunks, maxWords } = latestTrace;
      try {
        let result = { ok: true, value: chunks };
        if (choice !== "recursive") {
          await messages.ready(py);
          if (current !== comparison) return;
          messages.running();
          const fn = `chunk_${choice}`;
          const args = choice === "fixed" ? [data.doc, maxWords, 0] : [data.doc, maxWords];
          result = await py.call(`from chunkers import ${fn}`, fn, args);
        }
        if (current !== comparison) return;
        if (!result.ok) {
          messages.fail(result.error);
          return;
        }
        messages.done();
        kit.showChunks(output, kit.matchAnswer(result.value, data.questions[0].answer));
        cutCount.textContent = `Chunks cut mid-sentence: ${result.value.filter(cutsSentence).length}`;
      } catch {
        if (current === comparison) messages.fail(kit.loadError);
      }
    }

    strategy.addEventListener("change", compare);
    const reveal = kit.codeActivity(el, {
      py, mode, fn: "chunk_recursive",
      settings: `max_words = ${DEFAULT_LIMIT}`,
      settingsError: "Keep the line max_words = … at the top.",
      outputs: [treeResults, comparePanel],
      execute: (code, [maxWords]) => py.trace(code, "chunk_recursive", [data.doc, maxWords]),
      render(result, [maxWords]) {
        find(".fc-tree-count").textContent = drawTree(find(".fc-tree"), find(".fc-preview"), result);
        treeResults.hidden = false;
        latestTrace = { chunks: result.value, maxWords };
        strategy.disabled = false;
        compare();

        const met = result.calls.some((call) => separators(call)[0] === ". ");
        goal(met, "You reached the sentence separator.");
      },
    });
    kit.onPrediction(el, (guess) => {
      const feedback = find(".fc-prediction");
      feedback.textContent = guess === "paragraph"
        ? "✓ Correct. The splitter tries blank lines first to keep paragraphs together."
        : "✕ It tries blank lines first to keep paragraphs together.";
      reveal();
    });
  }

  ChunkLab.widgets["recursive-tree"] = { mount };
})();
