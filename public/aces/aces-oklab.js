// ACES — OKLab color conversions for the L1-L8 vertex-colour stack.
//
// Why OKLab? L (lightness) and chroma (hypot(a,b)) are INDEPENDENT in OKLab,
// and that is the whole reason the L4 boost (brighter AND more saturated up
// top) is implementable at all. Every blend mode that brightens moves toward
// white, and white has chroma 0 — so in any RGB blend mode, "brighter" and
// "more saturated" are opposite moves, and a measured run had every mode's
// delta-chroma negative while gaining lightness. OKLab decouples them: the
// boost literally just moves L up and multiplies chroma, and the only thing
// you have to be careful about is the gamut edge (chroma can run out of sRGB,
// and clamping per channel TURNS THE HUE rather than capping the chroma).
//
// Author: Ariescar (anyCreature) ported to the RDJ low_poly_3d browser
// surface. Used by ACES shade stack. Zero dependencies, browser-friendly.
//
// Reference: Björn Ottosson, "A perceptual color space for image processing"
// (https://bottosson.github.io/posts/oklab/).

'use strict';

// sRGB channel (0..1) → linear-light sRGB (0..1)
function s2l(v) { return Math.pow(v, 2.2); }

// linear sRGB → OKLab (L, a, b). L is roughly perceptual lightness; hypot(a,b)
// is chroma; the angle is hue.
function lin2oklab(c) {
  const l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
  const m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
  const s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

// OKLab → linear sRGB, raw (can be out of gamut — caller must clamp)
function oklabToLinRaw(L) {
  const l = (L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2]) ** 3;
  const m = (L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2]) ** 3;
  const s = (L[0] - 0.0894841775 * L[1] - 1.2914855480 * L[2]) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// OKLab → linear sRGB, gamut-clamped per channel
function oklab2lin(L) {
  return oklabToLinRaw(L).map((v) => (v < 0 ? 0 : v > 1 ? 1 : v));
}

// Is this OKLab colour inside the linear-sRGB cube? Used to walk the chroma
// back to the gamut edge when L4 boost pushes it out.
function inGamut(c) {
  const r = oklabToLinRaw(c);
  return r.every((v) => v >= -1e-4 && v <= 1.0001);
}

// Linear sRGB [0,1] triple → sRGB [0,255] triple
function lin2srgb255(c) {
  return c.map((v) => {
    const x = Math.max(0, Math.min(1, v));
    return Math.round(Math.pow(x, 1 / 2.2) * 255);
  });
}

// Hex "#rrggbb" → linear sRGB triple (used for palette entries, ramp colours)
function hex2lin(h) {
  const x = parseInt(String(h).replace('#', ''), 16);
  return [s2l(((x >> 16) & 255) / 255), s2l(((x >> 8) & 255) / 255), s2l((x & 255) / 255)];
}

// Hex → OKLab. Used as a one-shot helper for ramp colours.
function hex2lab(h) {
  return lin2oklab(hex2lin(h));
}

// Smoothstep — used by every layer's blend curve
function ss(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / ((b - a) || 1e-9)));
  return t * t * (3 - 2 * t);
}

// Linear mix in OKLab (used by L1 seam smoothing + L5 hardware bleed)
function mixOK(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Deterministic value noise (same generator the engine already uses, in case
// callers want the L2 pattern to align with anything else). 3D version.
function vnoise3(p, scale) {
  const s = 1 / (scale || 1e-6);
  const x = p[0] * s, y = p[1] * s, z = p[2] * s;
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const fade = (t) => t * t * (3 - 2 * t);
  const h = (a, b, c) => {
    let n = a * 374761393 + b * 668265263 + c * 1274126177;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  };
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(
    lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

// Walk chroma back to the gamut edge by bisection. 12 iterations = 0.03% error
// on the worst case (chroma at the apex of the sRGB cube). Used by L4 boost
// when a brighter+saturated vertex would otherwise clamp and turn the hue.
function walkChromaToEdge(L, cA, cB, targetL) {
  let a = 0, b = 1;
  for (let it = 0; it < 12; it++) {
    const mid = (a + b) / 2;
    if (inGamut([targetL, cA * mid, cB * mid])) a = mid;
    else b = mid;
  }
  return a;
}

// Export both as named (for module consumers) and onto a global (so the
// existing index.html can call window.ACES_oklab.* without an import).
const api = {
  s2l,
  lin2oklab,
  oklab2lin,
  oklabToLinRaw,
  inGamut,
  lin2srgb255,
  hex2lin,
  hex2lab,
  ss,
  mixOK,
  vnoise3,
  walkChromaToEdge,
};

if (typeof window !== 'undefined') {
  window.ACES_oklab = api;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
