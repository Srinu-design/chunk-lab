import ast
import json
import re
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "py"))
from chunkers import chunk_fixed, chunk_recursive, chunk_sentences
from search import evaluate, keywords, score, top_chunk

DOC = (ROOT / "data/help-centre.txt").read_text(encoding="utf-8")
QUESTIONS = json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))


def test_fixed_overlap_stops_at_the_end():
    assert chunk_fixed("one two three four five", 3, 2) == [
        "one two three", "two three four", "three four five",
    ]
    assert chunk_fixed(" \t\n", 3, 2) == []


@pytest.mark.parametrize("size, overlap", [(0, 0), (3, -1), (3, 3), (3, 4), (2.5, 0)])
def test_fixed_rejects_invalid_settings(size, overlap):
    with pytest.raises(ValueError):
        chunk_fixed(DOC, size, overlap)


@pytest.mark.parametrize("size, overlap", [(1, 0), (12, 0), (27, 13), (50, 49), (200, 30)])
def test_fixed_can_recover_all_words_in_order(size, overlap):
    chunks = chunk_fixed(DOC, size, overlap)
    recovered = chunks[0].split()
    for chunk in chunks[1:]:
        recovered.extend(chunk.split()[overlap:])
    assert recovered == DOC.split()


def test_sentence_boundaries_and_oversize_sentence():
    text = "One two? Three four! Five six. Seven eight\n \nNine ten eleven twelve thirteen."
    assert chunk_sentences(text, 4) == [
        "One two? Three four!", "Five six. Seven eight", "Nine ten eleven twelve thirteen.",
    ]
    assert chunk_sentences("one two\n\nthree four", 2) == ["one two", "three four"]
    assert chunk_sentences(" \t\n", 4) == []


def test_sentences_preserve_document_words_within_budget():
    chunks = chunk_sentences(DOC, 30)
    assert " ".join(chunks).split() == DOC.split()
    assert all(len(chunk.split()) <= 30 for chunk in chunks)


def test_recursive_splits_document_and_calls_itself():
    calls = []

    def profile(frame, event, _):
        if event == "call" and frame.f_code is chunk_recursive.__code__:
            calls.append(frame.f_back.f_code)

    previous_profile = sys.getprofile()
    sys.setprofile(profile)
    try:
        chunks = chunk_recursive(DOC, 12)
    finally:
        sys.setprofile(previous_profile)

    assert chunk_recursive.__code__ in calls
    assert all(0 < len(chunk.split()) <= 12 for chunk in chunks)
    assert " ".join(chunks).split() == DOC.split()


def test_recursive_keeps_punctuation_and_unsplittable_pieces():
    assert chunk_recursive("One two. Three four.", 2) == ["One two.", "Three four."]
    assert chunk_recursive("one two three", 2, ("\n",)) == ["one two three"]
    assert chunk_recursive(" \t\n", 2) == []


def test_real_question_keywords():
    assert [keywords(row["question"]) for row in QUESTIONS] == [
        {"long", "return", "damag", "item"},
        {"long", "refund", "tak", "reach", "payment", "method"},
        {"return", "gift", "card"},
    ]
    assert keywords("a an the I do to my me is of how can does have what when will in for") == set()
    assert keywords("Testing tested boxes cats cat 60 A_1") == {"test", "box", "cat", "60", "1"}


def test_score_counts_distinct_terms_and_ties_pick_the_first_chunk():
    assert score("refund refund", "Refunds refunded twice") == 1
    assert top_chunk("refund", ["no match", "refunds", "refunded"]) == 1
    assert top_chunk("refund", ["no match", "no match here"]) == 0


def test_evaluate_normalizes_whitespace_and_checks_the_budget():
    question = {"id": "q", "question": "refund", "answer": "Refund takes a week."}
    chunk = "Refund\n takes a\tweek."
    assert evaluate([chunk], [question], budget=3) == [{
        "id": "q", "top_index": 0, "top_chunk": chunk, "words": 4,
        "has_answer": True, "rescued": False,
    }]
    assert evaluate([chunk], [question], budget=4)[0]["rescued"]
    assert not evaluate([], [question])[0]["rescued"]


def test_game_can_be_won_with_fixed_and_recursive_chunks():
    def wins(chunks):
        return all(row["rescued"] for row in evaluate(chunks, QUESTIONS))

    default = evaluate(chunk_fixed(DOC, 40, 0), QUESTIONS)
    assert [row["rescued"] for row in default] == [True, True, False]
    assert wins(chunk_fixed(DOC, 26, 1))
    assert any(
        wins(chunk_fixed(DOC, size, overlap))
        for size in range(10, 61)
        for overlap in range(min(size, 31))
    )
    assert wins(chunk_recursive(DOC, 60))


@pytest.mark.parametrize("module", ["chunkers", "search"])
def test_public_functions_are_marked_for_the_editor(module):
    source = (ROOT / "py" / f"{module}.py").read_text(encoding="utf-8")
    lines = source.splitlines()
    for node in ast.parse(source).body:
        if isinstance(node, ast.FunctionDef) and not node.name.startswith("_"):
            start, end = f"# >>> {node.name}", f"# <<< {node.name}"
            assert lines.count(start) == lines.count(end) == 1
            assert lines[node.lineno - 2] == start
            assert lines[node.end_lineno] == end


def test_game_par_matches_the_exhaustive_minimum():
    wins = []

    def record(strategy, size, overlap, chunks):
        rows = evaluate(chunks, QUESTIONS)
        if all(row["rescued"] for row in rows):
            wins.append((sum(row["words"] for row in rows), strategy, size, overlap))

    for size in range(10, 81):
        for overlap in range(min(31, size)):
            record("fixed", size, overlap, chunk_fixed(DOC, size, overlap))
        record("sentences", size, 0, chunk_sentences(DOC, size))
        record("recursive", size, 0, chunk_recursive(DOC, size))

    source = (ROOT / "js/widgets/rescue-game.js").read_text(encoding="utf-8")
    par = int(re.search(r"const PAR = (\d+);", source)[1])
    minimum = min(row[0] for row in wins)
    assert par == minimum
    assert [row for row in wins if row[0] == minimum] == [
        (43, "recursive", size, 0) for size in range(17, 21)
    ]


def test_lowering_the_default_can_reach_the_sentence_goal():
    source = (ROOT / "js/widgets/recursive-tree.js").read_text(encoding="utf-8")
    default = int(re.search(r"const DEFAULT_LIMIT = (\d+);", source)[1])
    reached = set()

    def profile(frame, event, _):
        if event == "call" and frame.f_code is chunk_recursive.__code__:
            if frame.f_locals["separators"][:1] == (". ",):
                reached.add(frame.f_locals["max_words"])

    previous_profile = sys.getprofile()
    sys.setprofile(profile)
    try:
        for size in range(15, 81):
            chunk_recursive(DOC, size)
    finally:
        sys.setprofile(previous_profile)

    assert default == 50
    assert default not in reached
    assert reached == set(range(15, 42))


@pytest.mark.parametrize(
    "chunks, expected",
    [(chunk_fixed(DOC, 40, 0), 2), (chunk_sentences(DOC, 40), 0), (chunk_recursive(DOC, 40), 0)],
)
def test_compare_counts_mid_sentence_cuts(chunks, expected):
    paragraphs = re.split(r"\n(?:[ \t]*\n)+", DOC.strip())
    headings = [" ".join(section.splitlines()[0].split()) for section in paragraphs]
    count = 0
    for chunk in chunks:
        text = " ".join(chunk.split())
        ends_at_heading = any(text == heading or text.endswith(" " + heading) for heading in headings)
        if not text.endswith((".", "?", "!")) and not ends_at_heading:
            count += 1
    assert count == expected
