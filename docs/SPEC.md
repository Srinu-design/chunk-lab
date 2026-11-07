# Chunk Lab: lesson spec

An interactive 45-minute lesson on **Text Chunking and Document Processing for RAG** (Kalvium Instructional Designer task, topic 5). One static page; learners edit real Python that runs in the browser and see its output drawn.

## Lesson authorship

I managed the project and wrote the lesson plan, sample data, and lesson text. I chose what to cover, what the quiz should test, and where to simplify. Codex generated the Python code and the three interactive activities in sections 3–5. Antigravity generated the page layout and Slides mode.

## Audience and format

- Students who know basic Python and have heard of LLMs, but have not built RAG.
- Self-paced by default. A **Lesson / Slides** switch shows the same seven sections one per screen for an instructor.

## Learning objectives

By the end, a learner can:

1. Explain why documents are cut into chunks before retrieval (context limits, retrieval precision, cost).
2. Clean extracted PDF text (page headers, footers, hyphenated line breaks, extra spaces) and say why it matters.
3. Implement fixed-size chunking with overlap and predict how `size` and `overlap` change the chunks.
4. Compare fixed, sentence and recursive splitting, and read a recursive splitter's call tree.
5. Tune chunking so retrieval returns whole answers within a word budget.
6. Pick sensible starting settings for a real app and know what to measure.

## Section beats

Every interactive section follows **Predict → Play → Peek → Prove**: one guess before touching anything, the interactive window, the live code beside it, then a small goal or question.

| # | id | Section | Min | Interaction | Code implementation |
|---|----|---------|-----|-------------|-------|
| 1 | s1 | Why chunk at all | 4 | A help-desk bot answers wrong because the whole document did not fit. Small static illustration plus one predict question. | Antigravity |
| 2 | s2 | Cleaning the document | 5 | `data/help-centre-raw.txt` shown with three toggles: remove page headers/footers, join hyphenated line breaks, collapse spaces. Live word count and a diff-style highlight of what was removed. Static code snippet of the cleaning regexes next to it. | Antigravity |
| 3 | s3 | Fixed-size chunks | 8 | Widget `fixed-chunks`: editable `chunk_fixed`, size and overlap sliders that rewrite the numbers in the code, chunks drawn as tinted blocks, answer words underlined, verdict "answer whole / answer cut". | Codex |
| 4 | s4 | Smarter splits | 8 | Widget `recursive-tree`: editable `chunk_recursive` (plain recursion). Each recursive call is drawn as a node in a tree (separator used, words in, chunks out). A strategy switch compares fixed, sentence and recursive output on the same text. | Codex |
| 5 | s5 | Game: Rescue the Answer | 10 | Widget `rescue-game`: pick strategy, size, overlap. For each of the 3 questions, keyword search returns the top chunk. Win when every top chunk contains the whole answer sentence and is within the 60-word budget. | Codex |
| 6 | s6 | Chunking in real apps | 4 | Where chunking sits in a RAG pipeline (diagram), starting settings for support bots, legal documents and code, and what to measure (does the top chunk contain the answer?). Words, not tokens: one token is roughly three quarters of a word. | Antigravity |
| 7 | s7 | Knowledge check | 6 | Six multiple-choice questions with an explanation after each answer, score at the end, recap accordion. | Antigravity |

Total: 45 minutes.

## Game rules (section 5)

- Document: `data/help-centre.txt`. Questions and exact answer sentences: `data/questions.json`.
- Retrieval: `search.top_chunk(question, chunks)` scores each chunk by how many distinct question keywords it contains (lowercase, simple suffix stemming, small stopword list); ties go to the earlier chunk.
- A question is **rescued** when its top chunk contains the full answer sentence (whitespace-normalised) and has at most 60 words.
- The learner wins when all three are rescued. The default setting (fixed, size 40, overlap 0) must lose; at least one fixed setting and the recursive strategy must win. Tests prove both.

## Out of scope

Real tokenizers, embeddings or any model download, accounts, a backend, analytics.
