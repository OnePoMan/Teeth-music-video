// Which song the app renders: `?song=teeth` (default) or `?song=pdoom`. The engine is shared; each song
// brings its own audio, timing data (see analysis/) and timeline of scenes.
import type { TimelineEntry } from './engine/engine';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';
import { makeTimeline as pdoomTimeline } from './timeline';
import { makeTimeline as teethTimeline } from './teeth/timeline';

export interface Song {
  id: string;
  title: string;
  /** Audio file and timing-data folder, relative to the app root (served from the repo's audio/ and data/). */
  audio: string;
  data: string;
  timeline: (lyrics: Lyrics, audio: AudioData) => TimelineEntry[];
}

export const SONGS: Record<string, Song> = {
  teeth: { id: 'teeth', title: 'Teeth', audio: 'audio/teeth.mp3', data: 'data/teeth/', timeline: teethTimeline },
  pdoom: { id: 'pdoom', title: 'I’m Upping My P(doom)', audio: 'audio/pdoom.mp3', data: 'data/', timeline: pdoomTimeline },
};

function readSong(): Song {
  const id = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('song');
  return SONGS[id ?? 'teeth'] ?? SONGS.teeth!;
}

export const SONG = readSong();
