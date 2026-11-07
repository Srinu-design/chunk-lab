// js/clean-doc.js - Section 2: Interactive Document Cleaning
(function () {
  'use strict';

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function countWords(str) {
    return str.match(/\S+/g)?.length ?? 0;
  }

  function normalizeDoc(str) {
    if (!str) return '';
    const lines = str.trim().split(/\r?\n/).map((l) => l.trim());
    return lines.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  function initCleanDoc() {
    const container = document.getElementById('clean-doc-mount');
    if (!container) return;

    const data = window.ChunkLab && window.ChunkLab.data;
    if (!data || !data.rawDoc || !data.doc) {
      container.innerHTML = '<div class="activity-loading"><p>Waiting for document data…</p></div>';
      return;
    }

    const rawDoc = data.rawDoc;
    const cleanDoc = normalizeDoc(data.doc);
    const initialWordCount = countWords(rawDoc);

    container.innerHTML = `
      <div class="clean-doc-layout">
        <div class="clean-doc-panel">
          <div class="toggles-group" role="group" aria-label="Cleaning operations">
            <label class="toggle-label">
              <input type="checkbox" id="clean-toggle-headers" class="toggle-input" checked>
              <span>Remove page headers and footers</span>
            </label>
            <label class="toggle-label">
              <input type="checkbox" id="clean-toggle-hyphens" class="toggle-input" checked>
              <span>Join words split across lines</span>
            </label>
            <label class="toggle-label">
              <input type="checkbox" id="clean-toggle-spaces" class="toggle-input" checked>
              <span>Collapse extra spaces</span>
            </label>
            <label class="toggle-label" style="margin-top: 4px; font-size: 0.88rem; color: var(--ink-2);">
              <input type="checkbox" id="clean-toggle-diff" class="toggle-input">
              <span>Show what changed (highlight edits)</span>
            </label>
          </div>

          <div class="clean-meta-bar" aria-live="polite">
            <span id="clean-word-count">Words: ${initialWordCount}</span>
            <span id="clean-change-stat">All cleaning active</span>
          </div>

          <div id="clean-doc-display" class="doc-viewer" aria-label="Processed document text"></div>

          <div id="clean-match-status" class="match-banner" role="status" aria-live="polite"></div>
        </div>

        <div class="code-panel">
          <div class="code-panel-header">
            <span>The same cleaning in Python</span>
            <code>re.sub</code>
          </div>
          <pre><code><span style="color: #9cdcfe;">import</span> re

<span style="color: #6a9955;"># 1. Remove page headers and footers</span>
text = re.sub(
    <span style="color: #ce9178;">r'Pebble Store Help Centre \\| Page \\d+ of \\d+\\n?|\\(c\\) 2026 Pebble Store\\. Internal use only\\.\\n?'</span>,
    <span style="color: #ce9178;">''</span>,
    text
)

<span style="color: #6a9955;"># 2. Join words split across lines</span>
text = re.sub(<span style="color: #ce9178;">r'(\\w+)-\\n(\\w+)'</span>, <span style="color: #ce9178;">r'\\1\\2'</span>, text)

<span style="color: #6a9955;"># 3. Collapse extra whitespace</span>
text = re.sub(<span style="color: #ce9178;">r'[ \\t]+'</span>, <span style="color: #ce9178;">' '</span>, text)</code></pre>
        </div>
      </div>

      <div class="question-block" id="s2-prove-block">
        <div class="question-prompt">
          <strong>Prove:</strong> Why do repetitive page headers and footers like "(c) 2026 Pebble Store. Internal use only." hurt retrieval?
        </div>
        <div class="choices-row" role="radiogroup" aria-label="Prove question options">
          <button type="button" class="choice-btn" data-s2-choice="a">
            They take up unnecessary disk storage on the database server.
          </button>
          <button type="button" class="choice-btn" data-s2-choice="b">
            They repeat identical keywords in every chunk, causing the retriever to rank irrelevant chunks highly.
          </button>
          <button type="button" class="choice-btn" data-s2-choice="c">
            Embedding models fail to process copyright symbols.
          </button>
        </div>
        <div id="s2-feedback" class="feedback-alert" role="alert" aria-live="polite"></div>
      </div>
    `;

    const toggleHeaders = document.getElementById('clean-toggle-headers');
    const toggleHyphens = document.getElementById('clean-toggle-hyphens');
    const toggleSpaces = document.getElementById('clean-toggle-spaces');
    const toggleDiff = document.getElementById('clean-toggle-diff');
    const displayEl = document.getElementById('clean-doc-display');
    const wordCountEl = document.getElementById('clean-word-count');
    const changeStatEl = document.getElementById('clean-change-stat');
    const matchStatusEl = document.getElementById('clean-match-status');

    function applyCleaning() {
      const doHeaders = toggleHeaders.checked;
      const doHyphens = toggleHyphens.checked;
      const doSpaces = toggleSpaces.checked;
      const showDiff = toggleDiff.checked;

      let processed = rawDoc;

      if (doHeaders) {
        processed = processed
          .replace(/^[ \t]*Pebble Store Help Centre \| Page \d+ of \d+[ \t]*\r?\n?/gm, '')
          .replace(/^[ \t]*\(c\) 2026 Pebble Store\. Internal use only\.[ \t]*\r?\n?/gm, '');
      }

      if (doHyphens) {
        processed = processed.replace(/(\w+)-\r?\n(\w+)/g, '$1$2');
      }

      if (doSpaces) {
        processed = processed.replace(/[ \t]{2,}/g, ' ');
      }

      const currentCount = countWords(processed);
      const diff = currentCount - initialWordCount;
      const diffStr = diff === 0 ? '0' : (diff > 0 ? `+${diff}` : `${diff}`);

      wordCountEl.textContent = `Words: ${initialWordCount} → ${currentCount} (${diffStr})`;

      const activeCount = (doHeaders ? 1 : 0) + (doHyphens ? 1 : 0) + (doSpaces ? 1 : 0);
      changeStatEl.textContent = `${activeCount} of 3 steps active`;

      if (showDiff) {
        let diffHtml = escapeHtml(rawDoc);

        if (doHeaders) {
          diffHtml = diffHtml
            .replace(
              /Pebble Store Help Centre \| Page \d+ of \d+/g,
              '<del class="diff-del">$&</del>'
            )
            .replace(
              /\(c\) 2026 Pebble Store\. Internal use only\./g,
              '<del class="diff-del">$&</del>'
            );
        }

        if (doHyphens) {
          diffHtml = diffHtml.replace(
            /(\w+)(-\r?\n)(\w+)/g,
            '$1<del class="diff-del">-</del><span class="diff-join">$3</span>'
          );
        }

        if (doSpaces) {
          diffHtml = diffHtml.replace(/[ \t]{2,}/g, '<del class="diff-del">  </del> ');
        }

        displayEl.innerHTML = diffHtml;
      } else {
        displayEl.textContent = processed;
      }

      // Check if match clean document
      const isMatch = normalizeDoc(processed) === cleanDoc;
      if (isMatch) {
        matchStatusEl.className = 'match-banner pass';
        matchStatusEl.innerHTML = '<span class="status-badge pass" aria-hidden="true">✓</span> <span>Matches the clean document</span>';
      } else {
        matchStatusEl.className = 'match-banner pending';
        matchStatusEl.innerHTML = '<span>Turn on all 3 cleaning steps to match the clean document</span>';
      }
    }

    toggleHeaders.addEventListener('change', applyCleaning);
    toggleHyphens.addEventListener('change', applyCleaning);
    toggleSpaces.addEventListener('change', applyCleaning);
    toggleDiff.addEventListener('change', applyCleaning);

    applyCleaning();

    // Prove Question Handler
    const s2Buttons = container.querySelectorAll('[data-s2-choice]');
    const s2Feedback = document.getElementById('s2-feedback');
    let s2Completed = false;

    s2Buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        s2Buttons.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');

        const choice = btn.getAttribute('data-s2-choice');
        if (choice === 'b') {
          s2Feedback.className = 'feedback-alert show success';
          s2Feedback.innerHTML = '<strong>✓ Correct!</strong> Repeated headers and footers inject identical keywords into every chunk. Queries matching boilerplate terms pull random chunks rather than relevant policy answers.';
          if (!s2Completed) {
            s2Completed = true;
            if (window.ChunkLab && typeof window.ChunkLab.emit === 'function') {
              window.ChunkLab.emit('section-complete', { id: 's2' });
            }
          }
        } else {
          s2Feedback.className = 'feedback-alert show error';
          s2Feedback.innerHTML = '<strong>❌ Not quite.</strong> Think about what happens when the user searches for a term present in the footer: every single chunk will match that keyword!';
        }
      });
    });
  }

  window.ChunkLabCleanDoc = {
    init: initCleanDoc,
  };
})();
