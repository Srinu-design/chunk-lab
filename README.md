# Chunk Lab: Text Chunking for RAG

**Chunk Lab** is an interactive 45-minute lesson on text chunking and document processing for Retrieval-Augmented Generation (RAG) (Kalvium Instructional Designer task, topic 5). Styled after an assessment console with fixed meta overview and step rail, it is self-paced by default for independent learners and features an instructor-ready Slides presentation mode that displays each section on a warm paper background.

---

## Open it

- **Live Site**: [https://srinu-design.github.io/chunk-lab/](https://srinu-design.github.io/chunk-lab/)
- **Run locally**:
  ```bash
  python3 -m http.server 8000
  ```
  Then open [http://localhost:8000/](http://localhost:8000/) in your browser.

*Note:* Opening `index.html` directly as a local file (`file:///...`) does not work because browser security policies block `fetch()` from loading the text datasets in `data/` and initializing the Pyodide Web Worker over the `file://` protocol.

---

## What's inside

| Section | Title | Duration | Interaction |
| :--- | :--- | :--- | :--- |
| **s1** | Why chunk at all | 4 min | Visual reading-window overflow demo, 3 core reasons, Predict question |
| **s2** | Cleaning the document | 5 min | Live regex toggles (headers/footers, hyphens, spaces), live diff & word count |
| **s3** | Fixed-size chunks | 8 min | Sliders rewrite Python code live; chunks drawn as tinted blocks with answer checks |
| **s4** | Smarter splits | 8 min | Recursive call tree visualization comparing fixed, sentence, and recursive splits |
| **s5** | Game: Rescue the Answer | 10 min | Interactive tuning challenge to rescue answers within a 60-word budget |
| **s6** | Chunking in real apps | 4 min | Production RAG pipeline diagram, domain heuristics table, token math |
| **s7** | Knowledge check | 6 min | 6 realistic multiple-choice questions, scoring, and expandable recap accordion |

Total: 45 minutes.

---

## How it works

All Python code runs directly in the learner's browser using Pyodide inside a background Web Worker, ensuring student experiments and infinite loops cannot freeze the user interface. The source code displayed in the browser editors is loaded dynamically from the tested files in `py/`, ensuring the lesson displays the exact code validated by the test suite. No build step, backend server, or API keys are required.

---

## Tests

Run the Python lesson suite:

```bash
python3 -m pytest -q
```

---

## How AI was used

I managed Chunk Lab and wrote the lesson plan, the help-centre sample data, and the lesson text. I decided what to include, what the quiz should test, and what to simplify. I tested the lesson in the browser and asked for fixes.

I used Codex to generate the Python code and the three interactive activities in sections 3–5. I used Antigravity to generate the page layout and Slides mode.

Every Python function the editors show is covered by `tests/test_lesson.py`, and the page loads that same tested code. I can explain how each part works.

---

## Publish on GitHub Pages

To publish Chunk Lab on GitHub Pages:

1. In your GitHub repository, open **Settings**.
2. Select **Pages** from the left navigation menu.
3. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)` folder, then click **Save**.
