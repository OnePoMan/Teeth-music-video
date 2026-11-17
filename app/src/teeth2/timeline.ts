// Teeth v2, "Dental Records": which plate plays when. The treatment and the plate list: docs/TEETH2.md.
// Windows are the treatment's (they sit on the analysed grid, 139.0 BPM; data/teeth/audio.json).
// Scenes live in teeth2/scenes/<id>.ts and are loaded lazily, so a missing plate renders black instead of
// breaking the build. `?board=<id>` replaces the edit with one full-length entry that loads scenes/<id>.ts:
// boards are review sheets that are not part of the edit (the gate 2 type and colour sheet: `?board=typesheet`).
import type { TimelineEntry } from '../engine/engine';
import type { SceneClass } from '../engine/scene';
import type { Lyrics } from '../engine/lyrics';
import type { AudioData } from '../engine/audio';

const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: teeth2/scenes/${name}.ts`));
};

/** Plate windows (song seconds), from docs/TEETH2.md "Song map and plates". */
export const PLATES: [id: string, start: number][] = [
  ['drawer', 0],
  ['lightbox', 7.23],
  ['scene', 21.1],
  ['polygraph', 34.64],
  ['scale', 48.73],
  ['uv', 62.54],
  ['chart', 76.35],
  ['voice', 90.16],
  ['pour', 103.98],
  ['articulator', 117.79],
  ['luminol', 131.6],
  ['acetate', 145.41],
  ['match', 159.23],
  ['filed', 174.77],
];

export function makeTimeline(_ly: Lyrics, au: AudioData): TimelineEntry[] {
  // The engine HUD (crop marks, readouts) is off in every Teeth render (rule 3).
  const post = { hud: 0 };
  const board = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('board') : null;
  if (board) return [{ id: board, load: scene(board), start: 0, end: au.duration, post }];
  return PLATES.map(([id, start], i) => ({
    id,
    load: scene(id),
    start,
    end: PLATES[i + 1]?.[1] ?? au.duration,
    post,
  }));
}
