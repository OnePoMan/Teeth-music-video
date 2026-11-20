// Plate 1 `drawer`: the gate 3 additions to the march, kept out of drawer-glsl.ts (MARCH_FRAG is plate 14's base and
// stays as it is). DRAWER_FRAG starts from plate 14's patched march (filed-glsl.ts BANK_FRAG: MARCH_FRAG plus the
// shared glove and 08-32's carry, both off by default) and adds 08-32 opened on its fold for the last beat. Every
// addition is gated on a uniform that sits at its rest value through the loop frame (open08 = 0, lift08 < 0.1,
// handOn = 0), so the loop frame renders exactly as MARCH_FRAG renders it.
// WHIP_FRAG: the whip-in, a zoom blur toward a point on screen.
import { BANK_FRAG } from './filed-glsl';

function patch(src: string, from: string, to: string) {
  if (!src.includes(from)) throw new Error(`drawer-fx: patch anchor not found: ${from.slice(0, 60)}`);
  return src.replace(from, to);
}

let fx = BANK_FRAG;
// 08-32 opened: the back panel (its papers, rod and tab) as hung; the front panel, its hem and rod swung forward on the
// fold at the bottom by open08 (rad)
fx = patch(fx, '/** Folder k in the open drawer\'s frame', `uniform float open08;
vec2 folder08(vec3 f) {
  const float th = 0.0045, HB = 0.236;
  float back = dRBox(f - vec3(0.0, -0.118, -th * 0.5), vec3(0.1855, 0.118, 0.0007), 0.0007);
  back = min(back, dCap(vec3(f.x, f.y, f.z + th - 0.0012), vec3(-0.1855, 0.0, 0.0), vec3(0.1855, 0.0, 0.0), 0.0019));
  vec2 r = vec2(back, M_FOLDER);
  vec3 g = f - vec3(0.0, -HB, 0.0);
  g.yz = tiltYZ(g.yz, open08);
  float fr = dRBox(g - vec3(0.0, 0.118, th * 0.5), vec3(0.1855, 0.118, 0.0007), 0.0007);
  vec3 gr = g - vec3(0.0, HB, th * 0.5);
  fr = min(fr, dCap(gr, vec3(-0.1855, 0.0, 0.0), vec3(0.1855, 0.0, 0.0), 0.0019));
  r = opU(r, vec2(fr, M_FOLDER));
  // the case papers lying in the front panel as it falls open (they face the tube once it is down)
  float pap = dBox(g - vec3(0.004, 0.122, th * 0.5 - 0.0015), vec3(0.168, 0.113, 0.0005));
  r = opU(r, vec2(pap, M_PAPER));
  float rod = dCap(f, vec3(-0.193, 0.0, 0.0), vec3(0.193, 0.0, 0.0), 0.0016);
  rod = min(rod, dCap(vec3(abs(f.x), f.yz), vec3(0.193, 0.0, 0.0), vec3(0.1965, -0.0045, 0.0), 0.0014));
  rod = min(rod, dCap(gr, vec3(-0.193, 0.0, 0.0), vec3(0.193, 0.0, 0.0), 0.0016));
  rod = min(rod, dCap(vec3(abs(gr.x), gr.yz), vec3(0.193, 0.0, 0.0), vec3(0.1965, -0.0045, 0.0), 0.0014));
  r = opU(r, vec2(rod, M_ROD));
  vec3 tb = f - vec3(TABX, 0.0, 0.0);
  tb.yz = tiltYZ(tb.yz, -0.2);
  r = opU(r, vec2(dRBox(tb - vec3(0.0, 0.0085, 0.0), vec3(TABW, 0.0145, 0.0011), 0.0012), M_LABEL));
  return r;
}
/** Folder k in the open drawer's frame`);
fx = patch(fx, '  float h = hash11(fk * 7.13 + 1.7), h2 = hash11(fk * 3.71 + 9.2);',
  '  if (k == K0832 && open08 > 0.0) return folder08(f);\n  float h = hash11(fk * 7.13 + 1.7), h2 = hash11(fk * 3.71 + 9.2);');
// lifted clear of the drawer, 08-32 leaves the folders' bound and the near-folder range: always include it
const LIFTED = 'dBox(q - vec3(0.0, YR + lift08 - 0.1, -FZ0 - float(K0832) * FDZ), vec3(0.24, 0.22, 0.24))';
fx = patch(fx, '  float fb = dBox(q - vec3(0.0, YB + 0.19, -0.33), vec3(0.21, 0.2, 0.34));',
  `  float fb = dBox(q - vec3(0.0, YB + 0.19, -0.33), vec3(0.21, 0.2, 0.34));\n  if (lift08 > 0.1) fb = min(fb, ${LIFTED});`);
fx = patch(fx, 'folder(q, k)); }\n  return r;',
  'folder(q, k)); }\n  if (lift08 > 0.1 && (K0832 < k0 || K0832 > k1) && fb < r.x) r = opU(r, folder(q, K0832));\n  return r;');
fx = patch(fx, '  float bb = dBox(p - vec3(0.0, YB + 0.16, openZ * 0.5 - 0.3), vec3(0.235, 0.24, openZ * 0.5 + 0.42));',
  `  float bb = dBox(p - vec3(0.0, YB + 0.16, openZ * 0.5 - 0.3), vec3(0.235, 0.24, openZ * 0.5 + 0.42));
  if (lift08 > 0.1) { vec3 q = p - vec3(0.0, 0.0, openZ); bb = min(bb, ${LIFTED}); }`);
export const DRAWER_FRAG = fx;

/** The whip-in: a zoom blur toward ctr (uv), k the fraction of the way each pixel's streak reaches. */
export const WHIP_FRAG = /* glsl */ `
uniform sampler2D src; uniform float k; uniform vec2 ctr;
void main() {
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 32; i++) {
    float s = float(i) / 31.0;
    float w = 1.0 - 0.6 * s;
    acc += texture(src, ctr + (vUv - ctr) * (1.0 - k * s)).rgb * w; ws += w;
  }
  fragColor = vec4(acc / ws, 1.0);
}`;
