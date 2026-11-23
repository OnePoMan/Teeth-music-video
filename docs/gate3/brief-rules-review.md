# Blind review of the Teeth v2 rule set (reviewer brief, Opus 5.5 high)

You are a fresh reviewer with no history on this project. The client thinks the rule set has grown too large (R1-R98, about 100 rules) and asked for an independent check. Find where the rules are inconsistent, conflict with each other, or would send a builder in contradictory directions if followed together. Also find which rules aren't needed.

**Read, in this order:** `docs/teeth2/RULES.md` (precedence first), `docs/teeth2/TYPE.md`, `docs/teeth2/PLATES.md` (the cards and type cards), `docs/teeth2/CHECKLIST.md`, `docs/teeth2/BACKLOG.md`, `docs/teeth2/HANDOFF.md`. Don't read code, the archive, the ledger or the review folders. The rules must stand on their own.

**Look for:**
1. **Conflicts:** two rules, or a rule and a plate or type card, that can't both be obeyed. Say which one the precedence section makes win, and whether that outcome is what the documents seem to intend.
2. **Contradictory directions in practice:** rules that are each fine alone but pull a build two ways. Examples are size floors against framing limits, or motion targets against motion ceilings. Where you can, show with numbers that they can't all hold.
3. **Superseded or dead rules:** rules amended or replaced by later ones but still standing in full, rules about tools or states that no longer apply ("pending", "until the probe"), and history presented as a rule.
4. **Duplicates and overlap:** the same requirement stated in several places, possibly with different numbers.
5. **Unclear or unmeasurable rules:** a builder couldn't tell whether they'd passed.
6. **Not needed:** rules that are really a plate-card detail, a process note, or a one-off decision, and could move out of RULES.

**Write** `docs/gate3/review-rules.md`, in at most 1500 words:
- **Findings:** one table, most serious first. Columns: rule IDs, type (conflict, practice, superseded, duplicate, unclear, not needed), the evidence (a quote of up to 15 words, or numbers), and the proposed fix (delete, merge into Rn, amend to …, move to the plate card or process doc).
- **A proposed slim core:** the rules a builder actually needs, by ID and with merged wording where you merge. Then where the rest should go: a plate card, TYPE, a process doc, or the archive. Give the before and after counts.
- **Open questions for the client:** only where the documents don't let you decide.

Don't edit any file except `docs/gate3/review-rules.md`. Don't commit. Report in ≤100 words: the counts, and the three most serious findings.
