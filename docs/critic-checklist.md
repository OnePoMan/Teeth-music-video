# Critic checklist (the critic step before a plate goes to the client)

Since 2026-10-08 (client's choice) every new plate passes a critic before the client sees it: a fresh agent that has not seen the builder's reasoning inspects the rendered frames against the plate's spec, the binding rules (`docs/MONSTER.md` "Grammar", `docs/HANDOFF.md` client notes) and this list, compares them blind with approved reference frames, and names the single biggest defect; the builder fixes it and a new critic looks again. The loop stops when the biggest remaining item is a taste call for the client. The client stays the final judge of taste.

The critic judges execution against the spec and the rules. It does not redesign the plate, and it never asks for more texture, glow, grain, ornament or effects: the client's standing rule is "don't push the design further". Concept-level doubts are reported separately as taste calls.

Each item cites the client note it comes from.

## Words and timing
1. Every word appears on its sung onset: its letters spring up about 45 ms before it (`POP`); nothing appears more than 0.4 s early; no fade-ins on entrances (Grammar 7, the client's notes on pilot v1).
2. One phrase on screen: 1–4 words of the line being sung; a line leaves on the next beat after it ends; no couplets, no unsung words shown ahead (Grammar 1).
3. One hero word per line at frame scale, readable at a glance: large, close to frontal, not edge-on, not cropped, inside the title-safe area (96 px) (Grammar 2; v5 note 4: "How am I to" was unreadable, small and nearly edge-on).
4. Supporting words are physical 3D things, readable, never flat 2D captions (Grammar 8: "the rest of the words appear somewhat flat and understated").
5. No overlap between one phrase and the next: a crisp hand-over on the onset (v6 note 2: "been turned" overlapped "against"). Accepted exception: "us?" over EVERYTHING's T and H.
6. No leftovers: no lone letter or speck left when a phrase leaves (v7 check: a lone "t" over the reflection); no nearly flat letter showing its lit top as a block on a low camera (v7 check; hide letters with `hinge > 1.2`).
7. Nothing pops in on the frame before a camera cut (v7 note 8: "What" cut in like a glitch, its first letter one frame before the cut).
8. A word leaves together with the thing it belongs to (v6 note 3: THREAT lingered after "across the sea").

## Cuts and motion (judge from frame sequences: a sheet every 1/6 s around each event and cut)
9. Cuts on strong downbeats; no off-beat cut where the hero words jump (v7 note 8: "hiding all along" felt disjointed).
10. Something happens every bar, 2.67 s (Grammar 4; v5 note 6: CHANGE? read boring, "nothing changes for 4 s").
11. No zoom or rush at the camera (v6 note 1: it felt cheesy).
12. Puppet motion with intent: nothing pivots rigidly about a fixed point while everything else stands still, nothing freezes mid-move (v7 note 3: the galley "looks janky"); no shredded 1–3 frame hand-offs between shapes (v7 note 6).
13. Camera moves ease into downbeats; no crane to a small-text shot that loses the line (v7 note 8).

## The image
14. No visible flame and nothing that reads as one: a bright blob on the glaze is the hidden fire's mirror image (v5 note 1; `spec` ~0.05).
15. No line fields on floors or water; water is a black mirror, wine-dark; lines only as decoration reserved in the clay (v5 note 5; Grammar 11).
16. One horizon line: no doubled line with a black sliver between (v7 note 8).
17. Nothing reads as debris: every shape is recognisably something, or plainly intended (v7 note 6: "What's that to the left of Poseidon's hand? It reads as random debris").
18. Figures recognisable at a glance (v5 note 2); no faces (archaic frontal eyes only); the cyclops' is the one eye in the video.
19. Palette only: ink, ink2, graphite, ash, bone, signal, ember, blood; dawn only for home. Only signal and ember glow; bone type crisp, never blooming. Not a defect: the ember flash as a word pops (`popWords` in `stage.ts`: glow 0.45 halving every 0.16 s, approved in verse 1). A defect: a flash much stronger or longer than that, or a halo on settled type.
20. Full value range and full-frame detail (Grammar 5), within "don't push the design further" (see above).
21. Not a repeat of an earlier shot, not trite (v7 note 4: "the monsters in the background repeat earlier shots", "letters changing colour on the beat feel trite").

## Technical
22. No white stars (NaN normals), no dark-red placeholder frames, no stale or frozen layers, no flicker between neighbouring frames, no shimmer at grazing angles.

## What the critic returns
1. The single biggest defect: what, where (time, place in frame), why it matters (checklist item), and the smallest fix that would remove it.
2. Other defects, ranked, each with its time and item.
3. Blind pairs: for each pair (A/B, one a new frame, one an approved reference, order unknown to the critic), which is stronger on readability, composition, value range and craft, and the weaker one's biggest gap.
4. Taste calls for the client (concept, pacing or wording doubts that the spec decides), kept apart from the defects.
