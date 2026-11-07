# AGENTS.md: rules for every coding agent

Chunk Lab is a single static web page: a 45-minute interactive lesson on text chunking for RAG. Read `docs/SPEC.md` for the lesson design. Two agents work in parallel on separate branches, so **only edit files your role owns**.

## Run it

```bash
python3 -m http.server 8500   # Codex (repo chunk-lab)
python3 -m http.server 8501   # Antigravity (worktree chunk-lab-ag)
```

Open `http://localhost:<port>/`. Opening `index.html` as a file does not work (the page fetches `data/` and `py/`).

```bash
python3 -m pytest -q          # Python lesson code tests (needs pytest only)
```

## Hard rules

- No build step, no npm, no framework, no bundler. Plain HTML, CSS and JavaScript (ES2020, no modules) plus Python 3.11+ standard library only in `py/`.
- External code only from these pinned CDNs, nothing else:
  - Pyodide `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js`
  - CodeMirror 5.65.16 from `https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/` (`codemirror.min.js`, `codemirror.min.css`, `mode/python/python.min.js`)
  - Font: Figtree from Google Fonts (weights 400, 500, 600, 700)
- Do not edit files you do not own. If you need a change in one, say so in your report to the manager and work around it.
- Do not edit `AGENTS.md`, `docs/SPEC.md`, `js/namespace.js` or anything in `data/` (owned by the manager).
- Every displayed number is rounded. Every slider and button has a visible label or `aria-label`. Pass/fail is shown with text and an icon, never colour alone. Everything works with the keyboard.
- Layout works from 360px wide (stack columns below 760px) up to 1440px.
- Lesson text: short sentences, plain words, second person ("you"). Mark draft paragraphs the owner should rewrite with `data-draft` on the element.
- Do not use the Kalvium logo or name in the page UI. Only the footer credit line may mention the task.
- Commit only on your own branch, small commits with clear messages. Never push, never force anything, never add co-author trailers.

## File ownership

I managed Chunk Lab and wrote the lesson plan, sample data, and lesson text. I decided what to include, what the quiz should test, and what to simplify. Codex generated the Python code and the three interactive activities in sections 3–5. Antigravity generated the page layout and Slides mode.

| Path | Role responsible for edits |
|------|----------------------------|
| `index.html`, `css/theme.css`, `css/layout.css`, `js/app.js`, `js/clean-doc.js`, `js/quiz.js`, `README.md`, `.github/` | Antigravity |
| `py/`, `tests/`, `js/py-runner.js`, `js/py-worker.js`, `js/widgets/`, `css/widgets.css` | Codex |
| `AGENTS.md`, `docs/`, `data/`, `js/namespace.js` | Manager |

## Page contract

`index.html` loads, in this order:

1. Figtree font, `codemirror.min.css`, `css/theme.css`, `css/layout.css`, `css/widgets.css`
2. `codemirror.min.js`, `mode/python/python.min.js`
3. `js/namespace.js`, `js/py-runner.js`, `js/widgets/fixed-chunks.js`, `js/widgets/recursive-tree.js`, `js/widgets/rescue-game.js`, `js/clean-doc.js`, `js/quiz.js`, `js/app.js` (all with `defer`, in this order)

A missing widget file must not break the page: `app.js` shows a quiet "This activity is loading" placeholder for any mount point without a registered widget.

Sections are `<section class="lesson-section" id="s1" data-minutes="4" data-title="Why chunk at all">` through `s7`. Widget mount points are `<div class="widget" data-widget="fixed-chunks"></div>` (in s3), `recursive-tree` (s4), `rescue-game` (s5).

### Global `window.ChunkLab` (defined in `js/namespace.js`)

- `ChunkLab.loadData()` → `Promise<{doc, rawDoc, questions}>`; also sets `ChunkLab.data`.
- `ChunkLab.widgets[name] = { mount(el, ctx) }`: widgets register themselves; `app.js` calls `mount` once per mount point after `loadData()` resolves, with `ctx = { data, py: ChunkLab.py, mode }` where `mode()` returns `"lesson"` or `"slides"`.
- `ChunkLab.emit(name, detail)` / `ChunkLab.on(name, handler)`: page events, dispatched as `chunklab:<name>` on `document`. Defined events:
  - `mode-change` `{mode}`: emitted by `app.js` when Lesson/Slides switches.
  - `section-complete` `{id}`: emitted by a widget when its Prove goal is met (s3, s4, s5); `app.js` ticks that section in the progress bar.

### `ChunkLab.py` (defined in `js/py-runner.js`, Codex)

Pyodide runs in a Web Worker (`js/py-worker.js`) so a learner's infinite loop cannot freeze the page.

- `ready` → `Promise` resolved when Pyodide and `py/*.py` are loaded. While loading, widgets show "Loading Python…".
- `source(module, fn)` → `Promise<string>`: the code between `# >>> fn` and `# <<< fn` marker lines in `py/<module>.py`. Widgets prefill their editor with this, so the page shows exactly the tested code.
- `call(code, fn, args)` → `Promise<{ok: true, value} | {ok: false, error, line}>`: runs `code` in a fresh namespace (the `chunkers` and `search` modules are importable), calls `fn(*args)`, returns the result as plain JS data. Errors come back as one friendly sentence plus the line number, never a raw traceback.
- `trace(code, fn, args)` → same as `call` plus `calls: [{id, parent, depth, args, result}]`, one entry per call of `fn` (recursion), capped at 200 calls.
- Any run longer than 2 seconds is stopped, the worker restarts, and the result is `{ok: false, error: "Your code ran for more than 2 seconds. Check for a loop that never ends."}`.

## Theme (Kalvium-inspired, light only)

`css/theme.css` defines these custom properties on `:root`; every other stylesheet uses only these variables.

```css
--red: #EF3837;        /* brand: buttons, keyword boxes, progress */
--red-dark: #CF2524;   /* hover, pressed */
--red-tint: #FDECEC;   /* chunk tint A, soft panels */
--ink: #000000;        /* headings, body text */
--ink-2: #333333;      /* secondary text */
--dark: #222222;       /* code panels, slides background, footer */
--gray: #EAE5E5;       /* chunk tint B, accordion rows */
--soft: #F7F9FB;       /* page sections */
--white: #FFFFFF;
--ok: #1E7F3C;         /* pass text and icon */
--ok-tint: #E6F4EA;
--radius: 5px;
--font: "Figtree", system-ui, sans-serif;
--mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
```

Signature patterns: the key word of a heading sits in a red box with white text (`<span class="kw">builder</span>`); feature cards are red with white text; accordions are gray rows with a red plus or minus; buttons are solid red, 5px corners, 12px 24px padding, weight 600. Headings are Figtree 600, body 400.

### Round 4 additions: assessment-console style

From round 4 the page also follows the look of Kalvium's assessment screens: a warm paper background, a fixed left panel, a vertical rail of square step boxes, black 2px outlines with hard offset shadows, and dashed amber callouts. Add these variables to `:root` (keep all the ones above):

```css
--paper: #DAD6CF;      /* page background */
--paper-2: #E4E0D9;    /* left panel, quiet cards */
--card: #F4F1EC;       /* reading surfaces and widget cards */
--line: #1A1A1A;       /* 2px outlines, step boxes, rail */
--shadow-hard: 3px 3px 0 #1A1A1A;
--blue: #2D5FC4;       /* status: done */
--orange: #D9822B;     /* status: marked for later */
--amber-line: #D4A23A; /* dashed callout border */
--amber-tint: #E6DCCB; /* dashed callout background */
--purple: #6B5B8E;     /* primary navigation buttons (Next, Previous) */
--good-chip: #CFE3D0;  /* "+1 correct" chip, text --ok */
--bad-chip: #EBC8C8;   /* "try again" chip, text --red-dark */
```

Rules: buttons that move between sections are `--purple` with white text, a 2px `--line` border and `--shadow-hard`; action buttons inside activities stay red. Predict and Prove boxes are dashed amber callouts. Section status symbols are a blue filled circle (done), an outlined square (not started), an orange pentagon (marked for later) and an orange pentagon with a blue dot (marked for later but done). Do not copy Kalvium's logo, illustrations or assessment wording.
