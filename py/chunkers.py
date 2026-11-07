# >>> chunk_fixed
def chunk_fixed(text, size, overlap):
    if not isinstance(size, int) or size < 1:
        raise ValueError("Use a whole number of at least 1 for size.")
    if not isinstance(overlap, int) or not 0 <= overlap < size:
        raise ValueError("Use a whole number for overlap from 0 to one less than size.")

    words = text.split()
    chunks = []
    step = size - overlap
    for start in range(0, len(words), step):
        end = start + size
        chunks.append(" ".join(words[start:end]))
        # The final window already covers every remaining word.
        if end >= len(words):
            break
    return chunks
# <<< chunk_fixed


# >>> chunk_sentences
def chunk_sentences(text, max_words):
    import re

    sentences = re.split(r"(?<=[.!?])\s+|\r?\n[^\S\r\n]*\r?\n", text)
    chunks = []
    current = []
    word_count = 0
    for sentence in sentences:
        words = sentence.split()
        if not words:
            continue
        if current and word_count + len(words) > max_words:
            chunks.append(" ".join(current))
            current = []
            word_count = 0
        current.append(" ".join(words))
        word_count += len(words)
    if current:
        chunks.append(" ".join(current))
    return chunks
# <<< chunk_sentences


# >>> chunk_recursive
def chunk_recursive(text, max_words, separators=("\n\n", "\n", ". ", " ")):
    text = text.strip()
    if not text:
        return []
    if len(text.split()) <= max_words:
        return [text]
    for index, separator in enumerate(separators):
        if separator and separator in text:
            break
    else:
        return [text]

    # Keep separators attached so splitting does not lose punctuation or spacing.
    pieces = text.split(separator)
    groups = [pieces[0] + separator]
    for i, piece in enumerate(pieces[1:], 1):
        if i < len(pieces) - 1:
            piece += separator
        if len((groups[-1] + piece).split()) <= max_words:
            groups[-1] += piece
        else:
            groups.append(piece)

    chunks = []
    for group in groups:
        if len(group.split()) > max_words:
            chunks.extend(chunk_recursive(group, max_words, separators[index + 1:]))
        elif group.strip():
            chunks.append(group.strip())
    return chunks
# <<< chunk_recursive
