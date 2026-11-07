// js/app.js - Chunk Lab Application Controller & Presentation Engine
(function () {
  'use strict';

  const SECTIONS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
  let currentMode = 'lesson';
  let currentSlideIndex = 0;
  const completedSections = new Set();
  const markedSections = new Set();
  let currentActiveSectionId = 's1';

  // Safe localStorage helpers
  function getStorage(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setStorage(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      // Ignore storage errors if disabled/blocked
    }
  }

  // Load and save marked sections
  function loadMarkedSections() {
    try {
      const saved = JSON.parse(getStorage('chunklab_marked', 'null'));
      if (Array.isArray(saved)) {
        saved.forEach((id) => {
          if (SECTIONS.includes(id)) markedSections.add(id);
        });
      }
    } catch (e) {
      // Ignore JSON/storage errors
    }
  }

  function saveMarkedSections() {
    setStorage('chunklab_marked', JSON.stringify(Array.from(markedSections)));
  }

  // Calculate and update time remaining
  function updateTimeRemaining() {
    const timeElements = document.querySelectorAll('.time-remaining');
    if (!timeElements.length) return;

    let totalMinutesLeft = 0;
    SECTIONS.forEach((id) => {
      if (!completedSections.has(id)) {
        const secEl = document.getElementById(id);
        if (secEl) {
          const mins = parseInt(secEl.getAttribute('data-minutes'), 10) || 0;
          totalMinutesLeft += mins;
        }
      }
    });

    const roundedMins = Math.round(totalMinutesLeft);
    const text =
      completedSections.size === SECTIONS.length
        ? 'All complete! 🎉'
        : window.innerWidth <= 480
        ? `${roundedMins}m left`
        : `about ${roundedMins} min left`;

    timeElements.forEach((el) => {
      el.textContent = text;
    });
  }

  // Update Rail step box states, symbols, and accessible labels
  function updateRail() {
    SECTIONS.forEach((id, idx) => {
      const num = idx + 1;
      const boxEl = document.querySelector(`.rail-box[data-step="${id}"]`);
      if (!boxEl) return;

      const isDone = completedSections.has(id);
      const isMarked = markedSections.has(id);
      const isCurrent = currentActiveSectionId === id;
      const secEl = document.getElementById(id);
      const title = (secEl && secEl.getAttribute('data-title')) || `Section ${num}`;

      // Update state classes
      boxEl.classList.toggle('current', isCurrent);
      boxEl.classList.toggle('done', isDone);
      boxEl.classList.toggle('marked', isMarked);

      // Build aria-label: e.g. "Section 3, Fixed-size chunks, done, marked for later"
      const labelParts = [`Section ${num}`, title];
      if (isDone) labelParts.push('done');
      if (isMarked) labelParts.push('marked for later');
      if (!isDone && !isMarked && !isCurrent) labelParts.push('not started');
      if (isCurrent) labelParts.push('current step');

      boxEl.setAttribute('aria-label', labelParts.join(', '));
    });

    // On mobile screens (<1100px), keep current step box centred in horizontal rail scroller
    if (window.innerWidth < 1100) {
      const currentBox = document.querySelector(`.rail-box[data-step="${currentActiveSectionId}"]`);
      if (currentBox) {
        const row = currentBox.closest('.rail-steps') || currentBox.closest('.console-rail');
        if (row && typeof row.scrollTo === 'function') {
          const targetLeft =
            currentBox.offsetLeft - (row.clientWidth - currentBox.offsetWidth) / 2;
          row.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
        }
      }
    }
  }

  // Update Mark for Later button UI
  function updateSectionMarkUI(id) {
    const btn = document.querySelector(`.btn-mark-later[data-mark-section="${id}"]`);
    if (!btn) return;
    const isMarked = markedSections.has(id);
    btn.setAttribute('aria-pressed', isMarked ? 'true' : 'false');
    const labelEl = btn.querySelector('.mark-label');
    if (labelEl) {
      labelEl.textContent = isMarked ? 'Marked for later' : 'Mark for later';
    }
  }

  // Toggle Mark for Later for a section
  function toggleMarkSection(id) {
    if (!id) return;
    if (markedSections.has(id)) {
      markedSections.delete(id);
    } else {
      markedSections.add(id);
    }
    saveMarkedSections();
    updateSectionMarkUI(id);
    updateRail();
  }

  // Mark section completed
  function markSectionCompleted(id) {
    if (!id || completedSections.has(id)) return;
    completedSections.add(id);
    updateRail();
    updateTimeRemaining();
  }

  // Set active section
  function setActiveSection(id) {
    if (!id || currentActiveSectionId === id) return;
    currentActiveSectionId = id;
    updateRail();
  }

  // Measure Slides Header & Controller dimensions and update CSS variables
  function updateSlidesDimensions() {
    const header = document.querySelector('.slides-header');
    const controller = document.querySelector('.slides-controller');
    if (header) {
      const hHeight = header.offsetHeight;
      if (hHeight > 0) {
        document.documentElement.style.setProperty('--slides-header-height', `${hHeight}px`);
      }
    }
    if (controller) {
      const cHeight = controller.offsetHeight;
      if (cHeight > 0) {
        document.documentElement.style.setProperty('--slides-controller-height', `${cHeight}px`);
      }
    }
  }

  // Slides navigation
  function showSlide(index) {
    if (index < 0) index = 0;
    if (index >= SECTIONS.length) index = SECTIONS.length - 1;
    currentSlideIndex = index;

    const targetId = SECTIONS[currentSlideIndex];
    currentActiveSectionId = targetId;

    SECTIONS.forEach((id, idx) => {
      const secEl = document.getElementById(id);
      if (secEl) {
        if (idx === currentSlideIndex) {
          secEl.classList.add('active-slide');
          const scroller = secEl.querySelector('.slide-body') || secEl;
          scroller.scrollTop = 0;
        } else {
          secEl.classList.remove('active-slide');
        }
      }
    });

    // Update slides controller
    const counterEl = document.getElementById('slide-counter');
    const prevBtn = document.getElementById('btn-slide-prev');
    const nextBtn = document.getElementById('btn-slide-next');

    if (counterEl) {
      counterEl.textContent = `${currentSlideIndex + 1} / ${SECTIONS.length}`;
    }
    if (prevBtn) {
      prevBtn.disabled = currentSlideIndex === 0;
    }
    if (nextBtn) {
      nextBtn.disabled = currentSlideIndex === SECTIONS.length - 1;
    }

    // Keep URL hash in sync without triggering full jump
    try {
      history.replaceState(null, '', `#${targetId}`);
    } catch (e) {
      window.location.hash = `#${targetId}`;
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // Update mode toggle buttons state
  function updateModeUI(mode) {
    document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
      const btnMode = btn.getAttribute('data-mode-btn');
      const isActive = btnMode === mode;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.classList.toggle('active', isActive);
    });
  }

  function setMode(mode) {
    currentMode = mode;
    setStorage('chunklab_mode', mode);
    updateModeUI(mode);

    if (mode === 'slides') {
      document.body.classList.add('slides');
      updateSlidesDimensions();
      requestAnimationFrame(() => {
        updateSlidesDimensions();
      });

      // Determine initial slide from currentActiveSectionId or hash
      const hashId = (window.location.hash || '').replace('#', '');
      const initialId = SECTIONS.includes(hashId) ? hashId : currentActiveSectionId;
      const targetIdx = SECTIONS.indexOf(initialId);
      showSlide(targetIdx !== -1 ? targetIdx : 0);
    } else {
      document.body.classList.remove('slides');

      // Remove active-slide classes
      SECTIONS.forEach((id) => {
        const secEl = document.getElementById(id);
        if (secEl) secEl.classList.remove('active-slide');
      });

      // Restore position in lesson view with reflow compensation
      const targetId = SECTIONS[currentSlideIndex] || 's1';
      requestAnimationFrame(() => {
        setTimeout(() => {
          const targetSec = document.getElementById(targetId);
          if (targetSec) scrollToLessonSection(targetSec, 'auto');
        }, 50);
      });
    }

    if (window.ChunkLab && typeof window.ChunkLab.emit === 'function') {
      window.ChunkLab.emit('mode-change', { mode: currentMode });
    }
  }

  function scrollToLessonSection(section, behavior) {
    const rail = document.querySelector('.console-rail');
    const offset = window.innerWidth < 1100 && rail ? rail.offsetHeight + 10 : 20;
    const top = section.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, top), behavior });
    setActiveSection(section.id);
  }

  function scrollToSection(id) {
    if (!id) return;
    const targetSec = document.getElementById(id);
    if (!targetSec) return;

    if (currentMode === 'slides') {
      const idx = SECTIONS.indexOf(id);
      if (idx !== -1) showSlide(idx);
    } else {
      scrollToLessonSection(targetSec, 'smooth');
      try {
        history.pushState(null, '', `#${id}`);
      } catch (err) {}
    }
  }

  function initPrediction(id, blockId, feedbackId, success, failure) {
    const block = document.getElementById(blockId);
    if (!block) return;

    const choiceAttribute = `data-${id}-choice`;
    const buttons = block.querySelectorAll(`[${choiceAttribute}]`);
    const feedback = document.getElementById(feedbackId);
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((other) => other.classList.remove('selected'));
        button.classList.add('selected');

        const correct = button.getAttribute(choiceAttribute) === 'no';
        feedback.className = correct ? 'feedback-alert show success' : 'feedback-alert show error';
        feedback.innerHTML = correct ? success : failure;
        if (correct) {
          markSectionCompleted(id);
          if (window.ChunkLab && typeof window.ChunkLab.emit === 'function') {
            window.ChunkLab.emit('section-complete', { id });
          }
        }
      });
    });
  }

  // Setup IntersectionObserver for Progress Rail tracking
  function initScrollTracking() {
    const observer = new IntersectionObserver(
      (entries) => {
        if (currentMode === 'slides') return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (SECTIONS.includes(id)) {
              setActiveSection(id);
            }
          }
        });
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    );

    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  // Mount widgets or render placeholder
  function mountWidgets(data) {
    const mountElements = document.querySelectorAll('.widget[data-widget]');
    mountElements.forEach((mountEl) => {
      const widgetName = mountEl.getAttribute('data-widget');
      const widgetDef =
        window.ChunkLab && window.ChunkLab.widgets && window.ChunkLab.widgets[widgetName];

      if (widgetDef && typeof widgetDef.mount === 'function') {
        mountEl.innerHTML = '';
        try {
          widgetDef.mount(mountEl, {
            data,
            py: window.ChunkLab ? window.ChunkLab.py : undefined,
            mode: () => currentMode,
          });
        } catch (err) {
          console.error(`Error mounting widget ${widgetName}:`, err);
          mountEl.innerHTML = `
            <div class="activity-loading" role="alert">
              <p>Error loading activity "${widgetName}".</p>
            </div>
          `;
        }
      } else {
        // Quiet loading placeholder
        mountEl.innerHTML = `
          <div class="activity-loading" role="status">
            <div class="spinner" aria-hidden="true"></div>
            <p>This activity is loading.</p>
          </div>
        `;
      }
    });
  }

  // Initialize Page
  document.addEventListener('DOMContentLoaded', () => {
    // Load saved marks
    loadMarkedSections();

    // Mode toggles
    document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetMode = btn.getAttribute('data-mode-btn');
        if (targetMode) setMode(targetMode);
      });
    });

    // Slides controller buttons
    const prevBtn = document.getElementById('btn-slide-prev');
    const nextBtn = document.getElementById('btn-slide-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => showSlide(currentSlideIndex - 1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => showSlide(currentSlideIndex + 1));
    }

    // Keyboard navigation for slides
    window.addEventListener('keydown', (e) => {
      if (currentMode !== 'slides') return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const tag = (e.target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.target.closest && e.target.closest('.CodeMirror')) return;

      e.preventDefault();

      if (e.key === 'ArrowLeft') {
        showSlide(currentSlideIndex - 1);
      } else if (e.key === 'ArrowRight') {
        showSlide(currentSlideIndex + 1);
      }
    });

    // Mark for later buttons
    document.querySelectorAll('.btn-mark-later[data-mark-section]').forEach((btn) => {
      const sectionId = btn.getAttribute('data-mark-section');
      updateSectionMarkUI(sectionId);
      btn.addEventListener('click', () => {
        toggleMarkSection(sectionId);
      });
    });

    // Navigation buttons between sections
    document.querySelectorAll('.btn-nav-prev, .btn-nav-next').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        if (targetId) scrollToSection(targetId);
      });
    });

    // Start lesson CTA button
    const startLessonBtn = document.getElementById('btn-start-lesson');
    if (startLessonBtn) {
      startLessonBtn.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToSection('s1');
      });
    }

    // Back to top button
    document.querySelectorAll('.btn-nav-top').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSec = document.getElementById('before-start') || document.getElementById('s1');
        if (targetSec) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    // Rail box links
    document.querySelectorAll('.rail-box[data-step]').forEach((box) => {
      box.addEventListener('click', (e) => {
        e.preventDefault();
        const stepId = box.getAttribute('data-step');
        if (stepId) scrollToSection(stepId);
      });
    });

    // Listen for section-complete events
    if (window.ChunkLab && typeof window.ChunkLab.on === 'function') {
      window.ChunkLab.on('section-complete', (detail) => {
        if (detail && detail.id) {
          markSectionCompleted(detail.id);
        }
      });
    }

    initPrediction(
      's1', 's1-predict-block', 's1-predict-feedback',
      '<strong>✓ Correct!</strong> Pieces that small lose the context the answer needs. A 10-word fragment like "Damaged items can be returned within 60 days if you" gets cut off before "upload a photo of the damage". When pieces are too small, conditions separate from rules, and the retriever loses critical meaning.',
      '<strong>❌ Not quite.</strong> While 10 words sounds precise, sentences get sliced in half mid-thought. The condition "upload a photo" gets detached from "within 60 days", leaving the model unable to confirm the actual policy.'
    );
    initPrediction(
      's6', 's6-prove-block', 's6-feedback',
      '<strong>✓ Correct!</strong> If an answer sentence is partially truncated, the model does not have the complete fact. It may hallucinate the missing details or give incomplete instructions to the user. Always measure ground-truth completeness!',
      '<strong>❌ Incorrect.</strong> An 80% answer sentence means 20% of critical conditions or figures are missing. In real RAG apps, missing text leads directly to hallucinations.'
    );

    // Check initial hash
    const initialHash = (window.location.hash || '').replace('#', '');
    if (SECTIONS.includes(initialHash)) {
      currentActiveSectionId = initialHash;
      currentSlideIndex = SECTIONS.indexOf(initialHash);
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToSection(initialHash);
        }, 100);
      });
    }

    // Init Rail and UI
    updateRail();
    updateTimeRemaining();
    let resizeFrame;
    window.addEventListener('resize', () => {
      if (resizeFrame !== undefined) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = undefined;
        updateTimeRemaining();
        updateRail();
        if (currentMode === 'slides') updateSlidesDimensions();
      });
    });

    // Init Scroll Tracking
    initScrollTracking();

    // Check saved mode or default
    const savedMode = getStorage('chunklab_mode', 'lesson');
    setMode(savedMode === 'slides' ? 'slides' : 'lesson');

    // Load lesson data
    const alertContainer = document.getElementById('global-alert-container');

    if (window.ChunkLab && typeof window.ChunkLab.loadData === 'function') {
      window.ChunkLab.loadData()
        .then((data) => {
          // Mount interactive widgets
          mountWidgets(data);

          // Mount Clean Doc in Section 2
          if (window.ChunkLabCleanDoc && typeof window.ChunkLabCleanDoc.init === 'function') {
            window.ChunkLabCleanDoc.init();
          }

          // Mount Quiz in Section 7
          if (window.ChunkLabQuiz && typeof window.ChunkLabQuiz.init === 'function') {
            window.ChunkLabQuiz.init();
          }
        })
        .catch((err) => {
          console.error('Failed to load ChunkLab data:', err);
          if (alertContainer) {
            alertContainer.innerHTML = `
              <div class="alert-error" role="alert">
                <p><strong>Couldn't load the lesson files.</strong> Open this page through a local server (see README).</p>
              </div>
            `;
          }
        });
    }
  });
})();
