// The Teeth edit (docs/TEETH.md): plate windows anchored to lyric lines and the beat grid
// (data/teeth/lyrics.json, data/teeth/audio.json).
import type { TimelineEntry } from '../engine/engine';
import type { SceneClass } from '../engine/scene';
import type { Lyrics } from '../engine/lyrics';
import type { AudioData } from '../engine/audio';
import { TEETH_POST } from './palette';

const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: teeth/scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** The beat at/before the first word of the matching line. */
  const cut = (q: string, nth = 0, tol = 0.03) => {
    const s = ly.get(q, nth).words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };
  const sec = (name: string) => au.sections.find((s) => s.name === name)!.start;

  const b = {
    // the first sung word lands 60 ms before the verse's downbeat: the intro bites shut on the voice
    ember: ly.get('Some days', 0).words[0]!.start - 1 / 30,
    sheets: cut('Sometimes you'),
    pre1: cut('Call me in the morning', 0),
    chorus1: cut('Fight so dirty', 0),
    ring: cut('Some days', 1),
    pre2: cut('Call me in the morning', 1),
    chorus2: cut('Fight so dirty', 2),
    shirt: sec('bridge'),
    chorus3: cut('Fight so dirty', 5),
    throat: sec('outro'),
    end: au.duration,
  };

  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, post: { ...TEETH_POST }, ...extra });

  return [
    E('seam', 'seam', 0, b.ember),
    E('ember', 'ember', b.ember, b.sheets),
    E('sheets', 'sheets', b.sheets, b.pre1),
    E('cards1', 'rorschach', b.pre1, b.chorus1, { params: { n: 1 } }),
    E('jaw1', 'jaw', b.chorus1, b.ring, { params: { n: 1 } }),
    E('ring', 'ring', b.ring, b.pre2),
    E('cards2', 'rorschach', b.pre2, b.chorus2, { params: { n: 2 } }),
    E('jaw2', 'jaw', b.chorus2, b.shirt, { params: { n: 2 } }),
    E('shirt', 'shirt', b.shirt, b.chorus3),
    E('jaw3', 'jaw', b.chorus3, b.throat, { params: { n: 3 } }),
    E('throat', 'throat', b.throat, b.end),
  ];
}
