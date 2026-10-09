// The Monster edit: which plate plays when. Boundaries are anchored to lyric lines and snapped to the
// beat grid (90 BPM, constant), so they follow the aligned data (data/monster/lyrics.json, audio.json).
// The treatment and the plate list: docs/MONSTER.md.
import type { TimelineEntry } from '../engine/engine';
import type { SceneClass } from '../engine/scene';
import type { Lyrics } from '../engine/lyrics';
import type { AudioData } from '../engine/audio';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: monster/scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Cut on the last beat at/before the first word of the matching lead line (never after the word); `off` shifts the
   *  cut by a fraction of a beat (0.5: the off-beat after that beat, for a line whose first word falls late in it). */
  const cut = (q: string, nth = 0, tol = 0.02, off = 0) => {
    const l = ly.lines.filter((x) => x.voice !== 'ensemble' && x.text.toLowerCase().replace(/[’]/g, "'").includes(q.toLowerCase()))[nth];
    if (!l) throw new Error(`lyric not found: ${q}`);
    return au.timeOfBeat(Math.floor(au.beatAt(l.words[0]!.start + tol)) + off);
  };
  const outro = au.sections.find((x) => x.name === 'outro')?.start ?? cut('Penelope', 1);

  const b = {
    everything: cut('How has everything'),
    endless: cut('How did suffering'),
    symbolon: cut('How am I to reunite'),
    change: cut('Do I need to change'),
    souls: cut("I'm surrounded"),
    sea: cut('What if the greatest threat'),
    hook1: cut("What if I'm the monster", 0),
    // chorus 1 after hook 1, one plate per line (12 and 13 share the shield); `scylla` cuts on the off-beat before its
    // line: on the whole beat the line's first word fell too near the cut
    wrong: cut("What if I'm in the wrong"),
    scylla: cut("What if I'm the problem", 0, 0.02, 0.5),
    vase: cut("What if I'm the one who"),
    shield: cut('far too kind to foes'),
    lookback: cut("What if I'm the monster", 1),
    cyclops: cut('Is the cyclops'),
    circe: cut('When the witch'),
    poseidon: cut('When a God'),
    horse: cut('Does a soldier'),
    hook2: cut('If I became the monster and threw'),
    scale: cut('Would that make us stronger'),
    creed: cut('Oh, ruthlessness', 0),
    losses: cut('I lost my best friend'),
    course: cut('I must get to see'),
    wall: cut('And if I gotta drop'),
    hook3: cut("Then I'll become"),
    black: cut('I will deal the blow'),
    outro,
    end: au.duration,
  };

  // stills of a plate's options before it is built (render.ts --query "sketch=<id>&opt=<x>"): entry <id> then loads
  // scenes/sketch-<id>.ts, which reads its option from the URL; without the parameter nothing changes
  const sketch = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('sketch') : null;
  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(sketch === id ? `sketch-${id}` : file), start, end, ...extra });

  return [
    // the opening and verse 1 (revision 1): one shot per line, cut on the beat before each line; `everything` opens
    // the video (the flint strikes in the dark) and runs on into the first line without a cut
    E('everything', 'everything', 0, b.endless),
    E('endless', 'endless', b.endless, b.symbolon),
    E('symbolon', 'symbolon', b.symbolon, b.change),
    E('change', 'change', b.change, b.souls),
    E('souls', 'souls', b.souls, b.sea),
    E('sea', 'sea', b.sea, b.hook1),
    E('hook1', 'hook', b.hook1, b.wrong, { params: { n: 1 } }),
    E('wrong', 'c1-wrong', b.wrong, b.scylla),
    E('scylla', 'c1-scylla', b.scylla, b.vase),
    E('vase', 'c1-vase', b.vase, b.shield),
    E('shield', 'c1-shield', b.shield, b.lookback),
    E('lookback', 'c1-lookback', b.lookback, b.cyclops),
    E('cyclops', 'cyclops', b.cyclops, b.circe),
    E('circe', 'circe', b.circe, b.poseidon),
    E('poseidon', 'poseidon', b.poseidon, b.horse),
    E('horse', 'horse', b.horse, b.hook2),
    E('hook2', 'hook', b.hook2, b.scale, { params: { n: 2 } }),
    E('scale', 'scale', b.scale, b.creed),
    E('creed', 'creed', b.creed, b.losses),
    E('losses', 'losses', b.losses, b.course),
    E('course', 'course', b.course, b.wall),
    E('wall', 'wall', b.wall, b.hook3),
    E('hook3', 'hook', b.hook3, b.black, { params: { n: 3 } }),
    E('blackfigure', 'blackfigure', b.black, b.outro),
    E('outro', 'outro', b.outro, b.end),
  ];
}
