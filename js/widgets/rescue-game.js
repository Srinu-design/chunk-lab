(() => {
  const kit = ChunkLab.widgetKit;
  const PAR = 43;
  const BUDGET = 60;

  const roundCode = `from chunkers import chunk_fixed, chunk_sentences, chunk_recursive
from search import evaluate

def run_round(doc, questions, strategy, size, overlap):
    if strategy == "fixed":
        chunks = chunk_fixed(doc, size, overlap)
    elif strategy == "sentences":
        chunks = chunk_sentences(doc, size)
    else:
        chunks = chunk_recursive(doc, size)
    return {"chunks": chunks, "results": evaluate(chunks, questions, budget=${BUDGET})}`;

  function questionCard(question, row, part) {
    const card = document.createElement("article");
    card.className = "fc-card fc-question";
    const heading = document.createElement("h4");
    heading.textContent = question.question;
    card.append(heading);
    if (part) {
      card.append(kit.chunkBlock(part, row.top_index));
    } else {
      const empty = document.createElement("p");
      empty.textContent = "The search returned no chunk.";
      card.append(empty);
    }

    const budget = document.createElement("div");
    budget.className = "fc-budget";
    const bar = document.createElement("progress");
    bar.max = BUDGET;
    bar.value = Math.min(row.words, BUDGET);
    bar.classList.toggle("fc-over-budget", row.words > BUDGET);
    bar.setAttribute("aria-label", "Words used in this question’s retrieval budget");
    const words = document.createElement("span");
    words.textContent = `${kit.wordCountLabel(row.words)} / ${kit.wordCountLabel(BUDGET)}`;
    budget.append(bar, words);

    const status = document.createElement("p");
    status.className = row.rescued ? "fc-game-status fc-pass" : "fc-game-status";
    if (row.rescued) status.textContent = "✓ Rescued";
    else if (row.has_answer) status.textContent = "✕ Over budget";
    else if (part?.marks.size) status.textContent = "✕ Answer cut";
    else status.textContent = "✕ Wrong chunk";
    card.append(budget, status);
    return card;
  }

  function mount(el, { data, py, mode }) {
    el.innerHTML = `
      <div class="fc-card">
        <p>Will fixed, 40 words, no overlap rescue all three questions?</p>
        <div class="fc-controls">
          <button type="button" data-guess="yes" aria-pressed="false">Yes, all three</button>
          <button type="button" data-guess="no" aria-pressed="false">No, at least one fails</button>
        </div>
        <p class="fc-prediction" role="status"></p>
      </div>
      <div class="fc-activity" hidden>
        <div class="fc-card">
          <h3 class="fc-level-title">Level 1 · Fixed only</h3>
          <div class="fc-level-two" hidden>
            <p>Rescue all three while sending the fewest total words.</p>
            <dl class="fc-stats">
              <div><dt>Par</dt><dd>${kit.wordCountLabel(PAR)}</dd></div>
              <div><dt>Your best</dt><dd class="fc-best">—</dd></div>
            </dl>
            <p class="fc-par-result" role="status"></p>
          </div>
          <fieldset class="fc-strategies" hidden>
            <legend>Strategy</legend>
            <label><input type="radio" name="game-strategy" value="fixed" checked> Fixed</label>
            <label><input type="radio" name="game-strategy" value="sentences"> Sentences</label>
            <label><input type="radio" name="game-strategy" value="recursive"> Recursive</label>
          </fieldset>
          <div class="fc-settings">
            <label>size <input type="range" name="size" min="10" max="80" value="40"> <span data-value="size" aria-hidden="true">40</span></label>
            <label>overlap <input type="range" name="overlap" min="0" max="30" value="0"> <span data-value="overlap" aria-hidden="true">0</span></label>
          </div>
          <button type="button" class="fc-run">Run search</button>
          <p class="fc-status" role="status"></p>
          <p class="fc-error" role="alert" hidden></p>
        </div>
        <div class="fc-game-results">
          <div class="fc-questions"></div>
          <div class="fc-card">
            <dl class="fc-stats" aria-live="polite">
              <div><dt>Rescued</dt><dd data-stat="rescued">—</dd></div>
              <div><dt>Attempts</dt><dd data-stat="attempts">0</dd></div>
              <div><dt>Total words sent</dt><dd data-stat="total">—</dd></div>
            </dl>
            <p class="fc-hint" role="status"></p>
            <div class="fc-win" hidden>
              <p role="status"></p>
              <button type="button" class="fc-next-level">Play level 2</button>
            </div>
          </div>
        </div>
        <details class="fc-card fc-peek">
          <summary>Peek at the code</summary>
          <pre><code></code></pre>
        </details>
      </div>`;

    kit.widgetMode(el, mode);
    const find = (selector) => el.querySelector(selector);
    const strategy = find("fieldset");
    const size = find('[name="size"]');
    const overlap = find('[name="overlap"]');
    const runButton = find(".fc-run");
    const win = find(".fc-win");
    const messages = kit.feedback(el, [find(".fc-questions")]);
    let level = 1;
    let attempts = 0;
    let failedLevelOne = 0;
    let wonLevelOne = false;
    let running = false;
    let best = Infinity;

    kit.onPrediction(el, (guess) => {
      const prefix = guess === "no" ? "✓ Correct." : "✕ One answer gets cut.";
      find(".fc-prediction").textContent = `${prefix} Fixed at 40 words with no overlap cuts the gift-card answer.`;
    });
    find(".fc-peek code").textContent = roundCode;

    for (const slider of [size, overlap]) {
      slider.addEventListener("input", () => {
        find(`[data-value="${slider.name}"]`).textContent = slider.value;
      });
    }
    strategy.addEventListener("change", () => {
      overlap.closest("label").hidden = strategy.querySelector("input:checked").value !== "fixed";
    });

    function render({ chunks, results }) {
      const cards = results.map((row, i) => {
        const question = data.questions[i];
        const parts = kit.matchAnswer(chunks, question.answer);
        return questionCard(question, row, parts[row.top_index]);
      });
      const rescued = results.filter((row) => row.rescued).length;
      const total = results.reduce((sum, row) => sum + row.words, 0);
      find(".fc-questions").replaceChildren(...cards);
      find('[data-stat="rescued"]').textContent = `${rescued} / ${results.length}`;
      find('[data-stat="total"]').textContent = total;

      if (level === 1) {
        if (rescued === results.length) {
          wonLevelOne = true;
          win.hidden = false;
          win.querySelector("p").textContent = `✓ You rescued all three in ${attempts} ${attempts === 1 ? "attempt" : "attempts"}.`;
          ChunkLab.emit("section-complete", { id: "s5" });
        } else {
          failedLevelOne += 1;
          if (failedLevelOne === 3) {
            find(".fc-hint").textContent = "Try some overlap so sentences on a boundary appear whole in one chunk.";
          }
        }
      } else if (rescued === results.length && total < best) {
        best = total;
        find(".fc-best").textContent = kit.wordCountLabel(best);
        find(".fc-par-result").textContent = best <= PAR ? `✓ You ${best === PAR ? "matched" : "beat"} par` : "";
      }
    }

    runButton.addEventListener("click", async () => {
      if (running || (level === 1 && wonLevelOne)) return;
      running = true;
      runButton.setAttribute("aria-disabled", "true");
      const choice = strategy.querySelector("input:checked").value;
      const args = [data.doc, data.questions, choice, Number(size.value), Number(overlap.value)];
      find('[data-stat="attempts"]').textContent = ++attempts;
      messages.clearError();
      try {
        await messages.ready(py);
        messages.running();
        const result = await py.call(roundCode, "run_round", args);
        if (result.ok) {
          messages.done();
          render(result.value);
        } else {
          messages.fail(result.error);
        }
      } catch {
        messages.fail(kit.loadError);
      } finally {
        running = false;
        if (!(level === 1 && wonLevelOne)) runButton.removeAttribute("aria-disabled");
      }
    });

    find(".fc-next-level").addEventListener("click", () => {
      level = 2;
      find(".fc-level-title").textContent = "Level 2 · Fewest words";
      find(".fc-level-two").hidden = false;
      strategy.hidden = false;
      win.hidden = true;
      find(".fc-hint").textContent = "";
      runButton.removeAttribute("aria-disabled");
      strategy.querySelector("input:checked").focus();
    });
  }

  ChunkLab.widgets["rescue-game"] = { mount };
})();
