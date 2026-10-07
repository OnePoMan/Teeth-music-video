// `souls` — verse 1 pilot shot (placeholder while it is built).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { clearRT } from '../../engine/gl';

export default class Placeholder extends Scene {
  render(_f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    clearRT(this.ctx.renderer, out, [0.02, 0.0, 0.0]);
    return {};
  }
}
