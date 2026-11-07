(() => {
  const loading = "Loading Python (first visit takes a few seconds)…";
  const loadError = "Python could not load. Check your connection and reload the page.";
  const splitWords = (text) => text.match(/\S+/g) || [];
  const wordCountLabel = (count) => `${count} ${count === 1 ? "word" : "words"}`;
  const isChunks = (value) => Array.isArray(value) && value.every((chunk) => typeof chunk === "string");

  function sharedWords(before, after, limit = Infinity) {
    for (let count = Math.min(before.length, after.length, limit); count > 0; count -= 1) {
      if (after.slice(0, count).every((word, i) => word === before[before.length - count + i])) {
        return count;
      }
    }
    return 0;
  }

  function matchAnswer(chunks, answer) {
    const words = splitWords(answer);
    const parts = chunks.map((chunk) => ({ words: splitWords(chunk), marks: new Set(), whole: false }));
    const overlaps = parts.map((part, i) => i ? sharedWords(parts[i - 1].words, part.words) : 0);

    function markSequence(useOverlap) {
      const stream = [];
      const offsets = parts.map((part, i) => {
        const shared = useOverlap ? overlaps[i] : 0;
        const offset = stream.length - shared;
        for (const word of part.words.slice(shared)) stream.push(word);
        return offset;
      });
      for (let start = 0; start + words.length <= stream.length; start += 1) {
        if (!words.every((word, i) => word === stream[start + i])) continue;
        parts.forEach((part, i) => {
          const from = Math.max(0, start - offsets[i]);
          const to = Math.min(part.words.length, start + words.length - offsets[i]);
          for (let j = from; j < to; j += 1) part.marks.add(j);
          if (to - from === words.length) part.whole = true;
        });
      }
    }

    if (words.length) {
      // Check the plain boundaries too, since equal edge words can be a coincidence.
      markSequence(false);
      if (overlaps.some(Boolean)) markSequence(true);
    }
    return parts;
  }

  function chunkBlock({ words, marks, whole }, index) {
    const block = document.createElement("div");
    block.className = whole ? "fc-chunk fc-whole" : "fc-chunk";
    const label = document.createElement("p");
    label.className = "fc-chunk-label";
    label.textContent = `chunk ${index + 1} · ${wordCountLabel(words.length)}${whole ? " · answer whole" : ""}`;
    const body = document.createElement("p");
    for (let start = 0; start < words.length;) {
      const marked = marks.has(start);
      let end = start + 1;
      while (end < words.length && marks.has(end) === marked) end += 1;
      const text = words.slice(start, end).join(" ");
      if (start) body.append(" ");
      if (marked) {
        const mark = document.createElement("span");
        mark.className = "fc-answer-word";
        mark.textContent = text;
        body.append(mark);
      } else {
        body.append(text);
      }
      start = end;
    }
    block.append(label, body);
    return block;
  }

  function showChunks(output, parts) {
    const blocks = document.createDocumentFragment();
    parts.forEach((part, index) => blocks.append(chunkBlock(part, index)));
    output.replaceChildren(blocks);
    output.hidden = false;
  }

  function widgetMode(el, mode, refresh = () => {}) {
    el.classList.add("chunk-widget");
    function setMode(value) {
      el.classList.toggle("fc-slides", value === "slides");
      refresh();
    }
    setMode(mode());
    ChunkLab.on("mode-change", ({ mode: value }) => setMode(value));
  }

  function onPrediction(el, reveal) {
    const buttons = el.querySelectorAll("[data-guess]");
    const activity = el.querySelector(".fc-activity");
    let guess;
    for (const button of buttons) {
      button.addEventListener("click", () => {
        if (guess) return;
        guess = button.dataset.guess;
        button.setAttribute("aria-pressed", "true");
        button.setAttribute("aria-disabled", "true");
        for (const other of buttons) other.disabled = other !== button;
        activity.hidden = false;
        reveal(guess);
      });
    }
  }

  function feedback(scope, outputs) {
    const status = scope.querySelector(".fc-status");
    const error = scope.querySelector(".fc-error");
    let prepared;
    return {
      loading: () => { status.textContent = loading; },
      async ready(py) {
        const ready = py.ready;
        if (prepared === ready) return;
        this.loading();
        await ready;
        prepared = ready;
      },
      running: () => { status.textContent = "Running…"; },
      clearError: () => { error.hidden = true; },
      fail(message) {
        status.textContent = "";
        error.textContent = message;
        error.hidden = false;
        for (const output of outputs) output.classList.add("fc-dim");
      },
      done() {
        status.textContent = "";
        this.clearError();
        for (const output of outputs) output.classList.remove("fc-dim");
      },
    };
  }

  function codeActivity(el, { py, mode, fn, settings, settingsError, outputs, execute, render }) {
    const sliders = [...el.querySelectorAll(".fc-settings input")];
    const reset = el.querySelector(".fc-reset");
    const messages = feedback(el, outputs);
    let editor, timer, errorLine;
    let revision = 0;

    widgetMode(el, mode, () => editor?.refresh());
    reset.disabled = true;
    for (const slider of sliders) slider.disabled = true;

    function readSetting(name) {
      const pattern = new RegExp(`^(${name}[ \\t]*=[ \\t]*)([+-]?\\d+)[ \\t]*(?:#.*)?$`);
      for (let line = 0; line < Math.min(sliders.length, editor.lineCount()); line += 1) {
        const match = editor.getLine(line).match(pattern);
        if (match && Number.isSafeInteger(Number(match[2]))) {
          const start = match[1].length;
          return { line, start, end: start + match[2].length, value: Number(match[2]) };
        }
      }
      return null;
    }

    function clearError() {
      messages.clearError();
      if (errorLine) {
        editor.removeLineClass(errorLine, "background", "fc-error-line");
        errorLine = null;
      }
    }

    function fail(message, line) {
      clearError();
      messages.fail(message);
      if (editor && Number.isInteger(line) && line > 0 && line <= editor.lineCount()) {
        errorLine = editor.addLineClass(line - 1, "background", "fc-error-line");
      }
    }

    async function run(current) {
      const values = sliders.map(({ name }) => readSetting(name)?.value);
      if (values.some((value) => value === undefined)) {
        fail(settingsError);
        return;
      }
      try {
        await messages.ready(py);
        if (current !== revision) return;
        messages.running();
        const result = await execute(editor.getValue(), values);
        if (current !== revision) return;
        if (!result.ok) fail(result.error, result.line);
        else if (!isChunks(result.value)) fail(`Return a list of text chunks from ${fn}.`);
        else {
          messages.done();
          render(result, values);
        }
      } catch {
        if (current === revision) fail(loadError);
      }
    }

    function schedule() {
      clearError();
      for (const slider of sliders) {
        const setting = readSetting(slider.name);
        if (setting) {
          slider.value = setting.value;
          el.querySelector(`[data-value="${slider.name}"]`).textContent = setting.value;
        }
      }
      clearTimeout(timer);
      const current = ++revision;
      timer = setTimeout(() => run(current), 300);
    }

    return async () => {
      messages.loading();
      try {
        const initialCode = settings + "\n\n" + await py.source("chunkers", fn);
        editor = CodeMirror(el.querySelector(".fc-editor"), {
          value: initialCode, mode: "python", lineNumbers: true, lineWrapping: true,
        });
        editor.getInputField().setAttribute("aria-label", `Python code for ${fn}`);
        editor.on("change", schedule);
        for (const slider of sliders) {
          slider.disabled = false;
          slider.addEventListener("input", () => {
            const setting = readSetting(slider.name);
            if (setting) {
              editor.replaceRange(slider.value, { line: setting.line, ch: setting.start }, { line: setting.line, ch: setting.end });
            }
          });
        }
        reset.disabled = false;
        reset.addEventListener("click", () => editor.setValue(initialCode));
        schedule();
      } catch {
        fail("The lesson code could not load. Check your connection and reload the page.");
      }
    };
  }

  function showGoal(el, section) {
    const goal = el.querySelector(".fc-goal");
    const success = goal.querySelector(".fc-success");
    let complete = false;
    return (met, message) => {
      goal.classList.toggle("fc-goal-met", met);
      success.textContent = met ? `✓ ${message}` : "";
      if (met && !complete) {
        complete = true;
        ChunkLab.emit("section-complete", { id: section });
      }
    };
  }

  function mount(el, { data, py, mode }) {
    el.innerHTML = `
      <div class="fc-card">
        <p>Before you touch anything: if overlap is 0, will the damaged-item answer stay in one piece?</p>
        <div class="fc-controls">
          <button type="button" data-guess="yes" aria-pressed="false">Yes, it stays whole</button>
          <button type="button" data-guess="no" aria-pressed="false">No, it gets cut</button>
        </div>
      </div>
      <div class="fc-activity" hidden>
        <div class="fc-columns">
          <div class="fc-card">
            <h3>Try the code</h3>
            <div class="fc-editor"></div>
            <div class="fc-settings">
              <label>size <input type="range" name="size" min="10" max="80" value="30"> <span data-value="size" aria-hidden="true">30</span></label>
              <label>overlap <input type="range" name="overlap" min="0" max="30" value="0"> <span data-value="overlap" aria-hidden="true">0</span></label>
            </div>
            <button class="fc-reset" type="button">Reset code</button>
            <p class="fc-error" role="alert" hidden></p>
          </div>
          <div class="fc-card">
            <h3>Chunks</h3>
            <p class="fc-status" role="status"></p>
            <div class="fc-chunks" role="region" aria-label="Chunk output" tabindex="0" hidden></div>
          </div>
        </div>
        <div class="fc-card fc-summary" hidden>
          <p class="fc-guess"></p>
          <p class="fc-verdict" role="status"></p>
          <dl class="fc-stats">
            <div><dt>Chunks</dt><dd data-stat="count"></dd></div>
            <div><dt>Average words</dt><dd data-stat="average"></dd></div>
            <div><dt>Words repeated by overlap</dt><dd data-stat="repeated"></dd></div>
          </dl>
        </div>
        <div class="fc-card fc-goal">
          <p>Goal: keep the answer whole with size 30 or less.</p>
          <p class="fc-success" role="status"></p>
        </div>
      </div>`;

    const find = (selector) => el.querySelector(selector);
    const output = find(".fc-chunks");
    const summary = find(".fc-summary");
    const verdict = find(".fc-verdict");
    const goal = showGoal(el, "s3");
    let guess;

    const reveal = codeActivity(el, {
      py, mode, fn: "chunk_fixed",
      settings: "size = 30      # words per chunk\noverlap = 0    # words shared between neighbours",
      settingsError: "Keep the lines size = … and overlap = … at the top.",
      outputs: [output, summary],
      execute: (code, values) => py.call(code, "chunk_fixed", [data.doc, ...values]),
      render({ value: chunks }, [size, overlap]) {
        const parts = matchAnswer(chunks, data.questions[0].answer);
        const wholeIndex = parts.findIndex(({ whole }) => whole);
        const totalWords = parts.reduce((sum, { words }) => sum + words.length, 0);
        const repeated = parts.slice(1).reduce((sum, part, i) => sum + sharedWords(parts[i].words, part.words, overlap), 0);

        showChunks(output, parts);
        summary.hidden = false;
        find(".fc-guess").textContent = `You guessed ${guess}. Here's what happened:`;
        verdict.classList.toggle("fc-pass", wholeIndex >= 0);
        verdict.textContent = wholeIndex >= 0
          ? `✓ The answer sits whole in chunk ${wholeIndex + 1}. ${chunks.length} chunks in total.`
          : "✕ The answer is cut across chunks, so retrieval can only return part of it. Try more overlap or a bigger size.";
        find('[data-stat="count"]').textContent = chunks.length;
        find('[data-stat="average"]').textContent = Math.round(totalWords / (chunks.length || 1));
        find('[data-stat="repeated"]').textContent = repeated;
        goal(wholeIndex >= 0 && size <= 30, "You kept the whole answer in a chunk of 30 words or less.");
      },
    });
    onPrediction(el, (value) => {
      guess = value;
      reveal();
    });
  }

  ChunkLab.widgetKit = {
    splitWords, wordCountLabel, matchAnswer, chunkBlock, showChunks, widgetMode, onPrediction,
    feedback, codeActivity, showGoal, loadError,
  };
  ChunkLab.widgets["fixed-chunks"] = { mount };
})();
