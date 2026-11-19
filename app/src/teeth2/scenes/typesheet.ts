// BOARD `typesheet` (gate 2, not part of the edit): the type and colour sheet the client approves before any plate
// is built (docs/TEETH2.md, "Gate 2: the stills", item 4). Rendered with `--query board=typesheet --only typesheet`.
//   page 1 (t < 100): the type: Archivo in his voice, the karaoke states, Plex Mono inside objects, the tender words
//                     in wax Cormorant, the pen's single-stroke hand, the T.F. monogram (typesheet-p1.ts);
//   page 2 (t >= 100): the colour: the lyric colour treatments A / B / C on film and on lightbox white, the palette
//                     in context (on film, on the lightbox, under UV, under luminol, the stone, the match red), and
//                     the warm-lamp variant beside the cold key (taste call 4) (typesheet-p2.ts).
// The sheet is painted flat in Canvas2D and lit by one pass (typesheet-gl.ts), then goes through the engine's post
// with the settings proposed for the video (below), so grain and halation are the real ones.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, W, H } from '../../engine/gl';
import { T_HEX } from '../palette';
import { SheetLight, type Region } from './typesheet-gl';
import type { Ctx2 } from './typesheet-kit';
import { page1 } from './typesheet-p1';
import { page2 } from './typesheet-p2';

/** Post proposed for Teeth: bloom only above 1.0 (the glow tokens; lightbox white stays crisp), a cold halation. */
export const TEETH_POST: PostOverrides = {
  bloom: 0.5, bloomThreshold: 1.0, bloomKnee: 0.35, halation: 0.22, halationTint: [0.55, 0.75, 1.0],
  grain: 0.05, vignette: 0.28, ca: 0.4, hud: 0,
};

export default class TypeSheet extends Scene {
  private alb = new Layer2D();
  private glw = new Layer2D();
  private hgt = new Layer2D(W, H, 1);
  private light!: SheetLight;

  override init() {
    this.light = new SheetLight(this.alb.texture, this.glw.texture, this.hgt.texture);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    this.alb.clear(T_HEX.film);
    this.glw.clear('#000');
    this.hgt.clear('#000');
    const regions: Region[] = [];
    const C: Ctx2 = { a: this.alb.ctx, g: this.glw.ctx, h: this.hgt.ctx, regions };
    if (f.t < 100) page1(C, this.ctx.lyrics, f.t);
    else page2(C, this.ctx.lyrics, f.t);
    this.alb.upload(); this.glw.upload(); this.hgt.upload();
    this.light.set(regions);
    this.light.render(this.ctx.renderer, out);
    return TEETH_POST;
  }
}
