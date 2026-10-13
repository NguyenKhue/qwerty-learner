#!/usr/bin/env python3
"""Build the long-meaning detail file for the "My Vocabulary" dictionary.

Where the text comes from
-------------------------
The input is a plain-text export of the user's own vocabulary notes, produced on
macOS from the rich-text file ``Vocab.rtf``::

    textutil -convert txt -encoding UTF-8 Vocab.rtf > .tmp-oc/vocab-full.txt

The export is a flat list of entries.  Every entry STARTS at a header line of
the form ``<Word> - Loại từ: ...`` (or ``<Word> - Loại từ gốc: ...``) and runs
until the next header line, header line included as the entry's first line.

What this script does
---------------------
It splits the text into entries with the regex ``^(.+?) - Loại từ(?: gốc)?:``,
keys each entry by the lower-cased, trimmed word in front of `` - Loại từ``,
and writes one JSON object ``{"<word>": "<detail text>"}`` (UTF-8,
``ensure_ascii=False``, no indentation, keys in text order).  Nothing is
translated or reworded: line endings are normalized to ``\\n``, leading and
trailing blank lines of an entry are trimmed, and blank lines inside an entry
are kept as single newlines.

Usage::

    python3 scripts/vocab-detail-from-text.py <text-file> <words-json> <output-json>

Exit code 1 when any word of ``<words-json>`` has no entry in the text.
"""

import json
import re
import sys

HEADER_RE = re.compile(r"^(.+?) - Loại từ(?: gốc)?:", re.MULTILINE)


def read_text(path):
    """Read the text file and normalize its line endings to \\n."""
    with open(path, "r", encoding="utf-8") as handle:
        raw = handle.read()
    if raw.startswith("\ufeff"):  # strip a possible BOM
        raw = raw[1:]
    return raw.replace("\r\n", "\n").replace("\r", "\n")


def split_entries(text):
    """Split the text into entries.

    Returns a list of (word, chunk) pairs in text order.  ``word`` is the
    lower-cased, trimmed header word; ``chunk`` is the entry's raw text.
    Anything before the first header line is ignored.
    """
    matches = list(HEADER_RE.finditer(text))
    entries = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        word = match.group(1).strip().lower()
        entries.append((word, text[match.start():end]))
    return entries


def clean_chunk(chunk):
    """Trim leading/trailing blank lines, keep inner blank lines as newlines."""
    lines = chunk.split("\n")
    start = 0
    end = len(lines)
    while start < end and not lines[start].strip():
        start += 1
    while end > start and not lines[end - 1].strip():
        end -= 1
    body = ["" if not line.strip() else line for line in lines[start:end]]
    return "\n".join(body)


def main(argv):
    if len(argv) != 4:
        sys.stderr.write(
            "usage: python3 scripts/vocab-detail-from-text.py "
            "<text-file> <words-json> <output-json>\n"
        )
        return 2
    text_path, words_path, out_path = argv[1:4]

    text = read_text(text_path)
    entries = split_entries(text)

    with open(words_path, "r", encoding="utf-8") as handle:
        words_data = json.load(handle)
    names = [str(item["name"]) for item in words_data]
    name_keys = {name.strip().lower(): name for name in names}

    # Collect the entries, keeping text order and the LONGER text on duplicates.
    detail = {}
    counts = {}
    kept_source = {}
    for word, chunk in entries:
        body = clean_chunk(chunk)
        counts[word] = counts.get(word, 0) + 1
        if word not in detail or len(body) > len(detail[word]):
            detail[word] = body
            kept_source[word] = counts[word]

    # Every words-json name that has an entry in the text.
    matched_keys = [key for key in name_keys if key in detail]
    missing = [name for key, name in name_keys.items() if key not in detail]
    # Headers whose word is not part of the words-json file.
    unmatched_headers = []
    seen_unmatched = set()
    for word, _chunk in entries:
        if word not in name_keys and word not in seen_unmatched:
            seen_unmatched.add(word)
            unmatched_headers.append(word)
    duplicates = {word: count for word, count in counts.items() if count > 1}

    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(detail, handle, ensure_ascii=False)

    report = [
        "vocab-detail-from-text report",
        "  text file      : %s" % text_path,
        "  words json     : %s (%d words)" % (words_path, len(names)),
        "  output json    : %s (%d keys)" % (out_path, len(detail)),
        "  entries found  : %d headers, %d unique words"
        % (len(entries), len(detail)),
        "  matched names  : %d / %d" % (len(matched_keys), len(names)),
        "  words with NO entry (%d): %s"
        % (len(missing), ", ".join(missing) if missing else "(none)"),
        "  headers matching no words-json name (%d): %s"
        % (len(unmatched_headers), ", ".join(unmatched_headers) if unmatched_headers else "(none)"),
        "  words with more than one entry (%d): %s"
        % (len(duplicates), ", ".join(
            "%s x%d (kept longer)" % (word, count) for word, count in duplicates.items()
        ) if duplicates else "(none)"),
    ]
    print("\n".join(report))

    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))