// Which song the app renders: `?song=monster` (default) or `?song=pdoom`. The engine is shared; each song
// brings its own audio, timing data (see analysis/) and timeline of scenes.
import type { TimelineEntry } from './engine/engine';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';
import { makeTimeline as pdoomTimeline } from './timeline';
import { makeTimeline as monsterTimeline } from './monster/timeline';

export interface Song {
  id: string;
  title: string;
  /** Audio file and timing-data folder, relative to the app root (served from the repo's audio/ and data/). */
  audio: string;
  data: string;
  timeline: (lyrics: Lyrics, audio: AudioData) => TimelineEntry[];
}

export const SONGS: Record<string, Song> = {
  monster: { id: 'monster', title: 'Monster', audio: 'audio/monster.mp3', data: 'data/monster/', timeline: monsterTimeline },
  pdoom: { id: 'pdoom', title: 'I’m Upping My P(doom)', audio: 'audio/pdoom.mp3', data: 'data/', timeline: pdoomTimeline },
};

function readSong(): Song {
  const id = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('song');
  return SONGS[id ?? 'monster'] ?? SONGS.monster!;
}

export const SONG = readSong();
