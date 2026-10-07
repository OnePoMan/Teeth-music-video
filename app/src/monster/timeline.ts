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
  /** Cut on the last beat at/before the first word of the matching lead line (never after the word). */
  const cut = (q: string, nth = 0, tol = 0.02) => {
    const l = ly.lines.filter((x) => x.voice !== 'ensemble' && x.text.toLowerCase().replace(/[’]/g, "'").includes(q.toLowerCase()))[nth];
    if (!l) throw new Error(`lyric not found: ${q}`);
    return au.timeOfBeat(Math.floor(au.beatAt(l.words[0]!.start + tol)));
  };
  const outro = au.sections.find((x) => x.name === 'outro')?.start ?? cut('Penelope', 1);

  const b = {
    questions: cut('How has everything'),
    shades: cut("I'm surrounded"),
    hook1: cut("What if I'm the monster", 0),
    mirror: cut("What if I'm in the wrong"),
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

  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  return [
    E('strike', 'strike', 0, b.questions),
    E('questions', 'questions', b.questions, b.shades),
    E('shades', 'shades', b.shades, b.hook1),
    E('hook1', 'hook', b.hook1, b.mirror, { params: { n: 1 } }),
    E('mirror', 'mirror', b.mirror, b.cyclops),
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
