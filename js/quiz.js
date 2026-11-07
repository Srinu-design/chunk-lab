// js/quiz.js - Section 7: Knowledge Check & Lesson Recap Accordion
(function () {
  'use strict';

  const QUIZ_QUESTIONS = [
    {
      topic: 'Why we chunk',
      question: 'Why should you split large documents into smaller chunks before passing them to a RAG retriever?',
      options: [
        'Bigger chunks are always better because the model sees all possible context at once.',
        'Chunking is done solely to match the exact word count of the user\'s question.',
        'Every model has an input limit, smaller pieces keep answers from getting lost in irrelevant text, and sending less text is cheaper and faster.',
        'Language models require every chunk to start with a section heading to generate answers.',
      ],
      correctIndex: 2,
      explanation:
        'While sending whole documents might seem like a way to give "all the context", large inputs bury key facts in irrelevant text, increase latency, and run up API token bills. Chunking isolates the exact passage the model needs.',
    },
    {
      topic: 'Overlap purpose',
      question: 'What is the primary reason for adding overlap between adjacent chunks?',
      options: [
        'To prevent key answer sentences and connecting ideas from being split across chunk boundaries.',
        'To make keyword and vector search faster by generating more matching terms.',
        'To allow the retriever to return duplicate copies of the same chunk for verification.',
        'To compress the document so that fewer total chunks are stored in memory.',
      ],
      correctIndex: 0,
      explanation:
        'Overlap is not meant to speed up search or create duplicates. Without overlap, an answer sentence that happens to cross a boundary gets sliced in two, losing critical facts. Overlap ensures borderline sentences remain intact in at least one chunk.',
    },
    {
      topic: 'Chunks too small',
      question: 'What happens if you set the chunk size too small (for example, 10 words per chunk)?',
      options: [
        'Retrieval improves because smaller chunks contain zero irrelevant words.',
        'The embedding model will reject chunks that contain fewer than 20 words.',
        'Search latency increases because small chunks take longer to transfer over the network.',
        'Chunks turn into fragmented phrases that lose the surrounding conditions needed to answer questions.',
      ],
      correctIndex: 3,
      explanation:
        'It is tempting to think tiny chunks are more precise because they omit filler, but chunks of only 10 words get sliced mid-thought. A fragment like "within 60 days if you" gets detached from what can be returned and what condition applies, leaving the model unable to confirm the answer.',
    },
    {
      topic: 'Document cleaning',
      question: 'Why must repetitive page headers and footers be removed from text before chunking?',
      options: [
        'Headers and footers take up too much database disk space to store efficiently.',
        'They repeat identical boilerplate keywords across every chunk, tricking the retriever into scoring irrelevant chunks high.',
        'Vector databases fail to generate embeddings for chunks with copyright symbols.',
        'Removing headers and footers ensures all chunks have identical sentence counts.',
      ],
      correctIndex: 1,
      explanation:
        'The core issue is not disk storage. When boilerplate text like a company name or copyright line appears on every page, a query matching those terms ranks random chunks highly, drowning out the actual answer passage.',
    },
    {
      topic: 'Recursive splitting hierarchy',
      question:
        'Why does a recursive splitter try paragraph breaks (\\n\\n) before sentence breaks and words?',
      options: [
        'Because scanning for double newlines runs faster in regular expression engines.',
        'To guarantee that every output chunk contains an exact multiple of sentences.',
        'To preserve the highest semantic units first, only breaking apart paragraphs and sentences when a piece exceeds the size budget.',
        'Because language models can only interpret text formatted in multi-line blocks.',
      ],
      correctIndex: 2,
      explanation:
        'Recursive splitting is structure-aware: it preserves complete thoughts by keeping paragraphs intact whenever they fit within your size limit. It only resorts to sentence or word cuts when a paragraph is too large to fit.',
    },
    {
      topic: 'Evaluating chunking settings',
      question: 'How do you determine whether a chunking setting is good for your RAG application?',
      options: [
        'Measure whether the top retrieved chunk contains the complete answer sentence to real test questions within your token budget.',
        'Check whether all chunks across your entire knowledge base have the exact same character count.',
        'Pick the largest chunk size your model supports so you never risk cutting any answer.',
        'Confirm that keyword search returns at least ten different candidate chunks for every query.',
      ],
      correctIndex: 0,
      explanation:
        'Good chunking is not about uniform length or maximizing chunk size. The real test is ground-truth retrieval: when a customer asks a question, does the top-ranked chunk contain the complete answer without exceeding your token budget?',
    },
  ];

  const RECAP_SECTIONS = [
    {
      title: 'Section 1: Why chunk at all',
      takeaway:
        'Documents must be chunked because models have finite context windows, smaller pieces deliver sharper retrieval precision, and passing fewer tokens costs less.',
    },
    {
      title: 'Section 2: Cleaning the document',
      takeaway:
        'Raw text from PDFs contains headers, footers, hyphenated line wraps, and erratic whitespace. Cleaning before chunking eliminates misleading keyword collisions and broken words.',
    },
    {
      title: 'Section 3: Fixed-size chunks',
      takeaway:
        'Fixed-size chunking splits text at fixed intervals. Overlap is critical to prevent answers and conditions from getting sliced in half at arbitrary cut points.',
    },
    {
      title: 'Section 4: Smarter splits',
      takeaway:
        'Recursive splitting preserves natural boundaries—paragraphs first, then sentences, then words—keeping thoughts together and minimizing chopped ideas.',
    },
    {
      title: 'Section 5: Rescue the Answer',
      takeaway:
        'Retrieval quality depends on the balance between size and overlap: chunks must be large enough to contain full answers, yet compact enough to fit your word budget.',
    },
    {
      title: 'Section 6: Chunking in real apps',
      takeaway:
        'Start with domain-tuned heuristics (FAQs by section, legal by clause with overlap, code by function) and always evaluate whether your top chunk holds the complete answer.',
    },
    {
      title: 'Section 7: Knowledge check',
      takeaway:
        'Great RAG systems start with thoughtful chunking: clean the text, choose structure-aware splits, and verify answers against ground truth.',
    },
  ];

  function initQuiz() {
    const mountEl = document.getElementById('quiz-mount');
    if (!mountEl) return;

    let score = 0;
    let answeredCount = 0;

    let html = '<div class="quiz-container">';

    QUIZ_QUESTIONS.forEach((q, idx) => {
      const qNum = idx + 1;
      html += `
        <div class="quiz-card" id="quiz-card-${idx}">
          <div class="quiz-q-num">Question ${qNum} of ${QUIZ_QUESTIONS.length} · ${q.topic}</div>
          <div class="quiz-q-title">${q.question}</div>
          <div class="quiz-options-list" role="radiogroup" aria-label="Question ${qNum} options">
            ${q.options
              .map(
                (opt, optIdx) => `
              <label class="quiz-option-label" id="label-${idx}-${optIdx}">
                <input type="radio" name="quiz-q-${idx}" value="${optIdx}" aria-labelledby="label-${idx}-${optIdx}">
                <span>${opt}</span>
              </label>
            `
              )
              .join('')}
          </div>
          <div class="quiz-actions">
            <button type="button" class="btn btn-primary btn-sm" id="quiz-submit-${idx}">Submit answer</button>
            <span class="quiz-error-msg" id="quiz-error-${idx}">Choose an answer first.</span>
          </div>
          <div class="quiz-explanation-box" id="quiz-exp-${idx}" role="alert" aria-live="polite"></div>
        </div>
      `;
    });

    html += `
      <div class="quiz-score-card" id="quiz-score-card" role="status" aria-live="polite">
        <div class="quiz-score-number" id="quiz-final-score">0 / 6</div>
        <h3 id="quiz-score-heading">Knowledge Check Complete!</h3>
        <p id="quiz-score-msg" style="color: var(--ink-2); margin-bottom: 0;"></p>
      </div>

      <div class="accordion-wrapper" id="recap-accordion-wrapper">
        <h3 class="accordion-title">Lesson Recap: Key Takeaways</h3>
        <div class="accordion-list" role="region" aria-label="Lesson recap by section">
          ${RECAP_SECTIONS.map(
            (sec, sIdx) => `
            <div class="accordion-item">
              <button type="button" class="accordion-btn" id="acc-btn-${sIdx}" aria-expanded="false" aria-controls="acc-content-${sIdx}">
                <span>${sec.title}</span>
                <span class="accordion-icon" aria-hidden="true">+</span>
              </button>
              <div class="accordion-content" id="acc-content-${sIdx}" role="region" aria-labelledby="acc-btn-${sIdx}">
                <p style="margin-bottom: 0;">${sec.takeaway}</p>
              </div>
            </div>
          `
          ).join('')}
        </div>
      </div>
    </div>`;

    mountEl.innerHTML = html;

    // Attach question handlers
    QUIZ_QUESTIONS.forEach((q, idx) => {
      const card = document.getElementById(`quiz-card-${idx}`);
      const submitBtn = document.getElementById(`quiz-submit-${idx}`);
      const errorMsg = document.getElementById(`quiz-error-${idx}`);
      const expBox = document.getElementById(`quiz-exp-${idx}`);
      const radioInputs = card.querySelectorAll(`input[name="quiz-q-${idx}"]`);

      radioInputs.forEach((radio) => {
        radio.addEventListener('change', () => {
          errorMsg.classList.remove('show');
          card.querySelectorAll('.quiz-option-label').forEach((lbl) => lbl.classList.remove('selected'));
          const selectedLabel = radio.closest('.quiz-option-label');
          if (selectedLabel) selectedLabel.classList.add('selected');
        });
      });

      submitBtn.addEventListener('click', () => {
        const checkedRadio = card.querySelector(`input[name="quiz-q-${idx}"]:checked`);
        if (!checkedRadio) {
          errorMsg.classList.add('show');
          return;
        }

        errorMsg.classList.remove('show');
        const chosenIdx = parseInt(checkedRadio.value, 10);
        const isCorrect = chosenIdx === q.correctIndex;

        // Disable all radios and the submit button
        radioInputs.forEach((radio) => {
          radio.disabled = true;
        });
        submitBtn.disabled = true;
        submitBtn.textContent = isCorrect ? '✓ Correct' : 'Answered';
        submitBtn.classList.remove('btn-primary');
        submitBtn.classList.add('btn-secondary');

        // Style the labels
        card.querySelectorAll('.quiz-option-label').forEach((lbl, oIdx) => {
          lbl.style.cursor = 'default';
          if (oIdx === q.correctIndex) {
            lbl.style.borderColor = 'var(--ok)';
            lbl.style.backgroundColor = 'var(--ok-tint)';
            lbl.querySelector('span').innerHTML += ' <strong>(Correct answer)</strong>';
          } else if (oIdx === chosenIdx) {
            lbl.style.borderColor = 'var(--red)';
            lbl.style.backgroundColor = 'var(--red-tint)';
          }
        });

        if (isCorrect) {
          score += 1;
          expBox.className = 'quiz-explanation-box show correct';
          expBox.innerHTML = `<div class="quiz-feedback-header"><span class="score-chip good">+1</span> <span class="feedback-verdict">Correct!</span></div><p class="quiz-explanation-text">${q.explanation}</p>`;
        } else {
          expBox.className = 'quiz-explanation-box show incorrect';
          expBox.innerHTML = `<div class="quiz-feedback-header"><span class="score-chip bad">+0</span> <span class="feedback-verdict">Incorrect.</span></div><p class="quiz-explanation-text">${q.explanation}</p>`;
        }

        answeredCount += 1;

        if (answeredCount === QUIZ_QUESTIONS.length) {
          const scoreCard = document.getElementById('quiz-score-card');
          const finalScoreEl = document.getElementById('quiz-final-score');
          const scoreHeading = document.getElementById('quiz-score-heading');
          const scoreMsg = document.getElementById('quiz-score-msg');

          finalScoreEl.textContent = `${score} / ${QUIZ_QUESTIONS.length}`;

          if (score === QUIZ_QUESTIONS.length) {
            scoreHeading.textContent = 'Outstanding! Perfect Score 🎉';
            scoreMsg.textContent =
              'You have mastered text chunking principles for RAG! You are ready to build and evaluate chunking pipelines in production.';
          } else if (score >= 4) {
            scoreHeading.textContent = 'Great Job! 👏';
            scoreMsg.textContent =
              'You have a solid grasp of document cleaning, chunk boundaries, and retrieval quality. Review the recap below for full mastery.';
          } else {
            scoreHeading.textContent = 'Review Recommended 📚';
            scoreMsg.textContent =
              'Check out the section recap below to refresh on overlap, recursive splitting, and context boundaries.';
          }

          scoreCard.classList.add('show');

          if (window.ChunkLab && typeof window.ChunkLab.emit === 'function') {
            window.ChunkLab.emit('section-complete', { id: 's7' });
          }
        }
      });
    });

    // Attach Accordion handlers
    const accordionBtns = mountEl.querySelectorAll('.accordion-btn');
    accordionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        const panelId = btn.getAttribute('aria-controls');
        const panel = document.getElementById(panelId);
        const icon = btn.querySelector('.accordion-icon');

        btn.setAttribute('aria-expanded', String(open));
        if (panel) panel.classList.toggle('open', open);
        if (icon) icon.textContent = open ? '−' : '+';
      });
    });
  }

  window.ChunkLabQuiz = {
    init: initQuiz,
  };
})();
