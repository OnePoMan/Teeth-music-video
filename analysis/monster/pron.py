"""Display token -> pronunciation spelling used for CTC alignment (Monster).

Each display token (lyric line split on spaces) maps to one or more pronunciation sub-words made of plain
letters (and internal apostrophes): respellings where the written form misleads a character-level model.
"""
import re

PRON = {
    "cyclops": "sigh clops",
    "nymphs,": "nimfs",
    "Poseidon": "po sigh don",
    "Penelope": "pe nel o pee",
    "Telemachus": "te lem a kus",
    "guile?": "gile",
    "'cause": "cause",
    "Five": "five",
    "monster,": "monster",
}


def pron(token: str) -> list[str]:
    if token in PRON:
        return PRON[token].split()
    w = token.lower().replace("’", "'")
    w = re.sub(r"[^a-z' ]", " ", w)
    w = w.strip("' ")
    return [p.strip("'") for p in w.split() if p.strip("'")]
