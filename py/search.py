# >>> keywords
def keywords(text):
    import re

    stopwords = set("a an the i do to my me is of how can does have what when will in for".split())
    terms = set()
    for word in re.findall(r"[^\W_]+", text.lower()):
        if word in stopwords:
            continue
        for suffix in ("ing", "ed", "es", "s", "e"):
            if word.endswith(suffix):
                stem = word[:-len(suffix)]
                if sum(letter.isalpha() for letter in stem) >= 3:
                    word = stem
                    break
        terms.add(word)
    return terms
# <<< keywords


# >>> score
def score(question, chunk):
    return len(keywords(question) & keywords(chunk))
# <<< score


# >>> top_chunk
def top_chunk(question, chunks):
    # max keeps the first index when two scores are equal.
    return max(range(len(chunks)), key=lambda i: score(question, chunks[i]), default=None)
# <<< top_chunk


# >>> evaluate
def evaluate(chunks, questions, budget=60):
    results = []
    for question in questions:
        index = top_chunk(question["question"], chunks)
        chunk = chunks[index] if index is not None else ""
        words = chunk.split()
        answer = " ".join(question["answer"].split())
        normalized_chunk = " ".join(words)
        has_answer = index is not None and f" {answer} " in f" {normalized_chunk} "
        results.append({
            "id": question["id"],
            "top_index": index,
            "top_chunk": chunk,
            "words": len(words),
            "has_answer": has_answer,
            "rescued": has_answer and len(words) <= budget,
        })
    return results
# <<< evaluate
