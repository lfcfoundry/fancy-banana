/* ===== art.js: all drawing for Fancy, the Banana (Apple Press look: shaded gradients, gloss, tone-on-tone outlines) =====
   Everything detailed is drawn ONCE into small cached pictures; the game loop only stamps them (cheap, also in Firefox).
   Stage art is built the first time a stage is needed and dropped when it is not (ART.keep), so memory stays small. */
var ART = (function () {
'use strict';
var W = 360, GY = 568, OW = 58, PI2 = 6.2832;
var K = 1, SET = {}, BAN = null;
var NAMES = ['Candy Shop', 'Jam Jar Pantry', 'Ice Cream Parlor', 'Silverware Drawer', 'Fruit Garden', 'Chimp\'s Jungle Kingdom'];
var ORDER = [0, 1, 2, 3, 4, 5];               // stage order: Candy, Pantry, Parlor, Drawer, Garden (easy to change)
var PAD = 4, TRK = null;                    // PAD: room around obstacle pictures for the bold outline
var GP = [48, 80, 48, 80, 64, 64], FARA = [.7, .85, .85, .9, .92, .9], MIDA = [.9, .92, .92, .92, 1, .92];                 // width of one repeating ground tile per stage
var INK = '#2d1f3d';
var FONT = '"Arial Rounded MT Bold","Trebuchet MS",system-ui,"Segoe UI",Roboto,sans-serif';

/* ---------- tiny helpers ---------- */
function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
function toHex(a) { return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
function mix(a, b, t) { var x = hex(a), y = hex(b); return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
function lit(c, t) { return mix(c, '#ffffff', t); }
function drk(c, t) { return mix(c, '#2b1a2e', t); }
function lg(g, x0, y0, x1, y1, st) { var q = g.createLinearGradient(x0, y0, x1, y1); for (var i = 0; i < st.length; i++) q.addColorStop(st[i][0], st[i][1]); return q; }
function rg(g, x0, y0, r0, x1, y1, r1, st) { var q = g.createRadialGradient(x0, y0, r0, x1, y1, r1); for (var i = 0; i < st.length; i++) q.addColorStop(st[i][0], st[i][1]); return q; }
var RF = { willReadFrequently: true };   // every picture the art builds stays in plain memory (never a graphics-card texture): the card then only ever sees finished pictures that are really drawn
function mk(w, h, q, rd) {   // rd: the picture will be read back (getImageData): keep it in memory so that is quick
  q = q || K; var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * q)); c.height = Math.max(1, Math.ceil(h * q));
  var g = c.getContext('2d', RF); if (!g) throw new Error('canvas-memory'); g.setTransform(c.width / w, 0, 0, c.height / h, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round';
  return { c: c, g: g, w: w, h: h };
}
var LB = 0;   // size of the last rr/ell/circ shape, so the bevel scales with it (0: a hand-drawn path, a middling bevel)
function rr(g, x, y, w, h, r) { LB = Math.min(w, h); g.beginPath(); g.roundRect(x, y, w, h, r); }
function circ(g, x, y, r) { LB = 2 * r; g.beginPath(); g.arc(x, y, r, 0, PI2); }
function ell(g, x, y, rx, ry, rot) { LB = 2 * Math.min(rx, ry); g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, PI2); }
function fs(g, fill, stroke, lw) { g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1.4; g.stroke(); } }
function bev(g, amt, d) {   // an inner bevel on the current path: a soft light rim up-left, a soft shade rim down-right (inner shadows; the clip keeps it inside the shape)
  var tm = g.getTransform(), s = Math.hypot(tm.a, tm.b), w = d * s; g.save(); g.clip(); g.rect(-9999, -9999, 19998, 19998); g.fillStyle = '#000';
  g.shadowColor = 'rgba(48,14,52,' + (.46 * amt) + ')'; g.shadowBlur = w * 1.7; g.shadowOffsetX = -w * .55; g.shadowOffsetY = -w * .95; g.fill('evenodd');
  g.shadowColor = 'rgba(255,255,255,' + (.62 * amt) + ')'; g.shadowBlur = w * 1.2; g.shadowOffsetX = w * .7; g.shadowOffsetY = w * 1.0; g.fill('evenodd');
  g.restore();
}
function fb(g, fill, stroke, lw, amt) { fs(g, fill, stroke, lw); if (stroke) { var d = LB ? Math.max(.8, Math.min(4.2, LB * .09)) : 2.4; bev(g, amt === undefined ? 1 : amt, d); } LB = 0; }   // fill + outline + bevel
function rnd(s) { return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function rep(P, x, w, fn) { fn(x); if (x + w > P) fn(x - P); }
function flipY(g, h, fn) { g.save(); g.translate(0, h); g.scale(1, -1); fn(); g.restore(); }
function post(g, x, w, h, c1, c2) { g.fillStyle = lg(g, x, 0, x + w, 0, [[0, c1], [1, c2]]); g.fillRect(x, 0, w, h); g.fillStyle = 'rgba(80,40,30,.5)'; g.fillRect(x, 0, 1, h); g.fillRect(x + w - 1, 0, 1, h); }
function plank(g, x, y, w, h, c1, c2) { g.fillStyle = lg(g, 0, y, 0, y + h, [[0, c1], [1, c2]]); g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x, y, w, 1.4); g.fillStyle = 'rgba(60,30,20,.35)'; g.fillRect(x, y + h - 1.2, w, 1.2); }
function gloss(g, x, y, w, h, a) { g.save(); g.globalAlpha = a; g.fillStyle = '#fff'; rr(g, x, y, w, h, Math.min(w, h) / 2); g.fill(); g.restore(); }
function metalH(g, x0, x1) { return lg(g, x0, 0, x1, 0, [[0, '#646c89'], [.13, '#c3cbe0'], [.3, '#ffffff'], [.46, '#a6afc8'], [.68, '#e6ebf6'], [.88, '#8a93af'], [1, '#596180']]); }
function gold(g, y0, y1) { return lg(g, 0, y0, 0, y1, [[0, '#fff3b0'], [.5, '#f0bf45'], [1, '#c98a1d']]); }
function gingham(g, x, y, w, h, c) {
  g.save(); g.fillStyle = '#fffdf6'; g.fillRect(x, y, w, h); g.globalAlpha = .5; g.fillStyle = c;
  for (var i = 0; i < w; i += 8) g.fillRect(x + i, y, 4, h);
  for (var j = 0; j < h; j += 8) g.fillRect(x, y + j, w, 4); g.restore();
}
function candy(g, x, y, r, c) {
  circ(g, x, y, r); fs(g, rg(g, x - r * .35, y - r * .35, 0.5, x, y, r, [[0, lit(c, .55)], [.6, c], [1, drk(c, .2)]]), drk(c, .4), .9);
  g.fillStyle = 'rgba(255,255,255,.8)'; circ(g, x - r * .38, y - r * .4, r * .24); g.fill();
}
function swirlPop(g, cx, cy, r, c1, c2) {
  var n = 6, i, a0, a1;
  circ(g, cx, cy, r); g.fillStyle = c2; g.fill();
  for (i = 0; i < n; i++) {
    a0 = i * PI2 / n; a1 = (i + 1) * PI2 / n; g.beginPath(); g.moveTo(cx, cy);
    g.quadraticCurveTo(cx + Math.cos(a0 + .55) * r * .6, cy + Math.sin(a0 + .55) * r * .6, cx + Math.cos(a0 + 1) * r, cy + Math.sin(a0 + 1) * r);
    g.arc(cx, cy, r, a0 + 1, a0 + 1 + (a1 - a0) * .55);
    g.quadraticCurveTo(cx + Math.cos(a0 + .55 + (a1 - a0) * .55) * r * .6, cy + Math.sin(a0 + .55 + (a1 - a0) * .55) * r * .6, cx, cy); g.fillStyle = c1; g.fill();
  }
  circ(g, cx, cy, r); g.strokeStyle = drk(c1, .4); g.lineWidth = 1.6; g.stroke();
  g.save(); g.globalAlpha = .55; g.fillStyle = '#fff'; ell(g, cx - r * .4, cy - r * .45, r * .3, r * .15, -.6); g.fill(); g.restore();
}
function flatSwirl(g, cx, cy, r, c1, c2) { swirlPop(g, cx, cy, r, c1, c2); }

/* ============================ THE BANANA (Fancy, the SuperBanana): a real 3D toy, baked into pictures ============================
   Apple Press look: a plump glossy body with one big soft highlight, a thick dark outline, tiny dot eyes, a little smile and pink blush.
   The body is a curved tube (a crescent with five soft ridges) that is shaded by a tiny software renderer ONCE per pose into a cached picture; the game only stamps pictures.
   The roll is that same 3D body turned about its long axis, 16 steps: the mask and the scarf band go round with it. */
var BW = 140, BH = 88, BOX = 64, BOY = 38;        // hero picture size and where the body's origin sits in it
var BL = 46, Y0 = -17, SAG = 17, RMAX = 20.5, YC = -8;   // half length, height of the tips, belly sag, fattest radius, the long axis the roll turns about
var SPINN = 16, NU = 34, NV = 22, SS = 1.5, TU = 256, TV = 256, FACE_U = .56, FACE_ARC = 2 * BL * 1.03;
var KNOT = [-27, 8], KX = -27, KY = 8, EYES = [[-9, -3], [8, -3]], BOWP = [-10, 14], FRI = { e0: [-8, 0], e1: [8, 0], top: [0, -16], chin: [-8, 14] }, TASKQ = [];   // live scarf anchor and eye spots in the hero frame (set by the renderer)
function bu(u) { var s = 2 * u - 1; return { x: BL * s, y: Y0 + SAG * (1 - s * s) }; }               // the centre line
function br(u) { var s = 2 * u - 1; return RMAX * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, u)))), .6) * (1 - .3 * s * s); }   // thickness along the length
function bn(u) { var s = 2 * u - 1, tx = 2 * BL, ty = -4 * SAG * s, l = Math.sqrt(tx * tx + ty * ty); return { tx: tx / l, ty: ty / l, nx: -ty / l, ny: tx / l }; }   // tangent and belly-side normal
function bsurf(u, th, sc) {   // a point on the skin (th: 0 belly, 90 degrees toward the viewer, 180 the spine)
  var c = bu(u), n = bn(u), k = sc || 1, r = br(u) * (1 + .035 * Math.cos(5 * th)) * k, ct = Math.cos(th), st = Math.sin(th), sl = (br(Math.min(1, u + .01)) - br(Math.max(0, u - .01))) / (u < .01 || u > .99 ? .01 : .02) / FACE_ARC;   // sl: how fast the thickness changes along the length (tilts the shading normal)
  return { x: c.x * k + r * ct * n.nx, y: c.y * k + r * ct * n.ny, z: r * st, nx: ct * n.nx - sl * n.tx, ny: ct * n.ny - sl * n.ty, nz: st };
}
function rotX(p, phi) {   // turn a point (and its normal) about the long axis
  var c = Math.cos(phi), s = Math.sin(phi), y = p.y - YC;
  return { x: p.x, y: YC + y * c + p.z * s, z: -y * s + p.z * c, nx: p.nx, ny: p.ny * c + p.nz * s, nz: -p.ny * s + p.nz * c };
}
/* ----- Fancy's mask and scarf colors (a challenge badge unlocks more of them); red is the default ----- */
var PAL = { m: '#e22a40', s: '#e22a40' };
function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mixHex(h, to, f) { var c = hexRgb(h), i; for (i = 0; i < 3; i++) c[i] = Math.round(c[i] + (to - c[i]) * f); return c; }
function rgbS(c, a) { return a === undefined ? 'rgb(' + c.join(',') + ')' : 'rgba(' + c.join(',') + ',' + a + ')'; }
function setColors(m, s) {   // the new colors are drawn into Fancy's pictures; the first face now, the rest in the background
  if (!/^#[0-9a-f]{6}$/i.test(m || '') || !/^#[0-9a-f]{6}$/i.test(s || '') || (m === PAL.m && s === PAL.s)) return false;
  PAL.m = m; PAL.s = s; RAMP[4] = [[0, mixHex(s, 0, .34)[0], mixHex(s, 0, .34)[1], mixHex(s, 0, .34)[2]], [.5, hexRgb(s)[0], hexRgb(s)[1], hexRgb(s)[2]], [1, mixHex(s, 255, .5)[0], mixHex(s, 255, .5)[1], mixHex(s, 255, .5)[2]]]; LUT = null;
  if (BAN) { var e, i; BAN.hero = []; BAN.spin = []; BAN.knots = []; BAN.spinT = null; HG = null; heroPic(0); for (e = 1; e < 5; e++) (function (e) { TASKQ.push(qHero(e)); })(e); for (i = 0; i < SPINN; i++) (function (i) { TASKQ.push(qSpin(i)); })(i); }
  return true;
}
/* ----- the face, painted flat in (length, around) space and wrapped onto the body by the renderer ----- */
function faceTex(kind, e, pupils) {   // kind 'hero' | 'friend'; e 0 smile, 1 happy, 2 grit (clenched teeth, slanted brows), 3 blink
  var c = document.createElement('canvas'); c.width = TU; c.height = TV; var g = c.getContext('2d', RF), sx = TU / FACE_ARC, sy = TV / (2 * Math.PI * RMAX);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.save(); g.translate(FACE_U * TU, TV / 4); g.scale(sx, -sy);   // y points DOWN the belly: y of the face art = down the screen at the front
  var hero = kind === 'hero', ex = hero ? 9.0 : 7.6, ey = hero ? -5.2 : -3.2, i, d, x;
  if (hero) {                                                                                                          // the red mask, with little upswept tips
    g.beginPath(); g.moveTo(-19, -5); g.quadraticCurveTo(-9, -9.5, 0, -6.5); g.quadraticCurveTo(9, -9.5, 19, -5); g.quadraticCurveTo(21, 3, 10, 5.6); g.quadraticCurveTo(0, 3.2, -10, 5.6); g.quadraticCurveTo(-21, 3, -19, -5); g.closePath();
    g.fillStyle = PAL.m; g.fill(); g.strokeStyle = rgbS(mixHex(PAL.m, 0, .39)); g.lineWidth = 1.2; g.stroke();
    g.fillStyle = rgbS(mixHex(PAL.m, 255, .55), .55); g.beginPath(); g.moveTo(-14, -6); g.quadraticCurveTo(-8, -8.6, -1, -6.4); g.quadraticCurveTo(-8, -6.2, -14, -6); g.fill();
  }
  for (i = 0; i < 2; i++) {
    d = i ? 1 : -1; x = d * ex;
    if (e === 3) { g.strokeStyle = '#3a1f10'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(x - 3.6, ey - .3); g.quadraticCurveTo(x, ey + 2.6, x + 3.6, ey - .3); g.stroke(); continue; }
    if (hero) { g.beginPath(); g.ellipse(x, ey - (e === 2 ? .6 : e === 4 ? 1.2 : 0), e === 4 ? 8.9 : 8.04, e === 2 ? 7.1 : e === 4 ? 11.2 : 9.48, 0, 0, 7); g.fillStyle = '#fffdf6'; g.fill(); g.strokeStyle = '#3a1f10'; g.lineWidth = 1.7; g.stroke(); }
    if (pupils || !hero) {
      var px = x + (e === 2 ? -d * .8 : e === 4 ? -d * .3 : d * .2) + .5, py = ey + (e === 2 ? 1.2 : e === 4 ? -2.2 : 1), pr = hero ? (e === 4 ? 3.4 : 5.64) : 2.5;
      g.beginPath(); g.arc(px, py, pr, 0, 7); g.fillStyle = '#2a140c'; g.fill(); g.beginPath(); g.arc(px + pr * .38, py - pr * .42, pr * .36, 0, 7); g.fillStyle = '#fff'; g.fill();
    }
    if (e === 4 && hero) { g.strokeStyle = '#3a1f10'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - d * 6.2, ey - 14.4); g.quadraticCurveTo(x, ey - 18.4, x + d * 6.2, ey - 14.8); g.stroke(); }
    if (e === 2 && hero) { g.strokeStyle = '#3a1f10'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + d * 7.4, ey - 7.8); g.lineTo(x - d * 5.6, ey - 3.4); g.stroke(); }
  }
  g.fillStyle = 'rgba(255,92,128,' + (e === 4 ? .75 : e === 1 ? .62 : e === 2 ? .3 : .42) + ')'; g.beginPath(); g.ellipse(-ex - 5, 7.4, 3.6, 2.2, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(ex + 5, 7.4, 3.6, 2.2, 0, 0, 7); g.fill();   // blush
  var my = hero ? 9.4 : 7.4;
  g.strokeStyle = '#3a1f10'; g.fillStyle = '#7a1d12'; g.lineWidth = 1.5;
  if (e === 4) { g.beginPath(); g.ellipse(0, my + 2.6, 4.4, 6.6, 0, 0, 7); g.fillStyle = '#5a0f0a'; g.fill(); g.lineWidth = 1.6; g.stroke(); g.fillStyle = '#e8566c'; g.beginPath(); g.ellipse(0, my + 6, 2.9, 2.2, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-1.6, my - .6, 1.2, .7, 0, 0, 7); g.fill();
    g.fillStyle = '#7fd4ff'; g.strokeStyle = '#2f7fb8'; g.lineWidth = .9; g.beginPath(); g.moveTo(ex + 11.6, ey - 7.5); g.quadraticCurveTo(ex + 14.2, ey - 3.2, ex + 11.6, ey - 1.8); g.quadraticCurveTo(ex + 9, ey - 3.2, ex + 11.6, ey - 7.5); g.fill(); g.stroke(); }
  else if (e === 2) { g.beginPath(); g.moveTo(-7.8, my - 1); g.quadraticCurveTo(0, my - 2.8, 7.8, my - 1); g.lineTo(8.2, my + 4.4); g.quadraticCurveTo(0, my + 7, -8.2, my + 4.4); g.closePath(); g.fillStyle = '#fffdf6'; g.fill(); g.lineWidth = 1.5; g.stroke(); g.lineWidth = .9; g.beginPath(); g.moveTo(-8, my + 1.7); g.quadraticCurveTo(0, my + 3, 8, my + 1.7); g.moveTo(-4, my - 1.6); g.lineTo(-4.2, my + 5); g.moveTo(0, my - 1.9); g.lineTo(0, my + 5.6); g.moveTo(4, my - 1.6); g.lineTo(4.2, my + 5); g.stroke(); }
  else if (e === 1 || pupils) { g.beginPath(); g.moveTo(-5.2, my - 1.4); g.quadraticCurveTo(0, my - 2.4, 5.2, my - 1.4); g.quadraticCurveTo(4.4, my + 6.6, 0, my + 6.8); g.quadraticCurveTo(-4.4, my + 6.6, -5.2, my - 1.4); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ff8c93'; g.beginPath(); g.ellipse(0, my + 5, 2.6, 1.5, 0, 0, 7); g.fill(); }
  else { g.beginPath(); g.moveTo(-4.6, my - 1); g.quadraticCurveTo(0, my + 3.6, 4.6, my - 1); g.stroke(); }
  g.restore();
  return c;
}
function bandsTex(c, hero) {   // the plain body paint shared by every face: stem and tip ends, and (hero) the red scarf band round the neck
  var g = c.getContext('2d', RF); g.save();
  if (hero) { g.fillStyle = PAL.s; g.fillRect(.15 * TU, 0, .075 * TU, TV); g.fillStyle = rgbS(mixHex(PAL.s, 0, .39)); g.fillRect(.15 * TU, 0, 1.4, TV); g.fillRect(.225 * TU - 1.4, 0, 1.4, TV); g.fillStyle = rgbS(mixHex(PAL.s, 255, .55), .55); g.fillRect(.16 * TU, 0, 2.2, TV); }
  g.restore(); return c;
}
function texData(c) { var d = c.getContext('2d', RF).getImageData(0, 0, TU, TV).data; return { d: d }; }
/* ----- a tiny software renderer: smooth-shaded triangles, a depth buffer, toon-soft lighting ----- */
var RAMP = [   // per material: colour stops from shadow to light
  [[0, 150, 96, 4], [.3, 216, 164, 14], [.58, 250, 223, 50], [.84, 255, 241, 104], [1, 255, 251, 186]],   // 0 banana skin (a cool lemon yellow, so Fancy never matches the amber coins)
  [[0, 164, 176, 214], [.5, 216, 224, 246], [1, 255, 255, 255]],                                          // 1 glove
  [[0, 56, 36, 14], [.5, 112, 82, 34], [1, 190, 160, 84]],                                                // 2 stem (olive brown)
  [[0, 46, 26, 12], [.5, 104, 66, 32], [1, 172, 122, 72]],                                                // 3 tip (dark brown)
  [[0, 150, 18, 36], [.5, 226, 42, 64], [1, 255, 128, 140]],                                              // 4 scarf knot
  [[0, 126, 54, 2], [.3, 204, 100, 6], [.58, 248, 150, 14], [.84, 255, 196, 54], [1, 255, 234, 146]]       // 5 gold coin (a warm amber, clearly different from Fancy)
];
var LUT = null;
function lut() { if (LUT) return LUT; LUT = []; RAMP.forEach(function (R, m) { var a = new Uint8Array(256 * 3), i, j, t, A, B, f; for (i = 0; i < 256; i++) { t = i / 255; for (j = 0; j < R.length - 1 && t > R[j + 1][0]; j++); A = R[j]; B = R[Math.min(j + 1, R.length - 1)]; f = B[0] === A[0] ? 0 : Math.min(1, Math.max(0, (t - A[0]) / (B[0] - A[0]))); a[i * 3] = A[1] + (B[1] - A[1]) * f; a[i * 3 + 1] = A[2] + (B[2] - A[2]) * f; a[i * 3 + 2] = A[3] + (B[3] - A[3]) * f; } LUT.push(a); }); return LUT; }
var LX = -.42, LY = -.62, LZ = .66, HLX, HLY, HLZ;
(function () { var l = Math.sqrt(LX * LX + LY * LY + LZ * LZ), x, y, z; LX /= l; LY /= l; LZ /= l; x = LX; y = LY; z = LZ + 1; l = Math.sqrt(x * x + y * y + z * z); HLX = x / l; HLY = y / l; HLZ = z / l; })();
var SB = SpriteBaker.wasm(), Rast = SB.Rast;   // the triangle filler and depth buffer are sprite-baker's (JS-modules); the fill runs in WebAssembly when the page allows it, and in plain JavaScript otherwise (the same pictures)
var RIDGE = { 0: { freq: 5, dark: -.86, darkScale: .93 }, 5: { freq: 5, dark: -.86, darkScale: .78, lit: .9, litAdd: .06 } };   // faint valleys between the banana's ridges (skin) and the coin's
function surf(mat, T) { return { lut: lut()[mat], specular: 1, bounce: 1, pool: 1, rimLight: 1, edge: mat === 1 ? .5 : .88, texture: T ? { w: TU, h: TV, data: T.d } : undefined, ridge: RIDGE[mat] }; }   // a material: the ramp, the paint picture (if any) and the ridges
function meshDraw(R, fn, nu, nv, sx, ox, oy, mat, T, phi) {   // fn(u, v) -> point on the skin (before the roll); quads become two triangles. While a picture is being built a slice at a time, each mesh is queued as its own job.
  if (R.jobs) { R.jobs.push(function () { meshNow(R, fn, nu, nv, sx, ox, oy, mat, T, phi); }); return; }
  meshNow(R, fn, nu, nv, sx, ox, oy, mat, T, phi);
}
function meshNow(R, fn, nu, nv, sx, ox, oy, mat, T, phi) {   // sample the skin on a grid (rolled by phi), then sprite-baker fills the quads
  var cols = nv + 1, n = (nu + 1) * cols, pos = new Float64Array(n * 3), nrm = new Float64Array(n * 3), uv = new Float64Array(n * 2), i, j, k, p;
  for (i = 0; i <= nu; i++) for (j = 0; j <= nv; j++) {
    k = i * cols + j; p = rotX(fn(i / nu, j / nv), phi);
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; nrm[k * 3] = p.nx; nrm[k * 3 + 1] = p.ny; nrm[k * 3 + 2] = p.nz; uv[k * 2] = i / nu; uv[k * 2 + 1] = j / nv * 2 * Math.PI;
  }
  SB.drawMesh(R, { nu: nu, nv: nv, pos: pos, nrm: nrm, uv: uv }, surf(mat, T), { scale: sx, ox: ox, oy: oy }, POSEF ? { pose: POSEF } : null);
}
function ballFn(cx, cy, cz, rx, ry, rz) { return function (u, v) { var ph = (u - .5) * Math.PI, th = v * 2 * Math.PI, cp = Math.cos(ph); return { x: cx + rx * cp * Math.cos(th), y: cy + ry * Math.sin(ph), z: cz + rz * cp * Math.sin(th), nx: cp * Math.cos(th) / rx, ny: Math.sin(ph) / ry, nz: cp * Math.sin(th) / rz }; }; }
function rodFn(x0, y0, z0, x1, y1, z1, r0, r1) {   // a short tube between two points (stem, glove cuff)
  var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, l = Math.sqrt(dx * dx + dy * dy + dz * dz), ax = dx / l, ay = dy / l, az = dz / l, ux = -ay, uy = ax, uz = 0, ul = Math.sqrt(ux * ux + uy * uy) || 1; ux /= ul; uy /= ul;
  var wx = ay * uz - az * uy, wy = az * ux - ax * uz, wz = ax * uy - ay * ux;
  return function (u, v) { var th = v * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th), r = r0 + (r1 - r0) * u, nx = c * ux + s * wx, ny = c * uy + s * wy, nz = c * uz + s * wz; return { x: x0 + dx * u + r * nx, y: y0 + dy * u + r * ny, z: z0 + dz * u + r * nz, nx: nx, ny: ny, nz: nz }; };
}
var POSEF = null;   // an extra turn for a whole picture (the gold banana spins about the upright axis)
function poseFn(tilt, yaw) {
  var ct = Math.cos(tilt), st = Math.sin(tilt), cy = Math.cos(yaw), sy = Math.sin(yaw), PY = -6;
  return function (p) { var x = p.x, y = p.y - PY, x1 = x * ct - y * st, y1 = x * st + y * ct, nx1 = p.nx * ct - p.ny * st, ny1 = p.nx * st + p.ny * ct; return { x: x1 * cy + p.z * sy, y: y1 + PY, z: -x1 * sy + p.z * cy, nx: nx1 * cy + p.nz * sy, ny: ny1, nz: -nx1 * sy + p.nz * cy }; };
}
function bodyScene(R, o) {   // draw one pose into the depth buffer: o = { phi, T, hero, sc (body scale), s (pixels per unit), ox, oy }
  var s = o.s, ox = o.ox, oy = o.oy, sc = o.sc || 1, phi = o.phi || 0, e0 = bu(0), e1 = bu(1), n0 = bn(0), n1 = bn(1);
  meshDraw(R, function (u, v) { return bsurf(u, v * 2 * Math.PI, sc); }, o.gold ? 20 : NU, o.gold ? 14 : NV, s, ox, oy, o.gold ? 5 : 0, o.T, phi);
  meshDraw(R, rodFn(e0.x * sc - n0.tx * 1, e0.y * sc - n0.ty * 1, 0, e0.x * sc - n0.tx * 6.5, e0.y * sc - n0.ty * 6.5 - 4.5, 0, 3.4 * sc, 2.5 * sc), 4, 12, s, ox, oy, 2, null, phi);   // stem
  meshDraw(R, ballFn(e0.x * sc - n0.tx * 7.4, e0.y * sc - n0.ty * 7.4 - 5.2, 0, 3 * sc, 2.1 * sc, 3 * sc), 8, 12, s, ox, oy, 2, null, phi);
  meshDraw(R, ballFn(e1.x * sc + n1.tx * 2.4, e1.y * sc + n1.ty * 2.4, 0, 4.4 * sc, 4.4 * sc, 4.4 * sc), 8, 12, s, ox, oy, 3, null, phi);                                                               // tip
}
function outlinePic(B, rpx, col) {   // thick dark outline all round: the picture, tinted, stamped in a ring behind itself
  var t = document.createElement('canvas'); t.width = B.width; t.height = B.height; var tg = t.getContext('2d', RF), o = document.createElement('canvas'), og, i, a;
  tg.drawImage(B, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, t.width, t.height);
  o.width = B.width; o.height = B.height; og = o.getContext('2d', RF);
  for (i = 0; i < 16; i++) { a = i * Math.PI / 8; og.drawImage(t, Math.round(Math.cos(a) * rpx), Math.round(Math.sin(a) * rpx)); }
  for (i = 0; i < 8; i++) { a = i * Math.PI / 4 + .39; og.drawImage(t, Math.cos(a) * rpx * .55, Math.sin(a) * rpx * .55); }
  og.drawImage(B, 0, 0); return o;
}
var OUTK = '#3a1f10';
function* posePicGen(o, w, h, ox, oy) {   // render one pose to a finished, outlined picture w x h (units), origin at (ox, oy) units; one mesh per slice (the queue runs a slice a frame), returns the picture
  var m = mk(w, h), sx = m.c.width / w, sy = m.c.height / h, ss = sx * SS, R = new Rast(Math.ceil(w * ss), Math.ceil(h * ss)), S = document.createElement('canvas'), sg, B, Bg, j;
  o.s = ss; o.ox = ox * ss; o.oy = oy * ss; R.jobs = []; POSEF = o.pose || null; bodyScene(R, o); POSEF = null; yield;
  for (j = 0; j < R.jobs.length; j++) { POSEF = o.pose || null; R.jobs[j](); POSEF = null; yield; }
  R.jobs = null;
  S.width = R.w; S.height = R.h; sg = S.getContext('2d', RF); sg.putImageData(new ImageData(R.px, R.w, R.h), 0, 0); R.release();
  B = document.createElement('canvas'); B.width = m.c.width; B.height = m.c.height; Bg = B.getContext('2d', RF); Bg.imageSmoothingQuality = 'high'; Bg.drawImage(S, 0, 0, B.width, B.height);
  m.g.setTransform(1, 0, 0, 1, 0, 0); m.g.drawImage(outlinePic(B, (o.ol || 2.1) * sx * (o.sc || 1), OUTK), 0, 0); m.g.setTransform(sx, 0, 0, sy, 0, 0);
  toyFinish(m, o, ox, oy);
  return m;
}
function posePic(o, w, h, ox, oy) { var g = posePicGen(o, w, h, ox, oy), r; while (!(r = g.next()).done); return r.value; }   // all at once (the same steps, run back to back)
function spot(u, th, phi, sc) { var p = rotX(bsurf(u, th, sc), phi); return [p.x, p.y, p.z]; }
var BTEX = null;
function initBanana() {   // Fancy (4 faces + the iris) and a friend are built now; the 16 roll steps are queued (ART.pump) so there is no hitch
  var e, ir = mk(20, 20), i;
  var eyeTh = Math.PI / 2 + 5.2 / RMAX, ux = 9.0 / FACE_ARC;
  EYES = [spot(FACE_U - ux, eyeTh, 0), spot(FACE_U + ux, eyeTh, 0)]; KNOT = spot(.19, .75, 0).slice(0, 2); BOWP = spot(.4, .55, 0).slice(0, 2);
  var fu = 7.6 / FACE_ARC, fth = Math.PI / 2 + 3.2 / RMAX; FRI = { e0: spot(FACE_U - fu, fth, 0, .9).slice(0, 2), e1: spot(FACE_U + fu, fth, 0, .9).slice(0, 2), top: spot(.5, Math.PI, 0, .9).slice(0, 2), chin: spot(.4, .55, 0, .9).slice(0, 2) };
  BAN = { friend: null, hero: [], iris: ir, spin: [], knots: [], spinT: null };
  ir.g.translate(10, 10); ir.g.beginPath(); ir.g.arc(0, 0, 5.64, 0, 7); ir.g.fillStyle = '#2a140c'; ir.g.fill(); ir.g.beginPath(); ir.g.arc(2.2, -2.4, 1.92, 0, 7); ir.g.fillStyle = '#fff'; ir.g.fill(); ir.g.beginPath(); ir.g.arc(-1.8, 2, .84, 0, 7); ir.g.fill();
  BAN.spinT = null;
  heroPrep(); TASKQ.push(qFriend());
  for (e = 1; e < 5; e++) (function (e) { TASKQ.push(qHero(e)); })(e);
  TASKQ.push(qFriend());
  for (i = 0; i < SPINN; i++) (function (i) { TASKQ.push(qSpin(i)); })(i);
}
var HG = null;
function heroName() { return 'hero0|' + PAL.m + PAL.s; }
function heroPrep() {   // the first face: from the saved copy at once, otherwise drawn in slices (heroStep) while the title is built, or all at once if it is asked for first
  var H0 = BAN.hero;
  if (PicCache.on && PicCache.boot && PicCache.take(heroName(), K)) { HG = null; heroPic(0); return; }
  HG = { H: H0, t: performance.now(), g: posePicGen({ T: texData(bandsTex(faceTex('hero', 0, false), true)), hero: true }, BW, BH, BOX, BOY) };
}
function heroRun(ms) {   // true once the first face is built
  var h = HG, t0 = performance.now(), r = null, pc, H;
  if (!h) return true;
  if (h.H !== BAN.hero) { HG = null; return true; }
  while (!(r = h.g.next()).done) { if (performance.now() - t0 >= ms) return false; }
  HG = null; H = BAN.hero; if (!H[0]) H[0] = r.value;
  pc = PicCache.on && PicCache.boot;
  if (pc) { PicCache.built(performance.now() - h.t); PicCache.save(heroName(), K, { m: function () { return pcSave(H[0]); } }); }
  return true;
}
function heroStep(ms) { return !HG || heroRun(ms); }
function heroPic(e) {
  var H, t, pc = e === 0 && PicCache.on && PicCache.boot, nm = 'hero0|' + PAL.m + PAL.s, got = pc ? PicCache.take(nm, K) : null;   // the first face is kept between visits (PicCache), per costume colors
  if (!BAN.hero[e] && e === 0 && HG) heroRun(1e9);
  if (!BAN.hero[e]) {
    if (got) BAN.hero[e] = pcLayer(got.m);
    else {
      t = performance.now(); BAN.hero[e] = posePic({ T: texData(bandsTex(faceTex('hero', e, e === 2 || e === 4), true)), hero: true }, BW, BH, BOX, BOY);
      if (pc) { PicCache.built(performance.now() - t); H = BAN.hero[e]; PicCache.save(nm, K, { m: function () { return pcSave(H); } }); }
    }
  }
  return BAN.hero[e];
}
function friendPic() { if (!BAN.friend) BAN.friend = posePic({ T: texData(faceTex('friend', 0, true)), hero: false, sc: .9 }, 112, 76, 58, 36); return BAN.friend; }
function qHero(e) { var H0 = BAN.hero; return slicer(function* () { var T, m; if (H0[e]) return; T = texData(bandsTex(faceTex('hero', e, e === 2 || e === 4), true)); yield; m = yield* posePicGen({ T: T, hero: true }, BW, BH, BOX, BOY); if (BAN.hero === H0 && !H0[e]) H0[e] = m; }, function () {}); }   // heroPic(e) in slices (for the queue)
function qFriend() { var B0 = BAN; return slicer(function* () { var T, m; if (B0.friend) return; T = texData(faceTex('friend', 0, true)); yield; m = yield* posePicGen({ T: T, hero: false, sc: .9 }, 112, 76, 58, 36); if (BAN === B0 && !B0.friend) B0.friend = m; }, function () {}); }   // friendPic() in slices
function qSpin(i) { var S0 = BAN.spin, K0 = BAN.knots; return slicer(function* () { var phi = i / SPINN * PI2, T, m; if (S0[i]) return; if (!BAN.spinT) { BAN.spinT = texData(bandsTex(faceTex('hero', 1, true), true)); yield; } if (BAN.spin !== S0) return; T = BAN.spinT; m = yield* posePicGen({ T: T, hero: true, phi: phi }, BW, BH, BOX, BOY); if (BAN.spin === S0 && !S0[i]) { S0[i] = m; K0[i] = spot(.19, .75, phi).slice(0, 2); } }, function () {}); }   // spinFrame(i) in slices
function spinFrame(i) { if (!BAN.spinT) BAN.spinT = texData(bandsTex(faceTex('hero', 1, true), true)); if (!BAN.spin[i]) { var phi = i / SPINN * PI2; BAN.spin[i] = posePic({ T: BAN.spinT, hero: true, phi: phi }, BW, BH, BOX, BOY); BAN.knots[i] = spot(.19, .75, phi).slice(0, 2); } return BAN.spin[i]; }

/* a scarf tail streaming backward from the knot: waves all the time, whips when he flaps, lifts when he falls */
var TPX = new Float64Array(14), TPY = new Float64Array(14);   // tailPath's points (top edge in 0 to 6, bottom edge in 7 to 13): reused, they used to be new lists every frame
function tailPath(g, t, flap, vy, len, wid, ph, droop) {   // adds one tail to the current path (both tails are filled and outlined together: fewer drawing calls)
  var n = 6, i, s, x, y, w, fl = Math.min(1, flap / .18), amp = 2.4 + fl * 6.6, lift = Math.max(-1, Math.min(1, (vy || 0) / -320)) * 9;
  for (i = 0; i <= n; i++) {
    s = i / n; x = KX - 2 - s * len * (1 + .14 * fl); y = KY + droop * s + Math.sin(t * 10 - s * 5 + ph) * amp * s + lift * s * s - fl * 3 * s; w = wid * (1 - .42 * s) / 2;
    TPX[i] = x; TPY[i] = y - w; TPX[7 + i] = x; TPY[7 + i] = y + w;
  }
  g.moveTo(KX, KY - 2); for (i = 0; i <= n; i++) g.lineTo(TPX[i], TPY[i]);
  g.lineTo(TPX[n] + 6, (TPY[n] + TPY[7 + n]) / 2); for (i = n; i >= 0; i--) g.lineTo(TPX[7 + i], TPY[7 + i]); g.lineTo(KX, KY + 2.5); g.closePath();
}
function bowTie(g, x, y, s) {
  g.save(); g.translate(x, y); g.rotate(-.35); g.scale(s || 1, s || 1);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-8, -5); g.lineTo(-8, 5); g.closePath(); fs(g, lg(g, -8, 0, 0, 0, [[0, '#ff6b81'], [1, '#c8283f']]), '#8a1a2b', 1.4);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(8, -5); g.lineTo(8, 5); g.closePath(); fs(g, lg(g, 0, 0, 8, 0, [[0, '#c8283f'], [1, '#ff6b81']]), '#8a1a2b', 1.4);
  circ(g, 0, 0, 2.6); fs(g, '#e23a54', '#8a1a2b', 1.2); g.restore();
}

/* Fancy. rot tilts him; up draws him upright for the shoot-'em-up (scarf streaming down). flap, vy and t pick the expression and move the scarf */
/* Costume pieces ride the roll: a piece on the head or face sits on the body at some height and depth around the roll axis (YC), so as Fancy rolls it swings round with him, squashes as it turns edge-on, flips over underneath and goes behind the body on the far side. Without a roll (phi 0) every piece is drawn exactly where it always was. */
function decor(g, bow, e, spin, phi, front) {
  var sn = spin ? Math.sin(phi) : 0, cs = spin ? Math.cos(phi) : 1, hx = (EYES[0][0] + EYES[1][0]) / 2 - 2, hy, y, z, dy;
  function top(ay, dz) { dy = ay - YC; y = YC + dy * cs + dz * sn; z = dz * cs - dy * sn; }
  function face(ay, dz) { dy = ay - YC; y = YC + dy * cs + dz * sn; z = dz * cs - dy * sn; }
  if (front && (bow & 1) && (!spin || (cs > .06 && (face(BOWP[1], 8), z > 0)))) { g.save(); if (spin) { g.translate(0, y - BOWP[1]); g.translate(BOWP[0], BOWP[1]); g.scale(1, cs); g.translate(-BOWP[0], -BOWP[1]); } bowTie(g, BOWP[0], BOWP[1], .85); g.restore(); }
  hy = EYES[0][1] - 17;
  if (bow & 2) { top(hy, 12); if (!spin || (z > 0) === front) { g.save(); g.translate(hx, spin ? y : hy); if (spin) g.scale(1, cs); g.rotate(-.2); crownDraw(g, .72); g.restore(); } }
  else if (bow & 4) {   // Emporium top hat (drawn live as vectors; the crown wins when both are worn)
    hy = EYES[0][1] - 15; top(hy, 12);
    if (!spin || (z > 0) === front) {
      g.save(); g.translate(hx, spin ? y : hy); if (spin) g.scale(1, cs); g.rotate(-.2); g.lineJoin = 'round'; g.strokeStyle = OUTK; g.lineWidth = 2;
      g.fillStyle = '#23212e'; g.beginPath(); g.ellipse(0, 0, 21, 5, 0, 0, PI2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-12, 0); g.lineTo(-11, -25); g.quadraticCurveTo(0, -28, 11, -25); g.lineTo(12, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#c8243a'; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-11.6, -7); g.lineTo(11.6, -7); g.lineTo(12, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(-7, -22, 3, 13); g.restore();
    }
  }
  if (front && (bow & 8) && (e < 2 || e === 3) && (!spin || (cs > .06 && (face(EYES[0][1], 17.5), z > 0)))) {   // Emporium cool shades
    g.save(); if (spin) { g.translate(0, y - EYES[0][1]); g.translate(0, EYES[0][1]); g.scale(1, cs); g.translate(0, -EYES[0][1]); }
    g.fillStyle = '#14121c'; g.strokeStyle = '#14121c'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(EYES[0][0] + 6, EYES[0][1] - 2); g.lineTo(EYES[1][0] - 6, EYES[1][1] - 2); g.stroke();
    for (dy = 0; dy < 2; dy++) { g.beginPath(); g.ellipse(EYES[dy][0], EYES[dy][1], 8.2, 7.2, 0, 0, PI2); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.8; for (dy = 0; dy < 2; dy++) { g.beginPath(); g.moveTo(EYES[dy][0] - 5, EYES[dy][1] - 2); g.lineTo(EYES[dy][0] - 1, EYES[dy][1] - 5); g.stroke(); }
    g.restore();
  }
}
function banana(g, x, y, rot, sc, flap, t, bow, vy, up, gaze, roll, face) {
  var e = face === 2 ? 2 : face === 4 ? 4 : (t % 3.7) < .13 ? 3 : 0, spin = roll >= 0, pic, kn = KNOT, si, gy;
  sc *= .66;
  if (spin) { si = Math.floor((roll % PI2) / PI2 * SPINN + .5) % SPINN; pic = spinFrame(si); kn = BAN.knots[si]; } else pic = heroPic(e);
  KX = kn[0]; KY = kn[1];
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
  g.save(); if (up) { g.translate(KX, KY); g.rotate(-1.45); g.translate(-KX, -KY); } g.beginPath(); tailPath(g, t, flap, vy, 40, 13, 0, 7); tailPath(g, t, flap, vy, 31, 11.5, 2.1, -3); g.fillStyle = PAL.s; g.fill(); g.strokeStyle = OUTK; g.lineWidth = 2.4; g.stroke(); g.restore();
  if (spin && bow) decor(g, bow, e, spin, si / SPINN * PI2, false);   // pieces that have rolled round behind the body
  g.drawImage(pic.c, -BOX, -BOY, BW, BH);
  if (e < 2 && !spin) { gy = 1.5 * Math.max(-1, Math.min(1, gaze || 0)); g.drawImage(BAN.iris.c, EYES[0][0] - 10 + .4, EYES[0][1] - 10 + gy + .4, 20, 20); g.drawImage(BAN.iris.c, EYES[1][0] - 10 + .4, EYES[1][1] - 10 + gy + .4, 20, 20); }   // eyes: the pupils follow the gaze
  decor(g, bow, e, spin, spin ? si / SPINN * PI2 : 0, true);
  g.restore();
}
/* banana friends: same body, a plain face, and small accessories so each one is different */
function friend(g, x, y, rot, sc, v) {
  var fe = FRI;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc * .7, sc * .7);
  g.drawImage(friendPic().c, -58, -36, 112, 76);
  g.lineWidth = 1.6; g.lineJoin = 'round';
  if (v === 1) { g.strokeStyle = OUTK; g.lineWidth = 2; circ(g, fe.e0[0], fe.e0[1], 8); g.stroke(); circ(g, fe.e1[0], fe.e1[1], 8); g.stroke(); g.beginPath(); g.moveTo(fe.e0[0] + 8, fe.e0[1]); g.lineTo(fe.e1[0] - 8, fe.e1[1]); g.stroke(); }
  if (v === 2) { var hx = fe.top[0], hy = fe.top[1] + 2; g.beginPath(); g.moveTo(hx - 8, hy); g.lineTo(hx + 1, hy - 29); g.lineTo(hx + 10, hy); g.closePath(); fs(g, lg(g, hx - 8, 0, hx + 10, 0, [[0, '#7ad8ff'], [1, '#3d9be0']]), OUTK, 1.8); circ(g, hx + 1, hy - 30, 3.8); fs(g, '#ff7fa9', OUTK, 1.5); }
  if (v === 3) bowTie(g, fe.chin[0], fe.chin[1], .95);
  if (v === 4) { var lx = fe.top[0] - 2, ly = fe.top[1] + 1; g.beginPath(); g.moveTo(lx - 3, ly); g.quadraticCurveTo(lx + 4, ly - 19, lx + 12, ly - 3); g.closePath(); fs(g, '#6ccf6c', OUTK, 1.6); g.beginPath(); g.moveTo(lx + 6, ly); g.quadraticCurveTo(lx + 15, ly - 21, lx + 22, ly - 4); g.closePath(); fs(g, '#8ae28a', OUTK, 1.6); }
  g.restore();
}
/* Prince Chimp: the villain (a cartoon sneer, nothing scary). mood 0 smug, 1 furious. Drawn once per size into a picture, then stamped */
var CHP = {};
function chimpDraw(g, mood) {
  var O = OUTK, lw = 3, i;
  g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-34, 20); g.quadraticCurveTo(-40, 52, -26, 58); g.lineTo(26, 58); g.quadraticCurveTo(40, 52, 34, 20); g.closePath();      // cape
  fb(g, lg(g, 0, 20, 0, 58, [[0, '#a85ae0'], [1, '#5a2a8a']]), O, lw);
  g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(-28, 28); g.quadraticCurveTo(-31, 42, -24, 52); g.quadraticCurveTo(-24, 40, -20, 30); g.fill();
  ell(g, 0, 24, 31, 9); fb(g, lg(g, 0, 15, 0, 33, [[0, '#ffffff'], [1, '#efe6d2']]), O, lw * .8);                                                         // fur collar
  [-1, 1].forEach(function (d) { circ(g, d * 33, -2, 11.5); fb(g, rg(g, d * 31, -5, 1, d * 33, -2, 13, [[0, '#a8744c'], [1, '#6a4128']]), O, lw); circ(g, d * 33, -2, 6); fb(g, '#f3cba2', null); });   // ears
  ell(g, 0, 0, 31.5, 29.5); fb(g, rg(g, -10, -15, 2, 0, 0, 38, [[0, '#b98458'], [1, '#6a4128']]), O, lw + .4);                                             // head
  g.beginPath(); g.moveTo(-26, 4); g.quadraticCurveTo(-30, -14, -12, -12); g.quadraticCurveTo(0, -4, 12, -12); g.quadraticCurveTo(30, -14, 26, 4);        // light face
  g.quadraticCurveTo(30, 26, 0, 27); g.quadraticCurveTo(-30, 26, -26, 4); g.closePath(); fb(g, lg(g, 0, -12, 0, 27, [[0, '#fbe3c4'], [1, '#e6b98c']]), null);
  g.fillStyle = 'rgba(255,255,255,.4)'; ell(g, -17, -19, 9, 4.6, -.55); g.fill();                                                                           // soft highlight on the brow
  var cry = mood === 2;   // 2 = blubbering: huge wet eyes looking up, sad slanted brows, a wide wailing mouth, tears streaming down both cheeks
  [-1, 1].forEach(function (d) {
    ell(g, d * 10.5, cry ? -1 : -1.5, cry ? 7.2 : 6.2, cry ? 8 : 6.6); fb(g, '#ffffff', O, 1.6); circ(g, d * 10.5 + (cry ? 0 : d * (mood ? -1.2 : 1)), cry ? -3.4 : -.6, cry ? 3.9 : 3.2); g.fillStyle = '#2a140c'; g.fill();
    circ(g, d * 10.5 + (cry ? d * 1.4 : d * (mood ? -2 : .2)), cry ? -5 : -2.2, cry ? 1.5 : 1.1); g.fillStyle = '#fff'; g.fill();
    g.strokeStyle = O; g.lineWidth = 3; g.beginPath(); if (cry) { g.moveTo(d * 3, -15.5); g.lineTo(d * 18, -8.5); } else { g.moveTo(d * 3, mood ? -8.5 : -9.5); g.lineTo(d * 18, mood ? -15.5 : -12); } g.stroke();                  // heavy brows
    if (cry) { g.beginPath(); g.moveTo(d * 10.5 - d * 2, 6); g.bezierCurveTo(d * 9, 14, d * 17, 20, d * 15, 30); g.strokeStyle = '#2f9fe0'; g.lineWidth = 5.4; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#9ee3ff'; g.lineWidth = 3.2; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1; g.stroke(); circ(g, d * 10.5, 6.6, 3); g.fillStyle = '#b8ecff'; g.fill(); }   // the tears
  });
  ell(g, 0, 10, 4.8, 3.2); fb(g, '#9a6644', O, 1.4); g.fillStyle = O; circ(g, -1.6, 10.4, .9); g.fill(); circ(g, 1.6, 10.4, .9); g.fill();
  if (cry) { ell(g, 0, 19.5, 9.5, 7); fb(g, '#5a1620', O, 2); ell(g, 0, 23, 5.4, 3); fb(g, '#ff7f95', null); rr(g, -5.5, 13, 11, 3.2, 1.4); fb(g, '#ffffff', O, 1); }
  else { g.strokeStyle = O; g.lineWidth = 2.4; g.beginPath(); if (mood) { g.moveTo(-9, 21); g.quadraticCurveTo(0, 15, 9, 21); } else { g.moveTo(-9, 17); g.quadraticCurveTo(0, 22, 10, 14); } g.stroke(); }
  g.fillStyle = 'rgba(255,110,140,.35)'; ell(g, -19, 13, 4.4, 2.6); g.fill(); ell(g, 19, 13, 4.4, 2.6); g.fill();
  g.save(); g.translate(0, -19); g.rotate(-.12); crownDraw(g, .94); g.restore();   /* the 3D crown */
}
function chimpPic(s, mood) {
  var key = (mood || 0) + '|' + s.toFixed(2), p = CHP[key];
  if (!p) { p = CHP[key] = mk(104 * s, 122 * s); p.g.scale(s, s); p.g.translate(52, 54); chimpDraw(p.g, mood || 0); }
  return p;
}
function chimp(g, cx, cy, s, mood) { put(g, chimpPic(s, mood).c, cx - 52 * s, cy - 54 * s); }

/* Prince Chimp's fights (build 4): the four bosses, a gold crown, and the things they throw. Each picture is built once, then stamped. They face left. */
var BOSSP = {}, FXP = {};
var CRP = null, GOLDM = -1;
function goldMat() { if (GOLDM < 0) { RAMP.push([[0, 104, 58, 6], [.32, 206, 138, 20], [.6, 250, 196, 58], [.84, 255, 228, 122], [1, 255, 250, 206]]); LUT = null; GOLDM = RAMP.length - 1; } return GOLDM; }   // polished gold: deep amber in the shade, pale cream on the glints
function crownWall(R0, R1, y0, hb, hp, inv) {   // the crown's wall: a ring of radius R0 at the bottom edge y0 flaring to R1, with five points (hp tall) rising from the band height hb
  return function (u, v) {
    var th = v * PI2, f = (th - Math.PI / 2) / (PI2 / 5), pk = 1 - Math.abs(f - Math.round(f)) * 2, H = hb + hp * pk, h = u * H, R = R0 + (R1 - R0) * (h / (hb + hp)), c = Math.cos(th), sn = Math.sin(th), q = inv ? -1 : 1;
    return { x: R * c, y: y0 - h, z: R * sn, nx: c * q, ny: .22 * q, nz: sn * q };
  };
}
function crownPic() {   // a real 3D crown: polished gold band and five points, pearl tips, a red velvet cap inside, and ruby, sapphire and emerald on the band. Built once per art scale.
  if (CRP) return CRP;
  var m = meshPic(64, 58, 1.7, function (Rr, s) {
    var ox = 32 * s, oy = 37 * s, ph = -.2, gm = goldMat(), i, a, R = 16.5, jw = [[Math.PI / 2, 3.7, '#e8143c'], [Math.PI / 2 - 1.2566, 2.9, '#2f7bff'], [Math.PI / 2 + 1.2566, 2.9, '#1fc46a']];
    meshNow(Rr, ballFn(0, -9, 0, R - 2.2, 8, R - 2.2), 14, 20, s, ox, oy, matFor('#b01830'), null, ph);                       // the velvet cap
    meshNow(Rr, crownWall(R - 1.4, R - 3.2, 4, 8, 0, true), 2, 40, s, ox, oy, matFor('#9a6414'), null, ph);                      // inside of the band
    meshNow(Rr, crownWall(R - 2, R - 4.4, -4, 7, 17, true), 2, 80, s, ox, oy, matFor('#a8741a'), null, ph);                      // inside of the points
    meshNow(Rr, crownWall(R + .6, R + .6, 4, 8, 0, false), 2, 40, s, ox, oy, gm, null, ph);                                       // the band
    meshNow(Rr, crownWall(R, R + 1.2, -4, 7, 17, false), 2, 80, s, ox, oy, gm, null, ph);                                        // the five points
    for (i = 0; i < 5; i++) { a = Math.PI / 2 + i * PI2 / 5; meshNow(Rr, ballFn((R + .4) * Math.cos(a), -28.6, (R + .4) * Math.sin(a), 2.5, 2.5, 2.5), 8, 12, s, ox, oy, matFor('#fff4dc'), null, ph); }   // pearls on the tips
    for (i = 0; i < 3; i++) { a = jw[i][0]; meshNow(Rr, ballFn((R + 1.3) * Math.cos(a), 0, (R + 1.3) * Math.sin(a), jw[i][1], jw[i][1] * 1.08, jw[i][1]), 10, 14, s, ox, oy, matFor(jw[i][2]), null, ph); }
    meshNow(Rr, rodFn(-R - .4, 4.6, 1, R + .4, 4.6, 1, 1.1, 1.1), 2, 14, s, ox, oy, matFor('#fff4dc'), null, ph);
  });
  var g = m.g;
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(24, 20); g.lineTo(25.1, 22.9); g.lineTo(28, 24); g.lineTo(25.1, 25.1); g.lineTo(24, 28); g.lineTo(22.9, 25.1); g.lineTo(20, 24); g.lineTo(22.9, 22.9); g.closePath(); g.fill();   // a glint on the front point
  g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, 29.6, 35.4, 1.5, .9, -.5); g.fill();                                              // the ruby's shine
  return (CRP = m);
}
function crownDraw(g, sc) {   // the crown, its band centered on (0, 0), the points rising up (sc 1 = about 38 units wide)
  var p = crownPic(); g.drawImage(p.c, -32 * sc, -37 * sc, 64 * sc, 58 * sc);
}
function chimpAt(g, x, y, s, mood) { g.save(); g.translate(x, y); g.scale(s, s); chimpDraw(g, mood); g.restore(); }
function fur(g, x, y, w, h, n, seed, col) {   // short fur tufts scattered inside an ellipse: fine strokes, a little darker than the coat
  var i, a, r, px, py, t; g.strokeStyle = col; g.lineWidth = 1.4; g.lineCap = 'round'; g.beginPath();
  for (i = 0; i < n; i++) { a = (i * 2.399 + seed) % 6.2832; r = Math.sqrt(((i * 0.618 + seed * .13) % 1)); px = x + Math.cos(a) * w * r; py = y + Math.sin(a) * h * r; t = (px - x) / w; g.moveTo(px, py); g.lineTo(px + t * 3, py + 4.4); }
  g.stroke();
}
function limb(g, x0, y0, x1, y1, r0, r1) {   // a tapered, round-ended limb as the current path (the caller fills it)
  var a = Math.atan2(y1 - y0, x1 - x0), h = Math.PI / 2, nx = Math.cos(a - h), ny = Math.sin(a - h);
  g.beginPath(); g.moveTo(x0 + nx * r0, y0 + ny * r0); g.lineTo(x1 + nx * r1, y1 + ny * r1); g.arc(x1, y1, r1, a - h, a + h, false); g.lineTo(x0 - nx * r0, y0 - ny * r0); g.arc(x0, y0, r0, a + h, a + 3 * h, false); g.closePath(); LB = Math.min(r0, r1) * 2;
}
function gHand(g, x, y, sc, rot, fist, FUR, SKIN, O) {   // a gorilla hand drawn pointing up: an open mitten (four fingers and a thumb) or, rotated, a fist whose knuckles rest on the floor
  var i, fx;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(-sc, sc);   // mirrored: the thumb sits on the side toward the body for both hands
  if (fist) {   // knuckles: a row of round bumps under a wide palm
    ell(g, 0, 0, 15, 12); fb(g, FUR(0, 0, 15), O, 3);
    [-9.5, -3.2, 3.2, 9.5].forEach(function (kx) { circ(g, kx, -9, 5); fb(g, FUR(kx, -9, 6), O, 2); });
    circ(g, -14, -2, 5.4); fb(g, FUR(-14, -2, 6), O, 2.2);
  } else {
    [[-9, -8, -11], [-3, -11, -14], [3, -11, -14], [9, -8, -11]].forEach(function (f) { limb(g, f[0], f[1] + 5, f[0] + (f[0] < 0 ? -1.4 : 1.4), f[2] - 7, 3.9, 3.5); fb(g, FUR(f[0], f[1] - 6, 5), O, 2); });   // fingers, behind the palm
    ell(g, 0, 2, 14.5, 12); fb(g, FUR(0, 2, 15), O, 3);
    limb(g, -10, 4, -19, -4, 4.8, 4.2); fb(g, FUR(-14, 0, 5), O, 2);   // the thumb
    ell(g, 0, 5, 8, 5); g.fillStyle = 'rgba(210,180,150,.35)'; g.fill();
  }
  g.restore();
}
function bossDraw(g, n, part) {
  var O = OUTK, i;
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (n === 1) {   // the Wafer Cannon wagon: a pink toy cart on spoked wheels (the balloons that hold it up are drawn by the game, so they can bob)
    [-30, 32].forEach(function (x) {
      circ(g, x, 54, 19); fb(g, rg(g, x - 5, 49, 2, x, 54, 20, [[0, '#d09a62'], [1, '#7a4a24']]), O, 3);
      circ(g, x, 54, 12.5); fb(g, rg(g, x - 3, 51, 1, x, 54, 13, [[0, '#f2d8a8'], [1, '#b87a42']]), O, 1.6);
      g.strokeStyle = O; g.lineWidth = 2.2; g.beginPath(); for (i = 0; i < 6; i++) { var an = i * 1.0472 + .3; g.moveTo(x, 54); g.lineTo(x + Math.cos(an) * 12, 54 + Math.sin(an) * 12); } g.stroke();
      circ(g, x, 54, 4.4); fb(g, rg(g, x - 1, 53, 0, x, 54, 5, [[0, '#fff3b0'], [1, '#d99a10']]), O, 1.6);
    });
    rr(g, -56, 18, 112, 34, 9); fb(g, lg(g, 0, 18, 0, 52, [[0, '#ffa6c4'], [.55, '#f06a9e'], [1, '#c23b72']]), O, 3);
    g.save(); rr(g, -56, 18, 112, 34, 9); g.clip(); g.strokeStyle = 'rgba(120,20,60,.28)'; g.lineWidth = 1.4; g.beginPath(); for (i = -4; i < 5; i++) { g.moveTo(i * 12 + 4, 32); g.lineTo(i * 12 + 4, 54); } g.stroke(); g.restore();
    g.fillStyle = 'rgba(255,255,255,.55)'; rr(g, -50, 22, 100, 5, 2.5); g.fill();
    g.fillStyle = '#fffdf6'; rr(g, -56, 28, 112, 4.4, 2); g.fill(); g.strokeStyle = O; g.lineWidth = 1.1; g.stroke();
    g.beginPath(); for (i = 0; i < 10; i++) { var sa = -Math.PI / 2 + i * 0.6283, sr = i % 2 ? 5.4 : 11; g.lineTo(0 + Math.cos(sa) * sr, 42 + Math.sin(sa) * sr); } g.closePath(); LB = 7; fb(g, gold(g, 33, 51), O, 1.4, .5);
    [-47, 47].forEach(function (x) { circ(g, x, 18, 4.4); fb(g, gold(g, 14, 22), O, 1.6, .6); });
    rr(g, -88, 14, 52, 22, 9); fb(g, lg(g, 0, 14, 0, 36, [[0, '#c4cade'], [.45, '#7a8098'], [1, '#3c4258']]), O, 3);   // the cannon barrel: steel, with a brass muzzle ring
    g.fillStyle = 'rgba(255,255,255,.5)'; rr(g, -82, 17.5, 40, 3.6, 1.8); g.fill();
    rr(g, -96, 7, 15, 36, 6); fb(g, gold(g, 7, 43), O, 3, .8); circ(g, -88, 25, 7.2); fb(g, rg(g, -88, 25, 1, -88, 25, 8, [[0, '#050608'], [1, '#2a2e3e']]), null);
    rr(g, -40, 12, 12, 28, 4); fb(g, gold(g, 12, 40), O, 2, .7);
    rr(g, 18, 6, 30, 14, 4); fb(g, lg(g, 0, 6, 0, 20, [[0, '#fbe6a8'], [1, '#d9b060']]), O, 2); g.beginPath(); for (i = 1; i < 4; i++) { g.moveTo(18 + i * 7.5, 6); g.lineTo(18 + i * 7.5, 20); } g.lineWidth = 1.4; g.stroke();
    chimpAt(g, -2, -14, .62, 1);
    rr(g, -24, 4, 44, 14, 6); fb(g, lg(g, 0, 4, 0, 18, [[0, '#b878ec'], [1, '#6a34a0']]), O, 2.6);   // the cart's front rim, in front of the chimp's cape
  } else if (n === 2) {   // Mecha-Chimp: a hovering robot suit; the fists launch from its right arm, the laser from the chest lamp
    [-24, 8].forEach(function (x) { rr(g, x, 44, 18, 30, 6); fb(g, lg(g, 0, 44, 0, 74, [[0, '#b8c0d6'], [1, '#5f6985']]), O, 3); rr(g, x - 4, 68, 26, 12, 5); fb(g, lg(g, 0, 68, 0, 80, [[0, '#6a7490'], [1, '#33394c']]), O, 3);
      rr(g, x + 2, 76, 14, 5, 2); fb(g, '#ff9a3c', null); });
    [-1, 1].forEach(function (d) { rr(g, d * 46 - 10, -4, 20, 46, 9); fb(g, lg(g, d * 46 - 10, 0, d * 46 + 10, 0, [[0, '#d4dae8'], [.5, '#8e98b4'], [1, '#5a6480']]), O, 3);
      g.strokeStyle = 'rgba(40,50,80,.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(d * 46 - 9, 16); g.lineTo(d * 46 + 9, 16); g.moveTo(d * 46 - 9, 26); g.lineTo(d * 46 + 9, 26); g.stroke();
      circ(g, d * 46, 44, 10); fb(g, rg(g, d * 46 - 3, 41, 1, d * 46, 44, 11, [[0, '#8a94b0'], [1, '#3a4258']]), O, 2.6); circ(g, d * 46, -4, 8); fb(g, rg(g, d * 46 - 2, -7, 1, d * 46, -4, 9, [[0, '#c4cce0'], [1, '#6a7490']]), O, 2.4); });
    rr(g, -42, -8, 84, 62, 15); fb(g, lg(g, 0, -8, 0, 54, [[0, '#e4e9f4'], [.5, '#a2adc6'], [1, '#6a7490']]), O, 3.4);
    g.fillStyle = 'rgba(255,255,255,.5)'; rr(g, -34, -3, 68, 6, 3); g.fill();
    g.strokeStyle = 'rgba(40,50,80,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-40, 38); g.lineTo(40, 38); g.stroke();
    circ(g, -22, 28, 12.5); fb(g, rg(g, -25, 24, 1, -22, 28, 13, [[0, '#ffffff'], [.35, '#ff9a9a'], [1, '#c81414']]), O, 2.6); g.strokeStyle = '#6a7490'; g.lineWidth = 3; circ(g, -22, 28, 14.6); g.stroke(); g.strokeStyle = O; g.lineWidth = 1.2; g.stroke();
    rr(g, 2, 16, 32, 24, 5); fb(g, lg(g, 0, 16, 0, 40, [[0, '#4a5470'], [1, '#2c3348']]), O, 2); for (i = 0; i < 3; i++) { circ(g, 10 + i * 10, 24, 3); fb(g, rg(g, 10 + i * 10 - 1, 23, 0, 10 + i * 10, 24, 3.4, [[0, '#ffffff'], [1, ['#ff4a6a', '#ffd93b', '#4fe0a0'][i]]]), null); }
    rr(g, 6, 31, 24, 4, 1.6); fb(g, '#1a2034', null);
    [[-36, 0], [36, 0], [-36, 46], [36, 46]].forEach(function (r) { circ(g, r[0], r[1], 2.4); fb(g, rg(g, r[0] - .6, r[1] - .6, 0, r[0], r[1], 2.6, [[0, '#ffffff'], [1, '#5a6480']]), null); });
    g.beginPath(); g.moveTo(0, -64); g.lineTo(0, -82); g.lineWidth = 3; g.strokeStyle = O; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = '#b8c0d6'; g.stroke(); circ(g, 0, -84, 5.4); fb(g, rg(g, -1.4, -85.4, 0, 0, -84, 6, [[0, '#ffffff'], [.4, '#ff6b81'], [1, '#c01838']]), O, 2);
    chimpAt(g, 0, -30, .72, 1);
    circ(g, 0, -30, 37); g.fillStyle = rg(g, -12, -46, 2, 0, -30, 38, [[0, 'rgba(255,255,255,.34)'], [.6, 'rgba(180,230,255,.14)'], [1, 'rgba(120,190,255,.32)']]); g.fill(); g.strokeStyle = O; g.lineWidth = 3.4; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3.4; g.beginPath(); g.arc(0, -30, 29, 3.55, 4.55); g.stroke(); g.lineWidth = 1.8; g.beginPath(); g.arc(0, -30, 29, 4.7, 4.95); g.stroke();
    rr(g, -26, -4, 52, 8, 4); fb(g, lg(g, 0, -4, 0, 4, [[0, '#c8d0e4'], [1, '#6a7490']]), O, 2.4);   // the neck ring where the dome meets the suit
  } else if (n === 3) {   // Gorilla Guard: a big round, glossy toy gorilla (barrel chest, proper shoulders, mitten hands with fingers and a thumb, toes)
    var FUR = function (x, y, r) { return rg(g, x - r * .35, y - r * .4, 2, x, y, r * 1.25, [[0, '#8a6c58'], [.5, '#523c2e'], [1, '#261a12']]); }, SKIN = function (x, y, r) { return rg(g, x - r * .3, y - r * .4, 1, x, y, r * 1.2, [[0, '#d8bc9a'], [1, '#8a6c4e']]); };
    var pt = part || 'body';   // the figure is cut into the body, the head and two arms, so the game can swing the arms
    if (pt === 'body') {
    [[-32, 80], [24, 80]].forEach(function (f) { ell(g, f[0], f[1], 23, 14); fb(g, FUR(f[0], f[1], 22), O, 3); [-12, -4, 4, 12].forEach(function (tx) { circ(g, f[0] + tx - 2, f[1] + 7, 4.6); fb(g, FUR(f[0] + tx, f[1] + 7, 5), O, 1.8); }); });   // big feet with toes
    ell(g, 0, 34, 55, 57); fb(g, FUR(0, 34, 56), O, 3.6); fur(g, 0, 34, 46, 48, 40, 1.3, 'rgba(20,12,8,.45)');
    ell(g, -5, 40, 31, 37); fb(g, SKIN(-5, 40, 36), O, 2.4);   // the pale chest and belly
    ell(g, -13, 24, 12, 7, .5); g.fillStyle = 'rgba(255,255,255,.38)'; g.fill();   // gloss on the chest
    ell(g, 0, 4, 44, 19); fb(g, FUR(0, 4, 44), O, 3);   // shoulders
    }
    if (pt === 'l') {
    limb(g, 30, 10, 60, 70, 17, 13); fb(g, FUR(46, 36, 22), O, 3);   // the resting arm: one thick limb from shoulder to wrist
    ell(g, 40, 30, 5, 15, -.45); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill();
    gHand(g, 61, 82, 1.1, 3.14159, true, FUR, SKIN, O);
    }
    if (pt === 'r') {
    limb(g, -33, 8, -62, 20, 17, 15); fb(g, FUR(-48, 14, 18), O, 3); limb(g, -62, 20, -62, -4, 14, 12); fb(g, FUR(-62, 8, 15), O, 3);   // the raised arm that holds the coconut
    circ(g, -62, 20, 13); g.fillStyle = FUR(-64, 18, 13); g.fill();
    gHand(g, -62, -6, 1.1, 0, false, FUR, SKIN, O);
    }
    if (pt === 'head') {
    circ(g, -28, -27, 9); fb(g, FUR(-28, -27, 9), O, 2.6); circ(g, -28, -27, 4.8); fb(g, SKIN(-28, -27, 5), 'rgba(0,0,0,0)', 0);
    circ(g, 28, -27, 9); fb(g, FUR(28, -27, 9), O, 2.6); circ(g, 28, -27, 4.8); fb(g, SKIN(28, -27, 5), 'rgba(0,0,0,0)', 0);   // ears
    ell(g, 0, -26, 30, 28); fb(g, FUR(0, -26, 30), O, 3.4);
    ell(g, 0, -17, 22, 18); fb(g, SKIN(0, -17, 22), O, 2);   // the pale face
    ell(g, 0, -8, 12.5, 9); fb(g, rg(g, -3, -11, 1, 0, -8, 13, [[0, '#f0d8b6'], [1, '#bf9c74']]), O, 1.8);   // the muzzle
    ell(g, -17, -11, 5.4, 3.2); g.fillStyle = 'rgba(255,110,140,.42)'; g.fill(); ell(g, 17, -11, 5.4, 3.2); g.fill();   // blush
    [-1, 1].forEach(function (d) { ell(g, d * 9.4, -24, 6.4, 7.2); fb(g, '#ffffff', O, 1.7); circ(g, d * 9.4 - 1.5, -23, 3.8); g.fillStyle = '#1a0e08'; g.fill(); circ(g, d * 9.4 - .2, -24.6, 1.4); g.fillStyle = '#fff'; g.fill(); circ(g, d * 9.4 - 2.6, -21.4, .7); g.fill(); g.beginPath(); g.moveTo(d * 2.4, -28.4); g.lineTo(d * 16.5, -35); g.lineWidth = 4; g.strokeStyle = '#150e08'; g.stroke(); });
    ell(g, -3.4, -10.4, 2.1, 1.5); g.fillStyle = '#2a1a10'; g.fill(); ell(g, 3.4, -10.4, 2.1, 1.5); g.fill(); g.beginPath(); g.moveTo(-6, -3); g.quadraticCurveTo(0, -7.4, 6, -3.2); g.lineWidth = 2.2; g.strokeStyle = O; g.stroke();
    ell(g, -12, -41, 10, 4.4, -.45); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill(); circ(g, -19, -37, 1.9); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();   // gloss on the head
    g.beginPath(); g.moveTo(-31, -40); g.quadraticCurveTo(0, -82, 31, -40); g.lineTo(27, -35); g.quadraticCurveTo(0, -50, -27, -35); g.closePath(); LB = 12; fb(g, lg(g, -30, -72, 30, -32, [[0, '#fff3b0'], [.45, '#f0bf45'], [1, '#b87a14']]), O, 3);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-22, -48); g.quadraticCurveTo(-10, -68, 6, -71); g.stroke();
    g.beginPath(); g.moveTo(-5, -64); g.lineTo(0, -84); g.lineTo(5, -64); g.closePath(); LB = 8; fb(g, lg(g, -5, -82, 5, -64, [[0, '#ff6a7e'], [1, '#c01838']]), O, 2);
    chimpAt(g, 36, -68, .46, 1);
    }
  } else {   // the Crown Duel: Prince Chimp himself, on a floating throne disc, scepter in hand
    if (part === 'sc') {   // the scepter on its own, so it can tilt and flash (drawn around the hand that holds it)
    g.beginPath(); g.moveTo(-58, 58); g.lineTo(-50, -30); g.lineWidth = 6; g.strokeStyle = O; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#f0cc60'; g.stroke(); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(-58.8, 54); g.lineTo(-51.4, -28); g.stroke();
    circ(g, -50, -36, 13); g.fillStyle = rg(g, -50, -36, 3, -50, -36, 14, [[0, 'rgba(255,200,215,.7)'], [1, 'rgba(255,120,150,0)']]); g.fill();
    circ(g, -50, -36, 9.4); fb(g, rg(g, -53, -39, 1, -50, -36, 10.4, [[0, '#ffffff'], [.4, '#ff6b81'], [1, '#c01838']]), O, 2.4);
      return;
    }
    ell(g, 0, 72, 58, 15); g.fillStyle = rg(g, 0, 70, 2, 0, 72, 60, [[0, 'rgba(255,240,170,.95)'], [1, 'rgba(255,200,80,0)']]); g.fill();
    ell(g, 0, 64, 44, 10.5); fb(g, lg(g, 0, 54, 0, 74, [[0, '#fff3b0'], [.5, '#f0bf45'], [1, '#a8701a']]), O, 3, .9);
    ell(g, 0, 60, 34, 6); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill();
    g.beginPath(); g.moveTo(-34, 4); g.quadraticCurveTo(-60, 40, -38, 62); g.lineTo(38, 62); g.quadraticCurveTo(60, 40, 34, 4); g.closePath(); LB = 24; fb(g, lg(g, -50, 4, 50, 62, [[0, '#e24650'], [.5, '#a01c2c'], [1, '#5e0c18']]), O, 3);
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-40, 14); g.quadraticCurveTo(-52, 40, -36, 56); g.stroke();
    g.strokeStyle = 'rgba(60,0,10,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, 30); g.quadraticCurveTo(-24, 46, -20, 60); g.moveTo(20, 30); g.quadraticCurveTo(26, 46, 22, 60); g.stroke();
    chimpAt(g, 0, 0, 1.12, 1);
    g.fillStyle = '#fff6c0'; [[-70, -48, 3], [-34, -52, 2.4], [60, 40, 2.6], [-72, 30, 2]].forEach(function (s) { g.beginPath(); g.moveTo(s[0], s[1] - s[2] * 1.6); g.lineTo(s[0] + s[2] * .5, s[1] - s[2] * .5); g.lineTo(s[0] + s[2] * 1.6, s[1]); g.lineTo(s[0] + s[2] * .5, s[1] + s[2] * .5); g.lineTo(s[0], s[1] + s[2] * 1.6); g.lineTo(s[0] - s[2] * .5, s[1] + s[2] * .5); g.lineTo(s[0] - s[2] * 1.6, s[1]); g.lineTo(s[0] - s[2] * .5, s[1] - s[2] * .5); g.closePath(); g.fill(); });
  }
}
function rimH(o, a) {   // a thin white band just inside the right edge of a picture (pure sideways shift, so stacked tiles show no seams)
  var c = o.c, k = c.width / (o.w || W), t = document.createElement('canvas'), g = t.getContext('2d', RF), q = o.g;
  t.width = c.width; t.height = c.height; g.drawImage(c, -3 * K, 0); g.globalCompositeOperation = 'destination-out'; g.drawImage(c, -6.5 * K, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(255,255,255,' + (a || .38) + ')'; g.fillRect(0, 0, t.width, t.height);
  q.save(); q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-atop'; q.drawImage(t, 0, 0); q.restore();
}
function toyFinish(m, o, ox, oy) {   // Apple Press: deep warm shade pooled lower right, a long curved gloss streak with a crisp white dot upper left, and a white rim light on the right edge
  var g = m.g, s = o.sc || 1, sx = m.c.width / m.w, i, u, c, n, r, x, y, pts = [], gr, gold = !!o.gold;
  g.save(); g.setTransform(sx, 0, 0, sx, 0, 0); g.globalCompositeOperation = 'source-atop';
  gr = g.createRadialGradient(ox + 32 * s, oy + 26 * s, 2, ox + 32 * s, oy + 26 * s, 54 * s); gr.addColorStop(0, gold ? 'rgba(120,60,0,.34)' : 'rgba(150,64,0,.55)'); gr.addColorStop(1, 'rgba(150,64,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, m.w, m.h);
  for (i = 0; i <= 8; i++) { u = .1 + i * .045; c = bu(u); n = bn(u); r = br(u); pts.push([ox + (c.x - n.nx * r * .45) * s, oy + (c.y - n.ny * r * .45) * s]); }
  gr = g.createLinearGradient(pts[0][0], pts[0][1], pts[8][0], pts[8][1]); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.22, 'rgba(255,255,255,.9)'); gr.addColorStop(.7, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.strokeStyle = gr; g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = .4; g.lineWidth = 9 * s; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (i = 1; i < 9; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); g.globalAlpha = 1; g.lineWidth = 4.6 * s; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (i = 1; i < 9; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
  g.lineWidth = 1.6 * s; g.globalAlpha = .75; g.beginPath(); u = .62; for (i = 0; i <= 4; i++) { c = bu(u + i * .035); n = bn(u + i * .035); r = br(u + i * .035); x = ox + (c.x - n.nx * r * .55) * s; y = oy + (c.y - n.ny * r * .55) * s; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(pts[2][0], pts[2][1], 1.7 * s, 0, 7); g.fill();
  g.restore(); rimLight(m);
}
function rimLight(p) {   // Apple Press: a thin band of bounced light just inside the right and lower edge of the whole figure (the silhouette minus itself shifted left and up, twice)
  var c = p.c, t = document.createElement('canvas'), g = t.getContext('2d', RF), k = c.width / p.w;
  t.width = c.width; t.height = c.height; g.drawImage(c, -3.5 * k, -1.2 * k); g.globalCompositeOperation = 'destination-out'; g.drawImage(c, -7 * k, -2.6 * k);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 0, t.width, t.height);
  var q = p.g; q.save(); q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-atop'; q.drawImage(t, 0, 0); q.restore();
}
function bossPic(n) { var p = BOSSP[n]; if (!p) { p = BOSSP[n] = mk(220, 236); p.g.translate(110, 124); bossDraw(p.g, n); rimLight(p); } return p; }
/* The gorilla and the Prince are cut into pieces so the game can move them: the gorilla's head and two arms (each turns about its shoulder), the Prince's scepter (turns about his hand) and his two hands. [picture width, height, pivot x, y in the picture, the same pivot in the figure's own coordinates] */
var BPT = { '3head': [220, 236, 110, 124, 0, 0], '3r': [120, 120, 80, 78, -33, 8], '3l': [130, 160, 40, 30, 30, 10], '4sc': [80, 140, 36, 92, -56, 22] };
function bossPart(n, k) {
  var key = n + k, p = BOSSP[key], d = BPT[key];
  if (!p) { p = BOSSP[key] = mk(d[0], d[1]); p.g.translate(d[2] - d[4], d[3] - d[5]); bossDraw(p.g, n, k); rimLight(p); p.px = d[2]; p.py = d[3]; }
  return p;
}
function bbox(c) {   // the box (device pixels) that holds everything painted in a picture, found once: copying only that box costs less, because a copy pays for the transparent pixels too (software drawing)
  try { var w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1, x, y; for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return [0, 0, 1, 1]; x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); return [x0, y0, Math.min(w, x1 + 2) - x0, Math.min(h, y1 + 2) - y0]; } catch (e) { return [0, 0, c.width, c.height]; }
}
function putT(g, p, x, y) {   // put() for a big picture with a lot of empty space around the painted part: same device pixels, smaller copy
  var b = p.bb || (p.bb = bbox(p.c)); x = Math.round(x * K) / K; y = Math.round(y * K) / K; g.drawImage(p.c, b[0], b[1], b[2], b[3], x + b[0] / K, y + b[1] / K, b[2] / K, b[3] / K);
}
function bossTurn(g, n, k, x, y, rot) {   // a part drawn turned by rot (radians, clockwise) about its pivot, which sits at (x, y)
  var p = bossPart(n, k), b; x = px(x); y = px(y);
  if (!rot) { putT(g, p, x - p.px, y - p.py); return; }
  b = p.bb || (p.bb = bbox(p.c)); g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(p.c, b[0], b[1], b[2], b[3], -p.px + b[0] / K, -p.py + b[1] / K, b[2] / K, b[3] / K); g.restore();
}
var HNDP = {};
function handDraw(g, open, m) {   // a chimp's hand, centered on 0,0: a relaxed fist, or an open palm with spread fingers (for holding a coconut up). m = -1 draws the other hand (fingers, knuckles and thumb on the opposite side; the shading and light stay put)
  m = m || 1; var O = OUTK, sk = function (x, y, r) { return rg(g, x - r * .3, y - r * .4, 1, x, y, r * 1.25, [[0, '#f0c090'], [.55, '#c88c5c'], [1, '#8a5a38']]); }, i, a;
  if (open) {
    for (i = 0; i < 4; i++) { a = (-48 + i * 32) * Math.PI / 180; ell(g, Math.sin(a) * 12 * m, 2 - Math.cos(a) * 12, 3.6, 7.2, a * m); fb(g, sk(Math.sin(a) * 12 * m, 2 - Math.cos(a) * 12, 7), O, 2); }
    ell(g, -11 * m, 7, 3.6, 6.4, -1.15 * m); fb(g, sk(-11 * m, 7, 6), O, 2);
    circ(g, 0, 3, 10.5); fb(g, sk(0, 3, 11), O, 2.4);
  } else {
    var f = -m;   // a fist: the thumb sits on the side toward the body (the finger knuckles on the outer side), for the hand on either side
    circ(g, 0, 0, 10.6); fb(g, sk(0, 0, 11), O, 2.4);
    for (i = 0; i < 3; i++) { circ(g, (-9 + (i === 1 ? -1 : 0)) * f, -6 + i * 6, 3.8); fb(g, sk(-9 * f, -6 + i * 6, 4), O, 1.8); }
    ell(g, 3 * f, -8, 3.6, 5, .6 * f); fb(g, sk(3 * f, -8, 5), O, 1.8);
  }
  g.fillStyle = 'rgba(255,255,255,.4)'; ell(g, -3.5, -2.6, 3.6, 2, -.6); g.fill();
}
function handPic(open, flip) { var key = (open ? 1 : 0) + (flip ? 2 : 0), p = HNDP[key]; if (!p) { p = HNDP[key] = mk(44, 44); p.g.translate(22, 22); handDraw(p.g, open, flip ? -1 : 1); rimLight(p); } return p; }
function hand(g, x, y, open, rot, flip) {   // flip: the hand on the other side of the body (its own picture, so it is still a plain 1:1 copy)
  var p = handPic(open, flip); x = px(x - 22); y = px(y - 22);
  if (!rot) { put(g, p.c, x, y); return; }
  g.save(); g.translate(x + 22, y + 22); g.rotate(rot); g.drawImage(p.c, -22, -22, 44, 44); g.restore();
}
function boss(g, n, cx, cy, pose) {   // pose (optional): the gorilla's arm angles r, l; the Prince's scepter tilt s, flash f and free hand (tx, ty, open)
  var q = pose || {};
  if (n === 4 && q.tx !== undefined && Math.abs(q.tx - 46) + Math.abs(q.ty - 34) > 2) {   // the throwing arm comes out from behind his cape and over his head: a stretchy cartoon arm drawn behind the body
    var ax = cx + 30, ay = cy + 10, hx = cx + q.tx, hy = cy + q.ty, dx = hx - ax, dy = hy - ay, d = Math.sqrt(dx * dx + dy * dy) || 1, L = 42, hh = Math.sqrt(Math.max(0, L * L - Math.min(d, 2 * L - 2) * Math.min(d, 2 * L - 2) / 4)), mx = (ax + hx) / 2, my = (ay + hy) / 2, nx = dy / d, ny = -dx / d, ex, ey;
    if (nx - ny * 0.5 < 0) { nx = -nx; ny = -ny; }   // the elbow bends out and up, away from the body
    if (d > 2 * L - 2) { hx = ax + dx * (2 * L - 2) / d; hy = ay + dy * (2 * L - 2) / d; mx = (ax + hx) / 2; my = (ay + hy) / 2; }   // never longer than a real arm: the hand is kept within reach
    ex = mx + nx * hh; ey = my + ny * hh;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.lineTo(hx, hy);
    g.strokeStyle = OUTK; g.lineWidth = 21; g.stroke(); g.strokeStyle = '#c28652'; g.lineWidth = 16; g.stroke(); g.strokeStyle = 'rgba(255,225,185,.5)'; g.lineWidth = 4; g.save(); g.translate(-2, -2.5); g.stroke(); g.restore(); g.restore();
  }
  putT(g, bossPic(n), cx - 110, cy - 124);
  if (n === 3) { bossTurn(g, 3, 'l', cx + 30, cy + 10, q.l || 0); bossTurn(g, 3, 'r', cx - 33, cy + 8, q.r || 0); putT(g, bossPart(3, 'head'), cx - 110, cy - 124); }
  else if (n === 4) {
    bossTurn(g, 4, 'sc', cx - 56, cy + 22, q.s || 0);
    if (q.f > 0.02) { g.save(); g.globalCompositeOperation = 'lighter'; var ox = -56 + Math.sin(q.s || 0) * 0 , a = q.s || 0, dx = 6 * Math.cos(a) + 58 * Math.sin(a), dy = 6 * Math.sin(a) - 58 * Math.cos(a), gr = g.createRadialGradient(cx - 56 + dx, cy + 22 + dy, 2, cx - 56 + dx, cy + 22 + dy, 34); gr.addColorStop(0, 'rgba(255,230,240,' + (0.9 * q.f).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,90,130,0)'); g.fillStyle = gr; g.fillRect(cx - 56 + dx - 36, cy + 22 + dy - 36, 72, 72); g.restore(); }
    hand(g, cx - 56, cy + 22, false, (q.s || 0), true);   // his other hand holds the scepter: a mirror image of the free hand, so he does not have two right hands
    hand(g, cx + (q.tx === undefined ? 46 : q.tx), cy + (q.ty === undefined ? 34 : q.ty), q.open === undefined ? false : q.open, q.tr || 0);
  }
}function fxPic(k) {   // 'coco': a coconut with a worried face; 'fist': a rocket fist (fingers point left)
  var p = FXP[k];
  if (!p) {
    p = FXP[k] = mk(44, 44); var g = p.g, i; g.translate(22, 22); g.lineJoin = 'round'; g.lineCap = 'round';
    if (k === 'lime') {   // a rocket lime flying to the right: a glossy green lime with little fins and a nozzle
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(-14, -9); g.lineTo(-3, -5); g.closePath(); fb(g, '#7fc43a', OUTK, 1.6, .6); g.beginPath(); g.moveTo(-8, 0); g.lineTo(-14, 9); g.lineTo(-3, 5); g.closePath(); fb(g, '#5aa028', OUTK, 1.6, .6);
      rr(g, -11, -3.2, 5, 6.4, 2); fb(g, '#6a7088', OUTK, 1.4, .6);
      ell(g, 1, 0, 12.5, 8.6); fb(g, rg(g, -2, -4, 1, 1, 0, 14, [[0, '#d8f58a'], [.45, '#8ad63c'], [1, '#3f8a1a']]), OUTK, 2.2, 1.1);
      g.strokeStyle = 'rgba(40,100,20,.4)'; g.lineWidth = .9; g.beginPath(); g.moveTo(-6, -5); g.quadraticCurveTo(0, -8, 8, -5); g.moveTo(-6, 5); g.quadraticCurveTo(0, 8, 8, 5); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.65)'; ell(g, -1, -4.4, 4.6, 1.8, -.12); g.fill();
      ell(g, 11.6, 0, 2.4, 2); fb(g, '#2f6a14', OUTK, 1, .4);
    } else if (k === 'coco') {
      circ(g, 0, 0, 15); fb(g, rg(g, -5, -6, 1, 0, 0, 18, [[0, '#b8845a'], [.6, '#7a4c2a'], [1, '#3c2212']]), OUTK, 2.6, 1.2);
      g.save(); circ(g, 0, 0, 14); g.clip(); g.strokeStyle = 'rgba(40,20,8,.35)'; g.lineWidth = .9; g.beginPath(); for (i = -3; i < 4; i++) { g.moveTo(i * 5 - 2, -15); g.quadraticCurveTo(i * 5 + 3, 0, i * 5 - 2, 15); } g.stroke(); g.restore();   // coarse husk fibers
      g.fillStyle = 'rgba(255,255,255,.55)'; ell(g, -6, -8.4, 4.4, 2.2, -.6); g.fill();
      ell(g, -4.6, -2, 2.9, 3.2); fb(g, '#fffdf6', OUTK, .9, .4); circ(g, -4.2, -1.4, 1.5); g.fillStyle = '#1a0e08'; g.fill(); ell(g, 4.6, -2, 2.9, 3.2); fb(g, '#fffdf6', OUTK, .9, .4); circ(g, 4.2, -1.4, 1.5); g.fillStyle = '#1a0e08'; g.fill();
      g.beginPath(); g.moveTo(-7, -6.4); g.lineTo(-2.4, -5.2); g.moveTo(7, -6.4); g.lineTo(2.4, -5.2); g.lineWidth = 1.4; g.strokeStyle = '#1a0e08'; g.stroke();   // worried brows
      g.beginPath(); g.moveTo(-4, 7); g.quadraticCurveTo(0, 3.6, 4, 7); g.lineWidth = 1.8; g.strokeStyle = '#1a0e08'; g.stroke();
    } else {
      rr(g, -2, -11, 22, 22, 6); fb(g, lg(g, 0, -11, 0, 11, [[0, '#d8deec'], [1, '#6a7490']]), OUTK, 2.6);
      rr(g, 2, -12, 7, 24, 2.4); fb(g, gold(g, -12, 12), OUTK, 1.6, .8);   // a brass cuff round the wrist
      for (i = 0; i < 4; i++) { rr(g, -16, -13 + i * 7, 18, 7, 3.4); fb(g, lg(g, 0, -13 + i * 7, 0, -6 + i * 7, [[0, '#e6ebf6'], [1, '#8690aa']]), OUTK, 2.2); }
      rr(g, 12, -5, 8, 10, 3); fb(g, lg(g, 0, -5, 0, 5, [[0, '#ffb060'], [1, '#e8641c']]), OUTK, 1.6);
      g.fillStyle = 'rgba(255,255,255,.6)'; rr(g, 3, -8, 3, 6, 1.5); g.fill();
    }
  }
  return p;
}
/* ===== The Gorilla Guard's arena (fight 3): a jungle clearing that does not scroll, coconut palms all around and a crowd of gorillas and chimps on tiered logs. The crowd watches, cheers when Fancy is hit, sulks when he clears a round and cries when the gorilla is beaten. ===== */
var ARN = null, ARTY = [372, 432, 494];   // where each tier's log sits (the spectators' bottom edge)
var ARCOL = [   // four fur colors: dark chimp, light chimp, black gorilla, silverback
  { gor: 0, f: ['#c9935f', '#8c5b38', '#4a2c1a'], k: ['#f6d0a8', '#d9a578'] }, { gor: 0, f: ['#e8bc84', '#b9824c', '#6a4020'], k: ['#fbe0c0', '#e0b088'] },
  { gor: 1, f: ['#7a6a60', '#3c302c', '#15100e'], k: ['#a89888', '#5a4a40'] }, { gor: 1, sv: 1, f: ['#aaaab8', '#5e5e6c', '#26262e'], k: ['#b8a898', '#6a5a50'] }];
function palmToy(g, x, yb, h, lean, s) {   // a glossy toy palm: a ringed, curved trunk, big drooping fronds and a bunch of coconuts
  var O = OUTK, cx = x + lean, cy = yb - h, N = 12, L = [], R = [], i, t, qx, qy, tx, ty, d, w, w0 = 9 * s, w1 = 5.4 * s, c1x = x + lean * .1, c1y = yb - h * .55;
  for (i = 0; i <= N; i++) {
    t = i / N; qx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * c1x + t * t * cx; qy = (1 - t) * (1 - t) * yb + 2 * (1 - t) * t * c1y + t * t * cy;
    tx = 2 * (1 - t) * (c1x - x) + 2 * t * (cx - c1x); ty = 2 * (1 - t) * (c1y - yb) + 2 * t * (cy - c1y); d = Math.hypot(tx, ty) || 1; w = w0 + (w1 - w0) * t;
    L.push([qx + ty / d * w, qy - tx / d * w]); R.push([qx - ty / d * w, qy + tx / d * w]);
  }
  g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (i = 1; i <= N; i++) g.lineTo(L[i][0], L[i][1]); for (i = N; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); LB = 0;
  fb(g, lg(g, x - w0, 0, x + w0 + Math.abs(lean), 0, [[0, '#f0c488'], [.45, '#c08040'], [1, '#6a4220']]), O, 2.6 * Math.max(.7, s));
  g.strokeStyle = 'rgba(60,30,10,.4)'; g.lineWidth = 1.5; g.beginPath(); for (i = 1; i < N; i++) { g.moveTo(L[i][0], L[i][1]); g.quadraticCurveTo((L[i][0] + R[i][0]) / 2, (L[i][1] + R[i][1]) / 2 + 3 * s, R[i][0], R[i][1]); } g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2.4 * s; g.lineCap = 'round'; g.beginPath(); for (i = 1; i < N - 1; i++) { qx = L[i][0] * .72 + R[i][0] * .28; qy = L[i][1] * .72 + R[i][1] * .28; if (i === 1) g.moveTo(qx, qy); else g.lineTo(qx, qy); } g.stroke();
  [[-165, 1], [-138, .95], [-112, .78], [-84, .72], [-58, .8], [-32, .98], [-8, 1], [-190, .9], [14, .85]].forEach(function (f, k) {
    var a = f[0] * Math.PI / 180, len = 66 * s * f[1], dr = len * (.32 + .3 * Math.abs(Math.cos(a))), tipx = cx + Math.cos(a) * len, tipy = cy + Math.sin(a) * len * .8 + dr, mx = cx + Math.cos(a) * len * .55, my = cy + Math.sin(a) * len * .8 - len * .12, pts = [], u, bx2, by2, nx, ny, nd, hw, P = [];
    for (u = 0; u <= 8; u++) { t = u / 8; bx2 = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * tipx; by2 = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * tipy; tx = 2 * (1 - t) * (mx - cx) + 2 * t * (tipx - mx); ty = 2 * (1 - t) * (my - cy) + 2 * t * (tipy - my); nd = Math.hypot(tx, ty) || 1; hw = 8.5 * s * Math.sin(Math.PI * Math.pow(t, .75)) + .8; nx = -ty / nd; ny = tx / nd; pts.push([bx2, by2, nx * hw, ny * hw]); }
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (u = 1; u <= 8; u++) g.lineTo(pts[u][0] + pts[u][2] * (u % 2 ? 1 : .7), pts[u][1] + pts[u][3] * (u % 2 ? 1 : .7)); for (u = 8; u >= 0; u--) g.lineTo(pts[u][0] - pts[u][2] * (u % 2 ? .7 : 1), pts[u][1] - pts[u][3] * (u % 2 ? .7 : 1)); g.closePath(); LB = 0;
    fb(g, lg(g, cx, cy - len, cx, cy + len * .6, [[0, k % 2 ? '#9cf060' : '#8be85a'], [.55, '#38b058'], [1, '#1c7a44']]), O, 2 * Math.max(.7, s), .6);
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (u = 1; u <= 8; u++) g.lineTo(pts[u][0], pts[u][1]); g.stroke();
  });
  [[-6, 7, 6.4], [6, 8, 6.4], [0, 14, 6.8]].forEach(function (n) { circ(g, cx + n[0] * s, cy + n[1] * s, n[2] * s); fb(g, rg(g, cx + (n[0] - 2) * s, cy + (n[1] - 2.4) * s, 1, cx + n[0] * s, cy + n[1] * s, n[2] * s * 1.3, [[0, '#c89060'], [.5, '#7a4a2a'], [1, '#3a2012']]), O, 2 * Math.max(.7, s)); });
}
function specDraw(g, c, mood) {   // one spectator from the chest up (0,0 is the bottom middle, hidden behind the log); mood 0 watching, 1 cheering, 2 sulking, 3 crying
  var O = OUTK, G = c.gor, F = function (x, y, r) { return rg(g, x - r * .35, y - r * .4, 1, x, y, r * 1.3, [[0, c.f[0]], [.55, c.f[1]], [1, c.f[2]]]); }, K2 = function (x, y, r) { return rg(g, x - r * .3, y - r * .4, 1, x, y, r * 1.25, [[0, c.k[0]], [1, c.k[1]]]); }, hy = -34 + (mood >= 2 ? 3 : 0), hr = G ? 17 : 15.5, d;
  ell(g, 0, -8, G ? 29 : 22, G ? 18 : 14); fb(g, F(0, -8, 24), O, 2.2);
  if (c.sv) { ell(g, 0, -13, 21, 8); g.fillStyle = 'rgba(214,218,228,.6)'; g.fill(); }
  [-1, 1].forEach(function (s) {
    if (mood === 1) { limb(g, s * 16, -8, s * 28, -42, 9, 6.5); fb(g, F(s * 22, -25, 10), O, 2); circ(g, s * 29, -47, 7); fb(g, K2(s * 29, -47, 7), O, 1.8); }
    else if (mood === 3) { circ(g, s * 12, -22, 6); fb(g, K2(s * 12, -22, 6), O, 1.8); }
    else { circ(g, s * (G ? 25 : 19), -3, 6.2); fb(g, F(s * 21, -3, 6), O, 1.8); }
  });
  if (!G) [-1, 1].forEach(function (s) { circ(g, s * 16.5, hy, 6.6); fb(g, F(s * 15, hy - 2, 7), O, 2); circ(g, s * 16.5, hy, 3.4); fb(g, K2(s * 16.5, hy, 3.4), null); });
  ell(g, 0, hy, hr, G ? 16 : 14.5); fb(g, F(0, hy, 19), O, 2.4);
  if (G) { ell(g, 0, hy - 14, 7, 5); fb(g, F(0, hy - 14, 7), O, 1.8); ell(g, 0, hy - 6, 14, 5.2); fb(g, F(0, hy - 6, 14), null); ell(g, 0, hy + 5, 10.5, 8.5); fb(g, K2(0, hy + 5, 10), O, 1.8); }
  else { ell(g, 0, hy + 3, 11.4, 10); fb(g, K2(0, hy + 3, 11), O, 1.8); }
  g.strokeStyle = O; g.lineWidth = 2; g.lineCap = 'round';
  [-1, 1].forEach(function (s) {
    var ex = s * 6.2, ey = hy - 1.5 + (G ? -2 : 0);
    if (mood === 1) { g.beginPath(); g.arc(ex, ey + 1.6, 3.3, 3.6, 5.8); g.stroke(); }
    else if (mood === 3) { g.beginPath(); g.moveTo(ex - 3.4, ey - .4); g.lineTo(ex + 3.4, ey + .8); g.stroke(); }
    else { ell(g, ex, ey, 3.4, 3.8); fb(g, '#ffffff', O, 1.2); circ(g, ex - (mood === 0 ? s * .2 + .3 : 0), ey + (mood === 2 ? 1.2 : .4), 1.8); g.fillStyle = '#1a0e08'; g.fill(); circ(g, ex - .6, ey - .6, .6); g.fillStyle = '#fff'; g.fill(); }
    if (mood === 2 || mood === 3) { g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.moveTo(s * 2.4, ey - 5.4 + (mood === 3 ? 0 : 0)); g.lineTo(s * 9.6, ey - 8.6 + 3.4); g.stroke(); }
    if (mood === 3) { g.beginPath(); g.moveTo(ex, ey + 3); g.bezierCurveTo(ex + s * 2, ey + 9, ex + s * 5, ey + 13, ex + s * 4, ey + 21); g.strokeStyle = '#3aa8ea'; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = '#b6ecff'; g.lineWidth = 1.5; g.stroke(); }
    g.strokeStyle = O; g.lineWidth = 2;
  });
  ell(g, 0, hy + (G ? 2 : 3.4), 3.2, 2.2); g.fillStyle = '#2a1a10'; g.fill();
  g.strokeStyle = O; g.lineWidth = 2; var my = hy + (G ? 8.6 : 9);
  if (mood === 1) { ell(g, 0, my + 1.4, 6.4, 5); fb(g, '#5a1620', O, 1.6); ell(g, 0, my + 3.6, 3.6, 2); fb(g, '#ff7f95', null); }
  else if (mood === 3) { ell(g, 0, my + 1.6, 4.6, 4); fb(g, '#5a1620', O, 1.6); }
  else if (mood === 2) { g.beginPath(); g.moveTo(-5, my + 3); g.quadraticCurveTo(0, my - 1.4, 5, my + 3); g.stroke(); }
  else { g.beginPath(); g.moveTo(-4.6, my); g.quadraticCurveTo(0, my + 3.6, 4.6, my); g.stroke(); }
  ell(g, -hr * .38, hy - hr * .62, hr * .36, 2.6, -.5); g.fillStyle = 'rgba(255,255,255,.42)'; g.fill();
}
function arenaTasks() {   // the arena is built a piece per step in the background (fightWarm), so the fight never starts with a hitch
  if (ARN) return; var A = ARN = { ok: 0, n: 0, sp: {}, back: null, logs: [], front: null }, T = TASKQ, r = rnd(31), i;
  function add(f) { A.n++; T.push(function () { f(); A.ok++; }); }
  add(function () {
    var m = A.back = mk(W, GY), g = m.g, q;
    q = lg(g, 0, 0, 0, GY, [[0, '#46b0e8'], [.3, '#8fdcf0'], [.62, '#d6f2d0'], [.8, '#fff0b4'], [1, '#ffe08a']]); g.fillStyle = q; g.fillRect(0, 0, W, GY);
    q = rg(g, 270, 120, 4, 270, 120, 190, [[0, 'rgba(255,255,230,.95)'], [.25, 'rgba(255,248,190,.5)'], [1, 'rgba(255,240,160,0)']]); g.fillStyle = q; g.fillRect(0, 0, W, GY);
    [[0, 330, '#5cb890', .85, 46, 30], [1, 352, '#3a9a70', .9, 52, 34]].forEach(function (row) {   // far canopy: rows of soft round treetops
      for (var x = -20; x < W + 40; x += row[4] * .7) { var rx = row[4] * (.7 + r() * .5), ry = row[5] * (.8 + r() * .5), yy = row[1] - r() * 18; ell(g, x, yy, rx, ry); g.fillStyle = rg(g, x - rx * .3, yy - ry * .5, 2, x, yy, rx * 1.2, [[0, 'rgba(190,240,190,' + row[3] + ')'], [1, row[2]]]); g.fill(); }
    });
    g.fillStyle = 'rgba(210,236,214,.32)'; g.fillRect(0, 150, W, GY - 150);
  });
  add(function () {
    var g = A.back.g, y, k, x, rx, t;
    [[92, 386, 190, -10, .85], [172, 380, 150, 6, .7], [255, 382, 170, -8, .78]].forEach(function (p) { palmToy(g, p[0], p[1], p[2], p[3], p[4]); });
    g.fillStyle = 'rgba(210,236,214,.16)'; g.fillRect(0, 100, W, GY - 100);
    [[22, 392, 230, 18, 1.05], [330, 390, 235, -22, 1.05]].forEach(function (p) { palmToy(g, p[0], p[1], p[2], p[3], p[4]); });
    for (t = 0; t < 3; t++) {   // the terraces: earth walls with stones and a grass lip
      y = ARTY[t]; var y2 = t < 2 ? ARTY[t + 1] : GY;
      g.fillStyle = lg(g, 0, y, 0, y2, [[0, '#a8744a'], [1, '#6e4528']]); g.fillRect(0, y, W, y2 - y);
      for (k = 0; k < 16; k++) { x = r() * W; rx = 6 + r() * 9; var sy = y + 14 + r() * Math.max(10, y2 - y - 26); ell(g, x, sy, rx, rx * .62); fb(g, rg(g, x - rx * .3, sy - rx * .3, 1, x, sy, rx * 1.2, [[0, '#d8c0a0'], [1, '#8a7058']]), 'rgba(60,34,18,.55)', 1.6, .5); }
      g.fillStyle = lg(g, 0, y - 2, 0, y + 14, [[0, '#9cf060'], [1, '#3aa04c']]); g.fillRect(0, y - 2, W, 13);
      for (k = 0; k < 22; k++) { x = k * 17 + r() * 8; g.strokeStyle = '#2a8a3e'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x + (r() - .5) * 6, y + 18 + r() * 5); g.stroke(); }
      g.fillStyle = lg(g, 0, y2 - 14, 0, y2, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(30,14,6,.35)']]); g.fillRect(0, y2 - 14, W, 14);
    }
  });
  for (i = 0; i < 3; i++) (function (t) {
    add(function () {   // a log along the front of each tier (drawn over the spectators' bottoms)
      var m = mk(W + 20, 26), g = m.g, y = 14, x;
      A.logs[t] = m; g.translate(10, 0);
      rr(g, -14, y - 11, W + 28, 22, 10); fb(g, lg(g, 0, y - 11, 0, y + 11, [[0, '#f0c48a'], [.4, '#c08648'], [1, '#6e4426']]), OUTK, 2.8);
      g.strokeStyle = 'rgba(255,255,255,.34)'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(-6, y - 5); g.lineTo(W + 6, y - 5); g.stroke();
      g.strokeStyle = 'rgba(70,36,12,.4)'; g.lineWidth = 1.4; for (x = 20 + t * 11; x < W; x += 58 + t * 9) { g.beginPath(); g.moveTo(x, y - 8); g.quadraticCurveTo(x + 7, y, x - 2, y + 8); g.stroke(); }
      [W + 8, -8].forEach(function (ex) { ell(g, ex, y, 9, 11); fb(g, rg(g, ex - 2, y - 2, 1, ex, y, 11, [[0, '#f4d4a0'], [1, '#a8703c']]), OUTK, 2); ell(g, ex, y, 4.4, 5.6); g.strokeStyle = 'rgba(90,50,20,.5)'; g.lineWidth = 1.2; g.stroke(); });
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(205,236,214,.12)'; g.fillRect(-20, 0, W + 60, 30);
    });
  })(i);
  add(function () {   // the foreground palms at the two edges
    var m = mk(W, GY, K, true), g = m.g, d, i, mid = true;
    palmToy(g, -10, GY + 10, 380, 52, 1.7); palmToy(g, 372, GY + 10, 400, -50, 1.8);
    try { d = g.getImageData(Math.round(140 * K), 0, Math.round(80 * K), m.c.height).data; for (i = 3; i < d.length; i += 4) if (d[i]) { mid = false; break; } } catch (e) { mid = false; }   // only the two edge palms are drawn: when the middle is empty keep just two strips (a full-screen blend every frame for two narrow trees was wasteful)
    if (mid) { var L = mk(140, GY), R = mk(140, GY); L.g.drawImage(m.c, 0, 0, Math.round(140 * K), m.c.height, 0, 0, 140, GY); R.g.drawImage(m.c, m.c.width - Math.round(140 * K), 0, Math.round(140 * K), m.c.height, 0, 0, 140, GY); A.fl = L; A.fr = R; } else A.front = m;
  });
  ARCOL.forEach(function (c, ci) { for (var mood = 0; mood < 4; mood++) (function (ci, mood) { add(function () { [.74, .88, 1].forEach(function (sc, t) { var p = A.sp[ci + '|' + mood + '|' + t] = mk(86 * sc, 90 * sc); p.g.scale(sc, sc); p.g.translate(43, 76); specDraw(p.g, ARCOL[ci], mood); p.g.globalCompositeOperation = 'source-atop'; p.g.fillStyle = 'rgba(205,236,214,.12)'; p.g.fillRect(-90, -90, 260, 260); }); }); })(ci, mood); });
  add(function () { var m = mk(W, GY); arenaLive(m.g, { m: 0, p: 0, t: 9, time: 0 }); A.bake = m; });   // the still, watching crowd with the whole arena in one picture
}
var ARS = null;   // the spectators: tier, x, color
function arenaDraw(g, cr) {   // cr: { m: mood now, p: the mood before, t: seconds since it changed, time }
  var A = ARN;
  if (!A || A.ok < A.n) return false;
  if (A.bake && cr.m === 0 && cr.t > 0.7) { put(g, A.bake.c, 0, 0); return true; }   // a crowd that is just watching is still: the whole arena is one picture
  return arenaLive(g, cr);
}
function arenaLive(g, cr) {
  var A = ARN, t, i, n, s, md, dl, y, p, bob, tm = cr.time;
  if (!ARS) { ARS = []; var r = rnd(77); [[10, 40, 14], [8, 44, 34], [6, 62, 22]].forEach(function (tr, ti) { for (var k = 0; k < tr[0]; k++) ARS.push({ t: ti, x: tr[2] + k * tr[1] + (r() - .5) * 8, c: Math.floor(r() * 4), d: Math.floor(r() * 11) * .045, j: r() * 6.28 }); }); }
  put(g, A.back.c, 0, 0);
  for (t = 0; t < 3; t++) {
    for (i = 0; i < ARS.length; i++) {
      s = ARS[i]; if (s.t !== t) continue;
      md = cr.t >= s.d ? cr.m : cr.p; p = A.sp[s.c + '|' + md + '|' + t]; y = ARTY[t] + 1;
      bob = md === 1 ? -Math.abs(Math.sin(tm * 8.5 + s.j)) * (5 + t * 1.6) : md === 0 ? 0 : md === 2 ? 2 + Math.sin(tm * 1.4 + s.j) * .6 : 2 + Math.sin(tm * 17 + s.j) * .8;
      put(g, p.c, s.x - 43 * [.74, .88, 1][t], y + bob - 76 * [.74, .88, 1][t]);   // whole device pixels: a picture at a fraction of a pixel is resampled, which costs several times more in Firefox
    }
    put(g, A.logs[t].c, -10, ARTY[t] - 14);
  }
  if (A.front) put(g, A.front.c, 0, 0); else { put(g, A.fl.c, 0, 0); put(g, A.fr.c, W - 140, 0); }
  return true;
}
function fightWarm(n) { TASKQ.push(function () { var q = bossPic(n); q.bb = q.bb || bbox(q.c); }); TASKQ.push(function () { fxPic('coco'); }); TASKQ.push(function () { fxPic('fist'); }); TASKQ.push(function () { fxPic('lime'); }); TASKQ.push(function () { chimpPic([.62, .72, .46, 1.12][n - 1], 2); });  if (n === 3) { TASKQ.push(function () { ['head', 'r', 'l'].forEach(function (k) { var q = bossPart(3, k); q.bb = q.bb || bbox(q.c); }); }); arenaTasks(); } if (n === 4) TASKQ.push(function () { bossPart(4, 'sc'); handPic(0); handPic(1); handPic(0, 1); }); }
function fxs(g, k, x, y, rot) { var p = fxPic(k); g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.drawImage(p.c, -22, -22, 44, 44); g.restore(); }

/* ============================ STAGE SETS ============================ */
var DEF = [];
var TH = 70;                                  // standard tile height

/* ---------- "puff": make a flat painted picture look like a lit, rounded 3D toy (bevel from a blurred copy of its own shape) ---------- */
function boxBlur(src, w, h, r, tmp) {   // one running-sum box blur pass each way
  var x, y, i, s, n = 2 * r + 1, o = new Float32Array(w * h);
  for (y = 0; y < h; y++) { s = 0; for (x = -r; x <= r; x++) s += src[y * w + Math.min(w - 1, Math.max(0, x))]; for (x = 0; x < w; x++) { o[y * w + x] = s / n; s += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]; } }
  for (x = 0; x < w; x++) { s = 0; for (y = -r; y <= r; y++) s += o[Math.min(h - 1, Math.max(0, y)) * w + x]; for (y = 0; y < h; y++) { tmp[y * w + x] = s / n; s += o[Math.min(h - 1, y + r + 1) * w + x] - o[Math.max(0, y - r) * w + x]; } }
  return tmp;
}
function* puff(g, amt, vopen) {   // vopen: a tile that repeats up and down, so its top and bottom edges stay open (no bevel there). Runs in slices.
  var c = g.canvas, w = c.width, h = c.height, im = g.getImageData(0, 0, w, h), d = im.data, n = w * h, A = new Float32Array(n), H, T = new Float32Array(n), i, x, y, nx, ny, nz, l, t, sp, f, r = Math.max(2, Math.round(4.2 * K)), dx, dy, k = amt || 1, y0 = Math.round(PAD * K), y1 = h - y0 - 1, ye;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) A[y * w + x] = d[((vopen ? Math.min(y1, Math.max(y0, y)) : y) * w + x) * 4 + 3] / 255;
  yield; H = boxBlur(A, w, h, r, T); yield; H = boxBlur(H, w, h, r, new Float32Array(n)); yield; H = boxBlur(H, w, h, Math.max(1, r >> 1), new Float32Array(n)); yield;
  for (y = 1; y < h - 1; y += 48) {
    ye = Math.min(h - 1, y + 48);
    for (var yy = y; yy < ye; yy++) for (x = 1; x < w - 1; x++) {
      i = yy * w + x; if (d[i * 4 + 3] < 8) continue;
      dx = H[i + 1] - H[i - 1]; dy = H[i + w] - H[i - w]; nx = -dx * r * 1.7; ny = -dy * r * 1.7; nz = 1; l = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz); nx *= l; ny *= l; nz *= l;
      t = (nx * LX + ny * LY + nz * LZ) * .5 + .5; f = .66 + .66 * t; f = 1 + (f - 1) * k;
      sp = nx * HLX + ny * HLY + nz * HLZ; sp = sp > 0 ? Math.pow(sp, 26) * .32 * k * 255 : 0;
      i *= 4; d[i] = Math.min(255, d[i] * f + sp); d[i + 1] = Math.min(255, d[i + 1] * f + sp); d[i + 2] = Math.min(255, d[i + 2] * f + sp);
    }
    yield;
  }
  g.putImageData(im, 0, 0);
}
/* ---------- 0: CANDY SHOP ---------- */
/* ---------- the obstacles are glossy 3D toys in the same renderer as Fancy ---------- */
var MATS = {};
function matFor(c) {   // a shaded ramp for any flat colour: the same soft lighting Fancy gets
  if (MATS[c] !== undefined) return MATS[c]; var d = hex(drk(c, .4)), m = hex(c), l = hex(lit(c, .72));
  RAMP.push([[0, d[0], d[1], d[2]], [.5, m[0], m[1], m[2]], [1, l[0], l[1], l[2]]]); LUT = null; return (MATS[c] = RAMP.length - 1);
}
var SCR = {};
function scratch(w, h) { var k = w + 'x' + h, c = SCR[k]; if (!c) { c = SCR[k] = document.createElement('canvas'); c.width = w; c.height = h; } return c; }   // temporary canvases are reused (new canvases are slow to make in Firefox)
function* toy3(g, w, h, build) {   // draw 3D shapes into a picture w x h (units) and stamp it, one mesh per slice; build(R, s) queues the meshes
  var ss = K * 1.25, R = new Rast(Math.ceil(w * ss), Math.ceil(h * ss)), S, j, sg;
  R.jobs = []; build(R, ss); yield;
  for (j = 0; j < R.jobs.length; j++) { R.jobs[j](); yield; }
  R.jobs = null; S = scratch(R.w, R.h); sg = S.getContext('2d', RF); sg.putImageData(new ImageData(R.px, R.w, R.h), 0, 0); R.release();   // (no yield between filling the shared scratch and stamping it: another build could overwrite it)
  g.save(); g.imageSmoothingQuality = 'high'; g.drawImage(S, 0, 0, w, h); g.restore();
}
function ball3(R, s, x, y, z, rx, ry, rz, mat, nu, nv, T) { meshDraw(R, ballFn(x, y, z, rx, ry, rz), nu || 10, nv || 14, s, 0, 0, mat, T || null, 0); }
function domeFn(cx, cy, r, rz) {   // a round lollipop face: rim at the edge, the front pole in the middle (u 0 at the rim, 1 in the middle; v is the angle)
  return function (u, v) { var ph = u * Math.PI / 2, th = v * PI2, cp = Math.cos(ph), sp = Math.sin(ph); return { x: cx + r * cp * Math.cos(th), y: cy + r * cp * Math.sin(th), z: rz * sp, nx: cp * Math.cos(th) / r, ny: cp * Math.sin(th) / r, nz: sp / rz }; };
}
function stripeTex(fn, rgb) {   // a repeating paint (pink on nothing) written straight into a texture: fn(x01, y01) -> 0..1 coverage
  var c = document.createElement('canvas'), g, im, i, x, y, a; c.width = TU; c.height = TV; g = c.getContext('2d', RF); im = g.createImageData(TU, TV);
  for (y = 0; y < TV; y++) for (x = 0; x < TU; x++) { a = fn((x + .5) / TU, (y + .5) / TV); i = (y * TU + x) * 4; im.data[i] = rgb ? rgb[0] : 255; im.data[i + 1] = rgb ? rgb[1] : 84; im.data[i + 2] = rgb ? rgb[2] : 130; im.data[i + 3] = Math.round(a * 255); }
  g.putImageData(im, 0, 0); return texData(c);
}
function stripe01(s) { s = s - Math.floor(s); var d = Math.abs(s - .25); return Math.max(0, Math.min(1, (.25 - d) / .035 + .5)); }   // a soft-edged stripe: 1 in the middle of the pink half, 0 in the white half
function dotTex(seed, n, cols, len, wid) {   // small coloured dashes scattered over a surface (sprinkles, chips); wraps round the body
  var c = document.createElement('canvas'), g, r = rnd(seed), i, x, y, q; c.width = TU; c.height = TV; g = c.getContext('2d', RF); g.lineCap = 'round';
  for (i = 0; i < n; i++) { x = r() * TU; y = r() * TV; q = r() * PI2; g.strokeStyle = cols[i % cols.length]; g.lineWidth = wid; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(q) * len, y + Math.sin(q) * len); g.stroke(); if (y < len) { g.beginPath(); g.moveTo(x, y + TV); g.lineTo(x + Math.cos(q) * len, y + TV + Math.sin(q) * len); g.stroke(); } }
  return texData(c);
}
function cyl3(R, s, x0, y0, x1, y1, r0, r1, mat, T) { meshDraw(R, rodFn(x0, y0, 0, x1, y1, 0, r0, r1), 4, 28, s, 0, 0, mat, T || null, 0); }
function thin(s, w) { var d = Math.abs(s - Math.round(s)); return Math.max(0, Math.min(1, (w - d) / (w * .5))); }   // a thin line at every whole number
function* capA(g, side) {
  var i, r, a, d, cy;
  if (side === 1) {   // the gumball machine: glass globe full of 3D gumballs on a glossy red body
    plank(g, 0, 88, OW, 8, '#ffe9d6', '#e0ab88');
    circ(g, 29, 29, 26); g.fillStyle = 'rgba(214,236,255,.62)'; g.fill();
    yield* toy3(g, OW, 96, function (R, s) {
      r = rnd(21);
      for (i = 0; i < 40; i++) { a = r() * PI2; d = Math.sqrt(r()) * 17.5; cy = 32 + Math.sin(a) * d * 1.05; if (cy > 19) ball3(R, s, 29 + Math.cos(a) * d, cy, r() * 10 - 2, 6.4, 6.4, 6.4, matFor(CAN[i % 6]), 9, 12); }
      ball3(R, s, 29, 70, 0, 22.5, 20.5, 17, matFor('#e8344a'), 14, 20);                 // the red body
      ball3(R, s, 29, 53.5, 0, 20, 5.2, 16, 5, 6, 18);                                    // a gold collar
      ball3(R, s, 29, 3.5, 0, 9.5, 6, 9.5, 5, 8, 14);                                     // and a gold lid
    });
    circ(g, 29, 29, 26.5); g.strokeStyle = 'rgba(120,170,220,.95)'; g.lineWidth = 1.6; g.stroke();
    g.save(); g.globalAlpha = .75; g.fillStyle = '#fff'; ell(g, 17.5, 14.5, 7, 3.2, -.7); g.fill(); g.globalAlpha = .45; ell(g, 41, 41, 2, 5, .6); g.fill(); g.restore();
    rr(g, 18, 63, 22, 13, 4); fs(g, '#fff6ea', '#a8603a', 1); g.strokeStyle = '#8a1a2b'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 69.5); g.lineTo(34, 69.5); g.stroke();
    rr(g, 21, 80, 16, 8, 3); fs(g, '#4a2a3a', '#2b1a2e', 1);
  } else {            // the hanging lollipop: a round glossy swirl on a white stick, with a bow
    var SWT = tex3('swirl');
    yield* toy3(g, OW, 84, function (R, s) {
      meshDraw(R, rodFn(29, 0, 0, 29, 36, 0, 3.3, 3.3), 2, 10, s, 0, 0, matFor('#fff4ec'), null, 0);
      meshDraw(R, domeFn(29, 57, 27, 14), 16, 28, s, 0, 0, matFor('#fff1f6'), SWT, 0);
    });
    g.beginPath(); g.moveTo(29, 29); g.quadraticCurveTo(14, 22, 16, 34); g.quadraticCurveTo(24, 36, 29, 31); g.quadraticCurveTo(34, 36, 42, 34); g.quadraticCurveTo(44, 22, 29, 29); fs(g, '#7ad8ff', '#2b6fa8', 1.2);
  }
}
function* tileA(g) {   // a glossy candy-cane pillar: a lit pink and white tube, stripes that line up from one tile to the next
  var PILT = tex3('pillar');
  yield* toy3(g, OW, TH, function (R, s) { meshDraw(R, rodFn(29, 0, 0, 29, TH, 0, 20, 20), 6, 40, s, 0, 0, matFor('#fff1f6'), PILT, 0); });
}
var CAN = ['#ff5c8a', '#ffd23f', '#41c9a2', '#8b6cff', '#ff9a3c', '#4fb8ff'];
function candyJar(g, x, y, w, h, seed) {
  var r = rnd(seed), i, j;
  g.save(); rr(g, x, y + h * .2, w, h * .8, w * .3); g.clip(); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x, y, w, h);
  for (j = 0; j < 7; j++) for (i = 0; i < Math.floor(w / 7.5); i++) { var cx = x + 5 + i * 7.5 + (j % 2) * 3.5, cy = y + h - 4.5 - j * 6.6; if (cy > y + h * .26) candy(g, cx, cy, 3.6, CAN[Math.floor(r() * 6)]); }
  g.restore(); rr(g, x, y + h * .2, w, h * .8, w * .3); g.strokeStyle = '#b98aa3'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.6)'; rr(g, x + w * .14, y + h * .34, w * .13, h * .4, w * .07); g.fill();
  rr(g, x + w * .12, y, w * .76, h * .24, 2.5); fs(g, gold(g, y, y + h * .24), '#9a6b17', 1);
}
DEF[0] = {
  ts: [{ pitch: 70, h: 70, nv: 4 }, { pitch: 70, h: 70, nv: 4 }], kinds: 1, capH: [[84], [96]],
  sky: function (g) {
    g.fillStyle = lg(g, 0, 0, 0, GY, [[0, '#ffe9f1'], [1, '#ffcfe0']]); g.fillRect(0, 0, W, GY);
    g.fillStyle = 'rgba(255,255,255,.45)'; for (var x = 0; x < W; x += 40) g.fillRect(x, 0, 20, 440);
    g.fillStyle = 'rgba(255,120,166,.2)'; for (var y = 22, k = 0; y < 430; y += 40, k++) for (x = (k % 2) * 20 + 10; x < W; x += 40) { circ(g, x, y, 2.2); g.fill(); }
    g.fillStyle = lg(g, 0, 440, 0, GY, [[0, '#c9f3e2'], [1, '#98e0c4']]); g.fillRect(0, 440, W, GY - 440);
    g.fillStyle = 'rgba(255,255,255,.6)'; for (x = 0; x < W; x += 48) g.fillRect(x + 22, 456, 3, GY - 456);
    g.fillStyle = lg(g, 0, 430, 0, 442, [[0, '#ffffff'], [1, '#f0d6c0']]); g.fillRect(0, 430, W, 12); g.fillStyle = 'rgba(90,50,40,.18)'; g.fillRect(0, 442, W, 3);
  },
  farP: 420, farY: 90, farH: 350,
  far: function (g, P) {
    var r = rnd(7); [[188, '#fff3e6'], [318, '#fff3e6']].forEach(function (s, row) {
      var y = s[0];
      for (var x = 6, n = 0; x < P - 20; x += 24 + r() * 22, n++) { (function (x, n) { var w = 22 + r() * 10, h = 30 + r() * 10; rep(P, x, w, function (xx) { candyJar(g, xx, y - h, w, h, row * 40 + n); }); })(x, n); }
      g.fillStyle = lg(g, 0, y, 0, y + 10, [[0, '#ffe3c8'], [1, '#d9a47c']]); g.fillRect(0, y, P, 10); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, y, P, 1.5);
      g.fillStyle = 'rgba(70,35,30,.3)'; g.fillRect(0, y + 10, P, 1.5);
      for (x = 30; x < P; x += 84) { g.beginPath(); g.moveTo(x, y + 11); g.lineTo(x + 14, y + 11); g.lineTo(x + 14, y + 26); g.quadraticCurveTo(x + 12, y + 14, x, y + 11); fs(g, '#e9b890', '#b98563', 1); }
    });
    rep(P, 150, 110, function (x) { rr(g, x, 98, 110, 44, 14); fs(g, lg(g, 0, 98, 0, 142, [[0, '#ff7fa9'], [1, '#e84f82']]), '#a8325c', 2); g.fillStyle = 'rgba(255,255,255,.35)'; rr(g, x + 6, 102, 98, 10, 5); g.fill();
      g.font = '800 26px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = '#a8325c'; g.lineWidth = 4; g.strokeText('SWEETS', x + 55, 123); g.fillStyle = '#fff6ea'; g.fillText('SWEETS', x + 55, 123); });
  },
  midP: 360, midY: 430, midH: 140,
  mid: function (g, P) {
    for (var x = 0; x < P; x += 18) { g.fillStyle = (x / 18) % 2 ? '#ffffff' : '#ff9fbd'; g.fillRect(x, 494, 18, GY - 494); }
    g.fillStyle = lg(g, 0, 494, 0, GY, [[0, 'rgba(255,255,255,.35)'], [.4, 'rgba(255,255,255,0)'], [1, 'rgba(120,40,70,.28)']]); g.fillRect(0, 494, P, GY - 494);
    g.fillStyle = lg(g, 0, 478, 0, 494, [[0, '#fffaf0'], [1, '#e8c79c']]); g.fillRect(0, 478, P, 16); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(0, 478, P, 1.6); g.fillStyle = 'rgba(80,40,30,.3)'; g.fillRect(0, 493, P, 1.5);
    [[24, 5], [136, 9], [262, 13]].forEach(function (s) { rep(P, s[0], 40, function (x) { candyJar(g, x, 428, 38, 50, s[1]); }); });
    rep(P, 82, 44, function (x) {
      rr(g, x, 462, 40, 16, 3); fs(g, lg(g, 0, 462, 0, 478, [[0, '#f3d3a4'], [1, '#c9955a']]), '#8a5a2e', 1);
      [[8, '#ff5c8a', '#fff'], [20, '#41c9a2', '#fff'], [32, '#ffd23f', '#ff9a3c']].forEach(function (p, i) { g.strokeStyle = '#fff'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + p[0], 466); g.lineTo(x + p[0], 440 + (i % 2) * 6); g.stroke(); swirlPop(g, x + p[0], 432 + (i % 2) * 6, 8.5, p[1], p[2]); });
    });
    rep(P, 200, 50, function (x) { rr(g, x, 458, 44, 20, 6); fs(g, '#e8455a', '#9a2b3b', 1.3); g.fillStyle = 'rgba(255,255,255,.4)'; rr(g, x + 4, 461, 36, 5, 2.5); g.fill(); rr(g, x + 12, 448, 20, 12, 3); fs(g, '#fff3e0', '#c9a46a', 1); });
  },
  topP: 360, topY: 0, topH: 90,
  top: function (g, P) {
    var cols = ['#ff7fa9', '#ffd23f', '#41c9a2', '#8b6cff', '#4fb8ff'];
    for (var seg = 0; seg < 2; seg++) {
      var x0 = seg * 180, sag = 22; g.strokeStyle = '#a8325c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, 6); g.quadraticCurveTo(x0 + 90, 6 + sag * 2, x0 + 180, 6); g.stroke();
      for (var i = 0; i < 7; i++) {
        var t = (i + .5) / 7, x = x0 + t * 180, y = 6 + 2 * sag * t * (1 - t) * 2 - 0; y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * (6 + sag * 2) + t * t * 6;
        g.beginPath(); g.moveTo(x - 11, y); g.lineTo(x + 11, y); g.lineTo(x, y + 26); g.closePath(); fs(g, lg(g, x - 11, y, x + 11, y + 26, [[0, lit(cols[i % 5], .35)], [1, cols[i % 5]]]), drk(cols[i % 5], .4), 1.1);
      }
    }
    [90, 270].forEach(function (x) { g.strokeStyle = '#a8325c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 44); g.stroke();
      g.fillStyle = rg(g, x, 62, 4, x, 62, 44, [[0, 'rgba(255,240,170,.55)'], [1, 'rgba(255,240,170,0)']]); g.fillRect(x - 44, 20, 88, 84);
      g.beginPath(); g.moveTo(x - 18, 62); g.quadraticCurveTo(x - 18, 40, x, 40); g.quadraticCurveTo(x + 18, 40, x + 18, 62); g.closePath(); fs(g, lg(g, x - 18, 0, x + 18, 0, [[0, '#8fe6d0'], [.4, '#d8fff4'], [1, '#5cc9ac']]), '#2f8a72', 1.5);
      ell(g, x, 62, 18, 4); fs(g, '#fff6c8', '#c9a84a', 1); });
  },
  ground: function (g) {
    g.fillStyle = '#ffe2ec'; g.fillRect(0, 0, 48, 6); g.fillStyle = '#d97a9a'; g.fillRect(0, 0, 48, 2);
    for (var r = 0; r < 3; r++) for (var i = 0; i < 2; i++) { g.fillStyle = (r + i) % 2 ? '#fff4e6' : '#ff9ab8'; g.fillRect(i * 24, 6 + r * 22, 24, 22); }
    g.fillStyle = lg(g, 0, 6, 0, 72, [[0, 'rgba(255,255,255,.28)'], [1, 'rgba(120,30,60,.22)']]); g.fillRect(0, 6, 48, 66); g.fillStyle = 'rgba(160,60,100,.25)'; g.fillRect(0, 6, 48, 1.5);
  },
  tile: function (g) { return tileA(g); },
  cap: function (g, side) { return capA(g, side); },
  hit: function (side) {
    return side ? [[14, 6, 30, 20], [4, 20, 50, 64], [3, 78, 52, Infinity]] : [[12, 6, 34, 20], [3, 20, 52, 40], [25, 58, 8, 80], [3, 76, 52, Infinity]];
  }
};
/* hit lists are [x, distanceFromNearEdgeStart, width, distanceEnd] and are read by ART.rects */

/* ---------- 1: JAM JAR PANTRY ---------- */
var JAMC = ['#e0457b', '#8b3fb8', '#e8832a', '#3b5fc4'];
function jamJar(g, x, y, w, h, c) {
  rr(g, x, y + h * .18, w, h * .82, w * .3); fs(g, lg(g, x, 0, x + w, 0, [[0, lit(c, .45)], [.4, c], [1, drk(c, .35)]]), drk(c, .5), 1.4);
  g.save(); rr(g, x, y + h * .18, w, h * .82, w * .3); g.clip(); g.fillStyle = drk(c, .3); [[.3, .55], [.6, .75], [.45, .9]].forEach(function (p) { ell(g, x + w * p[0], y + h * p[1], 2.4, 1.6, .4); g.fill(); }); g.restore();
  g.fillStyle = 'rgba(255,255,255,.55)'; rr(g, x + w * .12, y + h * .3, w * .1, h * .46, w * .05); g.fill();
  rr(g, x + w * .2, y + h * .4, w * .6, h * .34, 5); fs(g, '#fff3d6', '#c9a46a', 1); circ(g, x + w * .5, y + h * .57, 4.2); fs(g, drk(c, .05), drk(c, .5), .8); g.beginPath(); g.moveTo(x + w * .5, y + h * .57 - 4); g.quadraticCurveTo(x + w * .5 + 4, y + h * .57 - 8, x + w * .5 + 6, y + h * .57 - 4); g.strokeStyle = '#3f8a3f'; g.lineWidth = 1.4; g.stroke();
  rr(g, x + w * .1, y, w * .8, h * .22, 3); fs(g, lg(g, 0, y, 0, y + h * .22, [[0, '#f9e6a0'], [1, '#b98a2f']]), '#7a5a17', 1.2);
  g.strokeStyle = 'rgba(100,70,20,.45)'; g.lineWidth = .9; for (var i = x + w * .18; i < x + w * .84; i += 4) { g.beginPath(); g.moveTo(i, y + 1.5); g.lineTo(i, y + h * .22 - 1.5); g.stroke(); }
}
DEF[1] = {
  ts: [{ pitch: 70, h: 70, nv: 4 }, { pitch: 70, h: 70, nv: 4 }], kinds: 1, capH: [[84], [82]],
  sky: function (g) {
    g.fillStyle = lg(g, 0, 0, 0, GY, [[0, '#fbe6bf'], [1, '#efc283']]); g.fillRect(0, 0, W, GY);
    for (var x = 0; x < W; x += 22) { g.fillStyle = 'rgba(120,70,20,.07)'; g.fillRect(x, 0, 2, 440); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 2, 0, 1.5, 440); }
    g.fillStyle = lg(g, 0, 440, 0, GY, [[0, '#c98f55'], [1, '#a46a35']]); g.fillRect(0, 440, W, GY - 440);
    for (x = 0; x < W; x += 30) { g.fillStyle = 'rgba(60,30,10,.22)'; g.fillRect(x, 450, 2, GY - 450); g.fillStyle = 'rgba(255,220,160,.2)'; g.fillRect(x + 2, 450, 1.5, GY - 450); }
    g.fillStyle = lg(g, 0, 430, 0, 450, [[0, '#e6b97a'], [1, '#b87d44']]); g.fillRect(0, 430, W, 20); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 430, W, 1.6); g.fillStyle = 'rgba(60,30,10,.3)'; g.fillRect(0, 450, W, 3);
  },
  farP: 420, farY: 90, farH: 350,
  far: function (g, P) {
    var r = rnd(33);
    rep(P, 40, 86, function (x) {
      g.fillStyle = 'rgba(255,230,160,.5)'; ell(g, x + 43, 150, 70, 80); g.fill();
      rr(g, x, 102, 86, 108, 6); fs(g, lg(g, 0, 102, 0, 210, [[0, '#a8dcff'], [1, '#e8f7ff']]), '#6e4a28', 5); g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, x + 60, 140, 12, 7); g.fill(); ell(g, x + 28, 170, 16, 8); g.fill();
      g.strokeStyle = '#fff7e6'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 43, 102); g.lineTo(x + 43, 210); g.moveTo(x, 156); g.lineTo(x + 86, 156); g.stroke();
      gingham(g, x - 4, 100, 22, 50, '#d9453b'); gingham(g, x + 68, 100, 22, 50, '#d9453b'); rr(g, x - 6, 208, 98, 8, 3); fs(g, '#e8c28e', '#8a5a2e', 1.4);
    });
    [[270, '#b87d44'], [370, '#b87d44']].forEach(function (s, row) {
      var y = s[0];
      for (var x = 6, n = 0; x < P - 20; x += 26 + r() * 20, n++) {
        (function (x, n) {
          var kind = r(), w = 22 + r() * 10, h = 34 + r() * 8; rep(P, x, w, function (xx) {
            if (kind < .6) jamJar(g, xx, y - h, w, h, JAMC[(n + row) % 4]);
            else { rr(g, xx, y - h + 4, w, h - 4, 3); fs(g, metalH(g, xx, xx + w), '#4a5270', 1.1); g.fillStyle = JAMC[(n + 2) % 4]; g.fillRect(xx, y - h * .72, w, h * .3); }
          });
        })(x, n);
      }
      g.fillStyle = lg(g, 0, y, 0, y + 10, [[0, '#d9a066'], [1, '#8c5a2b']]); g.fillRect(0, y, P, 10); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0, y, P, 1.5); g.fillStyle = 'rgba(40,20,10,.35)'; g.fillRect(0, y + 10, P, 1.5);
    });
  },
  midP: 360, midY: 430, midH: 140,
  mid: function (g, P) {
    for (var x = 0; x < P; x += 120) { rr(g, x + 6, 498, 108, 66, 4); fs(g, lg(g, 0, 498, 0, 564, [[0, '#bd8449'], [1, '#9c6a38']]), '#6e4524', 1.6); rr(g, x + 14, 506, 92, 50, 3); g.strokeStyle = 'rgba(60,30,10,.4)'; g.lineWidth = 1.4; g.stroke(); circ(g, x + 96, 530, 3.4); fs(g, gold(g, 526, 534), '#7a5a17', 1); }
    g.fillStyle = lg(g, 0, 478, 0, 498, [[0, '#f0c98e'], [1, '#c98f4e']]); g.fillRect(0, 478, P, 20); g.strokeStyle = 'rgba(120,70,30,.3)'; g.lineWidth = 1; for (x = 0; x < P; x += 14) { g.beginPath(); g.moveTo(x, 479); g.lineTo(x + 6, 497); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(0, 478, P, 1.6); g.fillStyle = 'rgba(60,30,10,.35)'; g.fillRect(0, 497, P, 1.8);
    rep(P, 24, 56, function (x) { ell(g, x + 28, 470, 28, 12); fs(g, lg(g, 0, 458, 0, 482, [[0, '#e0a158'], [1, '#a8672a']]), '#6e4524', 1.4); g.strokeStyle = '#7a4a1e'; g.lineWidth = 1.5; [[12, 466], [26, 462], [40, 466]].forEach(function (s) { g.beginPath(); g.moveTo(x + s[0], s[1]); g.lineTo(x + s[0] + 6, s[1] + 8); g.stroke(); }); });
    rep(P, 150, 70, function (x) { g.beginPath(); g.moveTo(x, 462); g.quadraticCurveTo(x + 35, 492, x + 70, 462); g.closePath(); fs(g, lg(g, 0, 462, 0, 484, [[0, '#f1ebe0'], [1, '#c9c1b2']]), '#8a8270', 1.3);
      [[16, 452], [34, 448], [52, 452], [26, 440], [44, 440]].forEach(function (a, i) { circ(g, x + a[0], a[1] + 4, 9); fs(g, rg(g, x + a[0] - 3, a[1], 1, x + a[0], a[1] + 4, 10, [[0, '#ff8f8f'], [1, '#c92f3f']]), '#8a1a2b', 1.1); g.fillStyle = 'rgba(255,255,255,.7)'; circ(g, x + a[0] - 3, a[1] + 1, 1.8); g.fill(); }); });
    rep(P, 262, 60, function (x) { g.beginPath(); g.moveTo(x, 478); g.lineTo(x + 58, 478); g.lineTo(x + 58, 458); g.closePath(); fs(g, lg(g, x, 458, x + 58, 478, [[0, '#ffe08a'], [1, '#f0b63c']]), '#a8741b', 1.3); [[40, 470, 3], [48, 474, 2], [52, 466, 2.4]].forEach(function (h) { circ(g, x + h[0], h[1], h[2]); g.fillStyle = 'rgba(160,100,20,.55)'; g.fill(); }); });
  },
  topP: 360, topY: 0, topH: 110,
  top: function (g, P) {
    g.fillStyle = lg(g, 0, 4, 0, 14, [[0, '#6a6f80'], [1, '#34384a']]); g.fillRect(0, 6, P, 8); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 6, P, 1.5);
    rep(P, 40, 60, function (x) { g.strokeStyle = '#3a3a48'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 28, 14); g.lineTo(x + 28, 40); g.stroke(); ell(g, x + 28, 62, 24, 22); fs(g, metalCopper(g, x + 4, x + 52), '#6a2f14', 1.6); ell(g, x + 28, 44, 20, 5); fs(g, '#5a2a14', '#6a2f14', 1); g.beginPath(); g.moveTo(x + 50, 56); g.lineTo(x + 76, 52); g.strokeStyle = '#6a2f14'; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#d98a52'; g.lineWidth = 2.6; g.stroke(); });
    rep(P, 160, 40, function (x) { g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x + 14, 14); g.lineTo(x + 14, 30); g.stroke(); for (var i = 0; i < 7; i++) { g.beginPath(); g.moveTo(x + 14, 30); g.quadraticCurveTo(x + 14 + (i - 3) * 6, 42, x + 14 + (i - 3) * 8, 62 + (i % 2) * 6); g.strokeStyle = '#4f9a4f'; g.lineWidth = 3; g.stroke(); } });
    rep(P, 270, 40, function (x) { g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x + 16, 14); g.lineTo(x + 16, 30); g.stroke(); for (var i = 0; i < 4; i++) { ell(g, x + 16 + (i % 2 ? 5 : -5), 38 + i * 15, 10, 9); fs(g, rg(g, x + 13, 34 + i * 15, 1, x + 16, 38 + i * 15, 11, [[0, '#fffdf3'], [1, '#d9c9d9']]), '#9a8a9a', 1.1); } });
  },
  ground: function (g) {
    g.fillStyle = '#7a4a22'; g.fillRect(0, 0, 80, 5);
    for (var r = 0; r < 3; r++) { var y = 5 + r * 22; g.fillStyle = r % 2 ? '#c88a4e' : '#b97a40'; g.fillRect(0, y, 80, 22); g.fillStyle = 'rgba(60,30,10,.4)'; g.fillRect(0, y, 80, 1.4); var jx = (r * 27) % 80; g.fillRect(jx, y, 1.6, 22);
      g.strokeStyle = 'rgba(70,35,10,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(5, y + 8); g.quadraticCurveTo(30, y + 5, 55, y + 9); g.moveTo(15, y + 15); g.quadraticCurveTo(45, y + 13, 75, y + 16); g.stroke(); }
    g.fillStyle = lg(g, 0, 5, 0, 72, [[0, 'rgba(255,230,180,.25)'], [1, 'rgba(60,20,0,.25)']]); g.fillRect(0, 5, 80, 67);
  },
  tile: function (g, side, v) { return tile1(g, side, v); },
  cap: function (g, side) { return cap1(g, side); },
  hit: function (side) {
    return side ? [[12, 4, 34, 14], [7, 18, 44, 56], [3, 74, 52, Infinity]] : [[14, 2, 30, 10], [5, 10, 48, 54], [3, 72, 52, Infinity]];
  }
};
function metalCopper(g, x0, x1) { return lg(g, x0, 0, x1, 0, [[0, '#6f3418'], [.16, '#c2703a'], [.34, '#ffd2a0'], [.5, '#d4824a'], [.72, '#f0a870'], [.9, '#9a5028'], [1, '#6a2f14']]); }

/* ---------- 2: ICE CREAM PARLOR ---------- */
var FLAV = ['#ff8fb8', '#8fe6d0', '#fff0b8', '#b07a58'];
function scoop(g, cx, cy, r, c, seed) {
  var rn = rnd(seed);
  circ(g, cx, cy, r); fs(g, rg(g, cx - r * .35, cy - r * .4, 2, cx, cy, r * 1.05, [[0, lit(c, .55)], [.55, c], [1, drk(c, .28)]]), drk(c, .5), 1.7);
  var sc = ['#ff4a6a', '#4fb8ff', '#ffd23f', '#41c9a2', '#ffffff'];
  for (var i = 0; i < 11; i++) { var a = rn() * PI2, d = Math.sqrt(rn()) * r * .72, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * .9 - 3, q = rn() * PI2; g.strokeStyle = sc[i % 5]; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(q) * 3.6, y + Math.sin(q) * 3.6); g.stroke(); }
  g.save(); g.globalAlpha = .55; g.fillStyle = '#fff'; ell(g, cx - r * .42, cy - r * .5, r * .3, r * .15, -.7); g.fill(); g.restore();
}
function ruffle(g, cx, y, w, c) { var n = 5, i; g.beginPath(); g.moveTo(cx - w / 2, y); for (i = 0; i < n; i++) g.arc(cx - w / 2 + (i + .5) * w / n, y, w / n / 2, Math.PI, 0, true); g.lineTo(cx + w / 2, y + 7); g.lineTo(cx - w / 2, y + 7); g.closePath(); }
DEF[2] = {
  ts: [{ pitch: 70, h: 70, nv: 1 }, { pitch: 48, h: 60, nv: 4 }], kinds: 1, capH: [[60], [74]],
  noCyl: 1,   // these are stacks of scoops and discs, not tubes: the sideways tube shading would stripe straight across their curves; each ball is lit by its own surface instead
  sky: function (g) {
    g.fillStyle = lg(g, 0, 0, 0, GY, [[0, '#d5f6ef'], [1, '#bde6f2']]); g.fillRect(0, 0, W, GY);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; for (var i = -440; i < W + 440; i += 36) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 440, 440); g.moveTo(i + 440, 0); g.lineTo(i, 440); g.stroke(); }
    g.fillStyle = 'rgba(255,127,169,.4)'; for (var y = 18; y < 440; y += 36) for (var x = (y / 36 % 2) * 18; x < W; x += 36) { circ(g, x, y, 2.2); g.fill(); }
    g.fillStyle = lg(g, 0, 440, 0, GY, [[0, '#ffc9dc'], [1, '#ff9fc0']]); g.fillRect(0, 440, W, GY - 440);
    for (x = 18; x < W; x += 36) { g.strokeStyle = 'rgba(160,50,90,.25)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 18, 450); g.lineTo(x - 18, GY); g.stroke(); circ(g, x, 500, 4); fs(g, lg(g, x, 496, x, 504, [[0, '#ffe3ee'], [1, '#d9648f']]), '#a8325c', 1); }
    g.fillStyle = lg(g, 0, 430, 0, 442, [[0, '#f6f8fc'], [.5, '#aab4c6'], [1, '#e8edf5']]); g.fillRect(0, 430, W, 12); g.fillStyle = 'rgba(40,50,70,.25)'; g.fillRect(0, 442, W, 3);
  },
  farP: 420, farY: 90, farH: 350,
  far: function (g, P) {
    rep(P, 24, 100, function (x) {
      rr(g, x, 118, 100, 86, 6); fs(g, '#e7c58a', '#8a5a2e', 2); rr(g, x + 6, 124, 88, 74, 3); fs(g, '#2f5f6a', '#1f3f48', 1.4);
      g.font = '800 14px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff6ea'; g.fillText('TODAY', x + 50, 138);
      [[22, '#ff8fb8'], [50, '#8fe6d0'], [78, '#fff0b8']].forEach(function (s, i) { circ(g, x + s[0], 166, 10); fs(g, s[1], drk(s[1], .4), 1); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x + s[0] - 8, 186); g.lineTo(x + s[0] + 8, 186); g.stroke(); });
    });
    rep(P, 168, 52, function (x) {
      circ(g, x + 26, 150, 27); fs(g, lg(g, x, 123, x, 177, [[0, '#ff9fc0'], [1, '#e8558a']]), '#a8325c', 2); circ(g, x + 26, 150, 21); fs(g, '#fffdf6', '#c9bfa8', 1.2);
      g.strokeStyle = '#6a5a4a'; g.lineWidth = 1.2; for (var i = 0; i < 12; i++) { var a = i * PI2 / 12; g.beginPath(); g.moveTo(x + 26 + Math.cos(a) * 17, 150 + Math.sin(a) * 17); g.lineTo(x + 26 + Math.cos(a) * 20, 150 + Math.sin(a) * 20); g.stroke(); }
      g.strokeStyle = '#3a2a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 26, 150); g.lineTo(x + 26, 137); g.moveTo(x + 26, 150); g.lineTo(x + 35, 154); g.stroke(); circ(g, x + 26, 150, 2); g.fillStyle = '#3a2a3a'; g.fill();
    });
    rep(P, 250, 60, function (x) {
      rr(g, x, 118, 56, 76, 5); fs(g, '#fff0d8', '#c9964f', 4); rr(g, x + 6, 124, 44, 64, 3); fs(g, '#d8f4ff', null);
      g.beginPath(); g.moveTo(x + 12, 140); g.lineTo(x + 44, 140); g.lineTo(x + 28, 168); g.closePath(); fs(g, 'rgba(255,255,255,.7)', '#7aa0c0', 1.3); circ(g, x + 20, 138, 6); fs(g, '#ff8fb8', '#b04870', 1); circ(g, x + 32, 137, 6); fs(g, '#fff0b8', '#b09a48', 1); circ(g, x + 26, 131, 5); fs(g, '#8fe6d0', '#3a9a80', 1); circ(g, x + 26, 124, 3); fs(g, '#e23a54', '#8a1a2b', .8);
      g.fillStyle = '#7aa0c0'; g.fillRect(x + 27, 168, 2, 12); g.fillRect(x + 20, 180, 16, 2);
    });
    rep(P, 330, 84, function (x) {
      rr(g, x, 118, 80, 50, 10); fs(g, '#2a3a4a', '#16202a', 2); g.save(); g.shadowColor = '#ff4fa0'; g.shadowBlur = 8; g.font = '800 17px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = '#ff7fb8'; g.lineWidth = 2.4; g.strokeText('ICE', x + 40, 134); g.strokeText('CREAM', x + 40, 153); g.restore();
      g.font = '800 17px ' + FONT; g.fillStyle = '#ffe3f0'; g.fillText('ICE', x + 40, 134); g.fillText('CREAM', x + 40, 153);
    });
  },
  midP: 360, midY: 430, midH: 140,
  mid: function (g, P) {
    g.fillStyle = lg(g, 0, 498, 0, GY, [[0, '#ff9fc0'], [1, '#f27ba3']]); g.fillRect(0, 498, P, GY - 498); g.fillStyle = 'rgba(255,255,255,.7)'; for (var x = 0; x < P; x += 30) g.fillRect(x + 12, 498, 4, GY - 498);
    g.fillStyle = lg(g, 0, 498, 0, GY, [[0, 'rgba(255,255,255,.3)'], [1, 'rgba(120,20,60,.3)']]); g.fillRect(0, 498, P, GY - 498);
    g.fillStyle = lg(g, 0, 492, 0, 500, [[0, '#f6f8fc'], [.5, '#a6b0c4'], [1, '#e8edf5']]); g.fillRect(0, 492, P, 8);
    g.fillStyle = lg(g, 0, 476, 0, 492, [[0, '#ffffff'], [1, '#d8e2ea']]); g.fillRect(0, 476, P, 16); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(0, 476, P, 1.6);
    rep(P, 80, 40, function (x) { g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(x + 6, 476); g.lineTo(x + 34, 476); g.lineTo(x + 26, 440); g.lineTo(x + 14, 440); g.closePath(); fs(g, 'rgba(220,240,255,.55)', '#7aa0c0', 1.3); circ(g, x + 14, 448, 7); fs(g, '#ff8fb8', '#b04870', 1); circ(g, x + 26, 447, 7); fs(g, '#8fe6d0', '#3a9a80', 1); circ(g, x + 20, 441, 6); fs(g, '#fff0b8', '#b09a48', 1); circ(g, x + 20, 434, 3.4); fs(g, '#e23a54', '#8a1a2b', .8); rr(g, x + 17, 476, 6, 6, 1); });
    rep(P, 230, 40, function (x) { rr(g, x, 440, 14, 38, 5); fs(g, metalH(g, x, x + 14), '#4a5270', 1.2); g.strokeStyle = '#4a5270'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 14, 450); g.lineTo(x + 28, 454); g.stroke(); g.strokeStyle = '#d8def0'; g.lineWidth = 1.2; g.stroke(); circ(g, x + 7, 440, 7); fs(g, '#ff7fa9', '#a8325c', 1.2); });
    rep(P, 300, 50, function (x) { g.beginPath(); g.moveTo(x, 476); g.quadraticCurveTo(x + 24, 430, x + 48, 476); g.closePath(); fs(g, 'rgba(220,240,255,.5)', '#7aa0c0', 1.3); rr(g, x + 6, 462, 36, 14, 3); fs(g, '#e8b890', '#9a6a40', 1); });
    [60, 190, 310].forEach(function (cx) { rep(P, cx - 20, 40, function (x) { g.fillStyle = metalH(g, x + 17, x + 23); g.fillRect(x + 17, 540, 6, 22); g.strokeStyle = '#4a5270'; g.lineWidth = 1; g.strokeRect(x + 17, 540, 6, 22); ell(g, x + 20, 564, 15, 4); fs(g, metalH(g, x + 5, x + 35), '#4a5270', 1.1); ell(g, x + 20, 536, 20, 8); fs(g, lg(g, 0, 528, 0, 544, [[0, '#ff6b81'], [1, '#c8283f']]), '#8a1a2b', 1.4); g.fillStyle = 'rgba(255,255,255,.5)'; ell(g, x + 12, 533, 8, 2.6); g.fill(); }); });
  },
  topP: 360, topY: 0, topH: 110,
  top: function (g, P) {
    for (var x = 0; x < P; x += 30) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, 0); g.lineTo(x + 30, 26); g.arc(x + 15, 26, 15, 0, Math.PI); g.lineTo(x, 26); g.closePath(); var c = (x / 30) % 2 ? '#ffffff' : '#ff7fa9'; fs(g, lg(g, 0, 0, 0, 40, [[0, lit(c, .15)], [1, drk(c, .12)]]), 'rgba(160,50,90,.5)', 1.2);
    }
    g.fillStyle = lg(g, 0, 40, 0, 60, [[0, 'rgba(60,30,60,.25)'], [1, 'rgba(60,30,60,0)']]); g.fillRect(0, 41, P, 20);
    [100, 280].forEach(function (cx) { g.strokeStyle = '#7a8498'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, 36); g.lineTo(cx, 62); g.stroke();
      g.fillStyle = rg(g, cx, 82, 4, cx, 82, 46, [[0, 'rgba(255,230,240,.6)'], [1, 'rgba(255,230,240,0)']]); g.fillRect(cx - 46, 36, 92, 92);
      circ(g, cx, 82, 17); fs(g, rg(g, cx - 5, 76, 2, cx, 82, 18, [[0, '#ffe3ee'], [1, '#ff7fa9']]), '#a8325c', 1.5); rr(g, cx - 7, 60, 14, 8, 2); fs(g, metalH(g, cx - 7, cx + 7), '#4a5270', 1.1); });
  },
  ground: function (g) {
    g.fillStyle = lg(g, 0, 0, 0, 6, [[0, '#f6f8fc'], [1, '#aab4c6']]); g.fillRect(0, 0, 48, 6);
    for (var r = 0; r < 3; r++) for (var i = 0; i < 2; i++) { g.fillStyle = (r + i) % 2 ? '#f4f6f9' : '#2f3a4a'; g.fillRect(i * 24, 6 + r * 22, 24, 22); }
    g.fillStyle = lg(g, 0, 6, 0, 72, [[0, 'rgba(255,255,255,.3)'], [1, 'rgba(10,20,40,.3)']]); g.fillRect(0, 6, 48, 66); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(4, 10); g.lineTo(14, 10); g.lineTo(8, 24); g.lineTo(0, 24); g.closePath(); g.fill();
  },
  tile: function (g, side, v) { return tile2(g, side, v); },
  cap: function (g, side) { return cap2(g, side); },
  hit: function (side) {
    return side ? [[18, 2, 22, 30], [6, 24, 46, 42], [4, 62, 50, Infinity]] : [[12, 2, 34, 12], [4, 10, 50, Infinity]];
  }
};

/* ---------- 3: SILVERWARE DRAWER ---------- */
function forkPath(g, w) {
  g.beginPath(); g.moveTo(18, 84); g.lineTo(18, 70); g.quadraticCurveTo(6, 62, 2, 50); g.lineTo(2, 12); g.quadraticCurveTo(2, 2, 8, 2); g.quadraticCurveTo(12, 2, 12, 8); g.lineTo(12, 36);
  g.lineTo(17, 36); g.lineTo(17, 8); g.quadraticCurveTo(17, 2, 22, 2); g.quadraticCurveTo(27, 2, 27, 8); g.lineTo(27, 36); g.lineTo(31, 36); g.lineTo(31, 8); g.quadraticCurveTo(31, 2, 36, 2); g.quadraticCurveTo(41, 2, 41, 8); g.lineTo(41, 36); g.lineTo(46, 36);
  g.lineTo(46, 8); g.quadraticCurveTo(46, 2, 50, 2); g.quadraticCurveTo(56, 2, 56, 12); g.lineTo(56, 50); g.quadraticCurveTo(52, 62, 40, 70); g.lineTo(40, 84); g.closePath();
}
DEF[3] = {
  ts: [{ pitch: 70, h: 70, nv: 1 }, { pitch: 70, h: 70, nv: 1 }], kinds: 2, capH: [[86, 80], [86, 80]],
  sky: function (g) {
    g.fillStyle = lg(g, 0, 0, 0, GY, [[0, '#3b4a72'], [1, '#222b46']]); g.fillRect(0, 0, W, GY);
    var r = rnd(9); for (var i = 0; i < 700; i++) { g.fillStyle = r() < .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,20,.1)'; g.fillRect(r() * W, r() * GY, 1.4, 1.4); }
    g.fillStyle = rg(g, 180, 230, 20, 180, 230, 300, [[0, 'rgba(170,200,255,.28)'], [1, 'rgba(170,200,255,0)']]); g.fillRect(0, 0, W, GY);
    g.fillStyle = rg(g, 180, 300, 200, 180, 300, 420, [[0, 'rgba(0,0,10,0)'], [1, 'rgba(0,0,10,.5)']]); g.fillRect(0, 0, W, GY);
  },
  farP: 420, farY: 40, farH: 480,
  far: function (g, P) {
    [[100, 7], [310, 14]].forEach(function (s) { rep(P, s[0] - 40, 90, function (x) { g.save(); g.globalAlpha = .3; g.strokeStyle = '#a8b8e0'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 20, 140); g.lineTo(x + 60, 380); g.stroke(); circ(g, x + 20, 126, 20); fs(g, '#8da0cc', '#a8b8e0', 2); g.restore(); }); });
    rep(P, 210, 60, function (x) { g.save(); g.globalAlpha = .28; g.strokeStyle = '#a8b8e0'; g.lineWidth = 2; for (var i = 0; i < 6; i++) { ell(g, x + 30, 150, 8 + i * 3, 30, 0); g.stroke(); } g.beginPath(); g.moveTo(x + 30, 180); g.lineTo(x + 30, 330); g.lineWidth = 6; g.stroke(); g.restore(); });
    [[40], [250]].forEach(function (s) {
      rep(P, s[0], 36, function (x) {
        g.fillStyle = lg(g, x, 0, x + 18, 0, [[0, '#7a4a22'], [.35, '#d9a066'], [.7, '#b87d44'], [1, '#6e4524']]); g.fillRect(x, 60, 18, 480); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, 60, 18, 3);
        g.fillStyle = lg(g, x + 18, 0, x + 44, 0, [[0, 'rgba(0,0,15,.45)'], [1, 'rgba(0,0,15,0)']]); g.fillRect(x + 18, 63, 26, 480);
      });
    });
  },
  midP: 360, midY: 430, midH: 140,
  mid: function (g, P) {
    rep(P, 40, 70, function (x) { g.save(); g.strokeStyle = metalH(g, x, x + 60); g.lineWidth = 2.4; for (var i = 0; i < 5; i++) { ell(g, x + 30, 506, 7 + i * 4, 44, (i - 2) * .16); g.stroke(); } g.lineWidth = 7; g.beginPath(); g.moveTo(x + 30, 550); g.lineTo(x + 30, 570); g.stroke(); g.restore(); });
    rep(P, 140, 80, function (x) { g.beginPath(); g.moveTo(x + 4, 566); g.lineTo(x + 56, 480); g.lineWidth = 7; g.strokeStyle = '#4a5270'; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#c3cbe0'; g.stroke(); circ(g, x + 60, 470, 17); fs(g, lg(g, x + 44, 455, x + 76, 485, [[0, '#ffffff'], [.5, '#b0b9d0'], [1, '#6a7290']]), '#4a5270', 1.8); circ(g, x + 60, 470, 11); fs(g, lg(g, x + 50, 460, x + 70, 480, [[0, '#7a84a0'], [1, '#dfe5f2']]), null); });
    rep(P, 260, 60, function (x) { rr(g, x + 14, 466, 28, 46, 8); fs(g, metalH(g, x + 14, x + 42), '#4a5270', 1.6); g.fillStyle = '#2b3350'; for (var i = 0; i < 3; i++) { rr(g, x + 21, 474 + i * 12, 14, 6, 3); g.fill(); } g.beginPath(); g.moveTo(x + 28, 512); g.lineTo(x + 28, 568); g.lineWidth = 8; g.strokeStyle = '#4a5270'; g.stroke(); g.lineWidth = 5; g.strokeStyle = '#c3cbe0'; g.stroke(); });
  },
  topP: 360, topY: 0, topH: 70,
  top: function (g, P) {
    g.fillStyle = lg(g, 0, 0, 0, 24, [[0, '#c78a52'], [.5, '#a46a35'], [1, '#6e4524']]); g.fillRect(0, 0, P, 24); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0, 22, P, 1.6);
    g.strokeStyle = 'rgba(60,30,10,.25)'; g.lineWidth = 1; for (var i = 0; i < 14; i++) { g.beginPath(); g.moveTo(i * 28, 4 + (i % 3) * 5); g.quadraticCurveTo(i * 28 + 14, 8 + (i % 4) * 3, i * 28 + 28, 6); g.stroke(); }
    g.fillStyle = lg(g, 0, 24, 0, 66, [[0, 'rgba(0,0,15,.55)'], [1, 'rgba(0,0,15,0)']]); g.fillRect(0, 24, P, 42);
  },
  ground: function (g) {
    g.fillStyle = '#8a5a2e'; g.fillRect(0, 0, 80, 5);
    for (var r = 0; r < 3; r++) { var y = 5 + r * 22; g.fillStyle = lg(g, 0, y, 0, y + 22, [[0, r % 2 ? '#ecc08a' : '#e2b479'], [1, r % 2 ? '#d19a62' : '#c99560']]); g.fillRect(0, y, 80, 22); g.fillStyle = 'rgba(80,40,10,.4)'; g.fillRect(0, y, 80, 1.4); g.fillRect((r * 33) % 80, y, 1.6, 22);
      g.strokeStyle = 'rgba(110,60,20,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(4, y + 7); g.quadraticCurveTo(28, y + 4, 54, y + 8); g.moveTo(12, y + 15); g.quadraticCurveTo(44, y + 12, 76, y + 15); g.stroke(); }
    g.fillStyle = lg(g, 0, 5, 0, 72, [[0, 'rgba(255,240,200,.25)'], [1, 'rgba(60,20,0,.25)']]); g.fillRect(0, 5, 80, 67);
  },
  tile: function (g) {                                                          // handle: bright brushed steel
    g.fillStyle = metalH(g, 18, 40); g.fillRect(18, 0, 22, TH);
    g.strokeStyle = '#4a5270'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(18, 0); g.lineTo(18, TH); g.moveTo(40, 0); g.lineTo(40, TH); g.stroke();
    g.strokeStyle = 'rgba(80,90,130,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(29, 0); g.lineTo(29, TH); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(23, 0, 2.4, TH); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(34, 0, 1.6, TH);
    g.fillStyle = lg(g, 0, 0, 0, TH, [[0, 'rgba(255,255,255,0)'], [.5, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(18, 0, 22, TH);
  },
  cap: function (g, side, kind) {
    var h = kind ? 80 : 86;
    (side ? function (f) { f(); } : function (f) { flipY(g, h, f); })(function () {
      if (!kind) {                                                              // fork (tines point toward the gap)
        forkPath(g); fs(g, metalH(g, 2, 56), '#4a5270', 1.7);
        g.save(); forkPath(g); g.clip(); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(8, 2, 2.4, 62); g.fillRect(23, 2, 1.6, 34); g.fillRect(38, 2, 1.6, 34); g.fillStyle = 'rgba(40,50,90,.3)'; g.fillRect(12, 8, 3, 28); g.fillRect(27, 8, 3, 28); g.fillRect(41, 8, 3, 28);
        g.fillStyle = lg(g, 0, 36, 0, 66, [[0, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(2, 36, 54, 30); g.restore();
      } else {                                                                  // spoon bowl
        g.beginPath(); g.moveTo(18, 80); g.lineTo(18, 68); g.quadraticCurveTo(2, 58, 2, 34); g.quadraticCurveTo(2, 2, 29, 2); g.quadraticCurveTo(56, 2, 56, 34); g.quadraticCurveTo(56, 58, 40, 68); g.lineTo(40, 80); g.closePath(); fs(g, metalH(g, 2, 56), '#4a5270', 1.7);
        ell(g, 29, 34, 21, 28); fs(g, lg(g, 0, 8, 0, 62, [[0, '#7a84a0'], [.5, '#c3cbe0'], [1, '#f2f5fb']]), 'rgba(60,70,110,.55)', 1.4);
        g.save(); g.globalAlpha = .9; g.fillStyle = '#fff'; ell(g, 20, 20, 6, 11, .4); g.fill(); g.restore(); g.fillStyle = 'rgba(40,50,90,.28)'; ell(g, 38, 46, 9, 12, .2); g.fill();
      }
    });
  },
  hit: function (side, kind) {
    return kind ? [[16, 4, 26, 10], [6, 14, 46, 14], [3, 28, 52, 22], [8, 50, 42, 12], [17, 62, 24, 10], [18, 70, 22, Infinity]]
      : [[2, 2, 54, 52], [10, 52, 38, 66], [18, 66, 22, Infinity]];
  }
};



/* ---------- the other stages' obstacles in the same glossy 3D toy look ---------- */
var T3 = {};
var SPRK = ['#ff4a6a', '#4fb8ff', '#ffd23f', '#41c9a2', '#ffffff'];
var TEXF = {   // the paint textures for the 3D obstacles: each is made once (the first time, or early in its own small step)
  wood: function () { return stripeTex(function (x, y) { return thin(y * 7, .05) * .85; }, [110, 69, 36]); },
  gingham: function () { return stripeTex(function (x, y) { var a = Math.floor(x * 6) % 2, b = Math.floor(y * 12) % 2; return (a ^ b) ? .78 : .0; }, [217, 69, 59]); },
  sprk: function () { return dotTex(5, 90, SPRK, 9, 4.2); },
  chips: function () { return dotTex(8, 60, ['#2a140c'], 3, 4.5); },
  bark: function () { return stripeTex(function (x, y) { return Math.max(thin(x * 7 + .12 * Math.sin(y * 6.283), .05) * .75, thin(x * 3 + .5 + .15 * Math.sin(y * 6.283), .035) * .4); }, [70, 38, 14]); },   // bark grooves run along the trunk and wrap evenly top to bottom, so tiles join without a seam
  vine: function () { return stripeTex(function (x, y) { return Math.max(thin(y * 4 + x * 2, .09) * .8, thin(y * 4 + x * 2 + .5, .04) * .35); }, [18, 78, 30]); },   // a twisted rope pattern that wraps evenly
  swirl: function () { return stripeTex(function (x, y) { return stripe01(y * 6 + (1 - x) * 1.7); }); },
  pillar: function () { return stripeTex(function (x, y) { return stripe01(y * 4 + x * 1); }); }
};
function tex3(k) { return T3[k] || (T3[k] = TEXF[k]()); }
var TEXT = { 0: ['swirl', 'pillar'], 1: ['wood', 'gingham'], 2: ['sprk', 'chips'], 4: ['bark', 'vine'] };   // which paint textures each stage's obstacles use: built as small steps of that stage's own plan (so only the stages a player reaches pay for them), not all at page load
function* tile1(g, side, v) {   // Jam Jar Pantry: a wooden post with a jam-coloured band
  var T = tex3('wood');
  yield* toy3(g, OW, TH, function (R, s) { cyl3(R, s, 29, 0, 29, TH, 19, 19, matFor('#d9a066'), T); ball3(R, s, 29, 35, 0, 21.5, 8.5, 21.5, matFor(JAMC[v]), 8, 24); ball3(R, s, 29, 16, 0, 20.4, 2.4, 20.4, 5, 4, 24); ball3(R, s, 29, 54, 0, 20.4, 2.4, 20.4, 5, 4, 24); });
}
function* cap1(g, side) {
  if (side === 1) {   // a jar with a gingham cloth lid
    plank(g, 0, 72, OW, 10, '#cd925a', '#7a4a22');
    var CT = tex3('gingham');
    yield* toy3(g, OW, 84, function (R, s) {
      ball3(R, s, 29, 53, 0, 21.5, 21, 17, matFor('#e0457b'), 14, 22);
      ball3(R, s, 29, 22, 0, 20.5, 19, 15.5, matFor('#fff8ee'), 12, 22, CT);
      ball3(R, s, 29, 33, 0, 21, 3.4, 17, matFor('#a8793a'), 6, 22);
    });
    rr(g, 16, 46, 26, 18, 5); fs(g, '#fff3d6', '#c9a46a', 1); circ(g, 29, 55, 4.4); fs(g, '#e0457b', '#6a1a3a', .8);
    g.strokeStyle = '#a8793a'; g.lineWidth = 2; g.beginPath(); g.moveTo(29, 34); g.quadraticCurveTo(21, 41, 18, 47); g.moveTo(29, 34); g.quadraticCurveTo(37, 41, 40, 47); g.stroke();
  } else {            // a hanging copper pot
    g.strokeStyle = '#3a3a48'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(6, 30); g.lineTo(29, 3); g.lineTo(52, 30); g.stroke(); circ(g, 29, 3, 3); fs(g, '#b9c2dc', '#4a5270', 1.1);
    yield* toy3(g, OW, 84, function (R, s) {
      ball3(R, s, 29, 54, 0, 24, 26.5, 20, matFor('#e08a4c'), 14, 24);
      ball3(R, s, 29, 29, 0, 24.5, 4.8, 20, matFor('#6a2f14'), 8, 24);
      ball3(R, s, 6, 31, 0, 3, 3, 3, matFor('#f0c090'), 6, 8); ball3(R, s, 52, 31, 0, 3, 3, 3, matFor('#f0c090'), 6, 8);
    });
  }
}
function* tile2(g, side, v) {   // Ice Cream Parlor: a scoop of sprinkled ice cream, or a hanging stack of cookie and cream
  var c;
  if (side) {
    c = FLAV[v]; var ST = tex3('sprk');
    yield* toy3(g, OW, 60, function (R, s) { ball3(R, s, 29, 31, 0, 28, 28, 22, matFor(c), 14, 24, ST); ball3(R, s, 29, 50, 3, 26.5, 8.5, 21, matFor(lit(c, .35)), 8, 24); });
  } else {
    var CK = tex3('chips');
    yield* toy3(g, OW, TH, function (R, s) { [9, 44].forEach(function (y) { ball3(R, s, 29, y, 0, 25.5, 10.4, 15, matFor('#8a5a40'), 8, 24, CK); }); [26.5, 61.5].forEach(function (y) { ball3(R, s, 29, y, 0, 24.5, 10.4, 14, matFor('#fff4de'), 8, 24); }); });
  }
}
function* cap2(g, side) {
  if (side === 1) {   // a cherry on whipped cream on a scoop
    yield* toy3(g, OW, 74, function (R, s) {
      ball3(R, s, 29, 52, 0, 22, 22, 17, matFor(FLAV[0]), 12, 22, tex3('sprk'));
      ball3(R, s, 29, 50, 0, 24, 10, 17, matFor('#fffafc'), 10, 22); ball3(R, s, 29, 36, 0, 18, 9, 14, matFor('#fffafc'), 10, 22); ball3(R, s, 29, 24, 0, 12, 8, 10, matFor('#fffafc'), 10, 22); ball3(R, s, 29, 16, 0, 6, 8, 6, matFor('#fffafc'), 8, 16);
      ball3(R, s, 30, 11, 5, 8.6, 8.6, 8.6, matFor('#e23a54'), 12, 18);
    });
    g.strokeStyle = '#3a6a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(31, 3.5); g.quadraticCurveTo(36, -2, 41, -1); g.stroke();
  } else {            // a sandwich with a bite out of it
    yield* toy3(g, OW, 60, function (R, s) {
      ball3(R, s, 29, 12, 0, 25.5, 12.6, 15, matFor('#fff4de'), 10, 24);
      ball3(R, s, 29, 41, 0, 25.5, 19.5, 15, matFor('#8a5a40'), 12, 24, tex3('chips'));
    });
    g.globalCompositeOperation = 'destination-out'; [[50, 52, 8], [44, 59, 7.5], [53, 44, 6]].forEach(function (b) { circ(g, b[0], b[1], b[2]); g.fill(); });
    g.globalCompositeOperation = 'source-atop'; g.strokeStyle = '#33190f'; g.lineWidth = 3; [[50, 52, 8], [44, 59, 7.5], [53, 44, 6]].forEach(function (b) { circ(g, b[0], b[1], b[2]); g.stroke(); });
    g.globalCompositeOperation = 'source-over';
  }
}
function* tile4(g, side, v) {   // Fruit Garden: a tree trunk with a leaf; the poles that hang from the leafy roof are thick twisted vines
  var T = tex3(side ? 'bark' : 'vine');
  yield* toy3(g, OW, TH, function (R, s) { cyl3(R, s, 29, 0, 29, TH, 12.5, 12.5, matFor(side ? '#b97d44' : '#58b244'), T); });
  var sx = v % 2 ? 17 : 41, d = v % 2 ? -1 : 1, sy = 44 - v * 5; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + d * 14, sy - 12, sx + d * 20, sy - 4); g.quadraticCurveTo(sx + d * 12, sy + 3, sx, sy + 3); fs(g, '#5fcf4f', '#2f7a35', 1.3);
}
function* cap4(g, side, kind) {   // a fruit tree (ground poles) or the end of a hanging vine with fruit (roof poles)
  var flip = !side, Y = function (y) { return flip ? 64 - y : y; }, FC = ['#e8404f', '#f59a2a', '#b8e050'];
  if (!side) {   // the vine's end: a knot where it thickens into a bud, big leaves to each side, and three fruits hanging below
    yield* toy3(g, OW, 66, function (R, s) {
      ball3(R, s, 29, 20, 0, 14.5, 7, 14.5, matFor('#3f9a38'), 8, 18);
      ball3(R, s, 29, 35, 0, 17, 16, 17, matFor('#63cc52'), 12, 20);
      [[21, 50], [37, 50], [29, 57]].forEach(function (f) { ball3(R, s, f[0], f[1], 14, 5.6, kind === 2 ? 6.6 : 5.6, 5.6, matFor(FC[kind]), 8, 12); });
    });
    [-1, 1].forEach(function (d) { var x0 = 29 + d * 12; g.beginPath(); g.moveTo(x0, 26); g.quadraticCurveTo(29 + d * 30, 22, 29 + d * 27, 46); g.quadraticCurveTo(29 + d * 14, 44, x0, 26); fs(g, '#5fcf4f', '#2f7a35', 1.3); });
    return;
  }
  yield* toy3(g, OW, 66, function (R, s) {
    [[14, 34, 12, 0], [44, 34, 12, 0], [19, 19, 13, 3], [39, 19, 13, 3], [29, 45, 12, 2], [29, 30, 17.5, 6]].forEach(function (c, i) { ball3(R, s, c[0], Y(c[1]), c[3], c[2], c[2], c[2], matFor(i % 2 ? '#52bd4a' : '#63cc52'), 12, 18); });
    [[19, 21], [41, 23], [29, 35], [13, 39], [45, 40], [28, 50]].forEach(function (f) { ball3(R, s, f[0], Y(f[1]) + (flip ? 1 : 0), 14, 5.6, kind === 2 ? 6.6 : 5.6, 5.6, matFor(FC[kind]), 8, 12); });
  });
}
/* ---------- 4: FRUIT GARDEN (the trees ARE the obstacles) ---------- */
function fruit(g, x, y, r, kind) {
  var c = [['#ff7b7b', '#d92f3f'], ['#ffc04d', '#e8751a'], ['#e3f57a', '#8fbf2a']][kind];
  g.beginPath();
  if (kind === 2) { g.moveTo(x, y - r * 1.15); g.bezierCurveTo(x + r * .7, y - r * 1.15, x + r * .55, y - r * .2, x + r, y + r * .35); g.bezierCurveTo(x + r, y + r * 1.1, x - r, y + r * 1.1, x - r, y + r * .35); g.bezierCurveTo(x - r * .55, y - r * .2, x - r * .7, y - r * 1.15, x, y - r * 1.15); }
  else g.arc(x, y, r, 0, PI2);
  fs(g, rg(g, x - r * .35, y - r * .35, 1, x, y, r * 1.2, [[0, lit(c[0], .5)], [.5, c[0]], [1, c[1]]]), drk(c[1], .55), 1.5);
  g.fillStyle = 'rgba(255,255,255,.85)'; circ(g, x - r * .38, y - r * .4, r * .22); g.fill();
  g.strokeStyle = '#5a3a1c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - r * (kind === 2 ? 1.1 : .9)); g.lineTo(x + 1.5, y - r * (kind === 2 ? 1.5 : 1.3)); g.stroke();
  g.beginPath(); g.moveTo(x + 1.5, y - r * 1.2); g.quadraticCurveTo(x + r * .9, y - r * 1.7, x + r * 1.1, y - r * 1.1); g.quadraticCurveTo(x + r * .5, y - r * .9, x + 1.5, y - r * 1.2); fs(g, '#5fcf4f', '#2f7a35', 1);
}
function canopy(g, kind, flip) {
  var Y = function (y) { return flip ? 64 - y : y; };
  [[14, 34, 12], [44, 34, 12], [29, 30, 17], [19, 19, 13], [39, 19, 13], [29, 45, 12]].forEach(function (c, i) {
    circ(g, c[0], Y(c[1]), c[2]); fs(g, rg(g, c[0] - 4, Y(c[1]) - 5, 2, c[0], Y(c[1]), c[2] * 1.2, [[0, '#8fe36a'], [.55, '#4fb84a'], [1, '#2f8a3a']]), '#256a2e', 1.5);
  });
  g.fillStyle = 'rgba(255,255,255,.18)'; [[16, 14], [36, 12], [26, 24]].forEach(function (c) { ell(g, c[0], Y(c[1]), 4, 2.4, -.5); g.fill(); });
  [[19, 21], [41, 23], [29, 35], [13, 39], [45, 40], [28, 50]].forEach(function (f) { fruit(g, f[0], Y(f[1]) + (flip ? 1 : 0), 5.4, kind); });
}
function trunkTile(g, v) {
  g.fillStyle = lg(g, 17, 0, 41, 0, [[0, '#7a4a22'], [.3, '#cf9358'], [.65, '#9a6232'], [1, '#5a3418']]); g.fillRect(17, 0, 24, TH);
  g.strokeStyle = 'rgba(60,30,10,.4)'; g.lineWidth = 1.3; [23, 29, 35].forEach(function (x, i) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (i + v) % 3 * 2 - 2, 35, x, TH); g.stroke(); });
  g.fillStyle = 'rgba(40,20,5,.55)'; ell(g, 24 + (v % 2) * 10, 16 + v * 12, 3.6, 5.2); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(20, 0, 2.2, TH);
  var sx = v % 2 ? 17 : 41, d = v % 2 ? -1 : 1, sy = 44 - v * 5; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + d * 14, sy - 12, sx + d * 20, sy - 4); g.quadraticCurveTo(sx + d * 12, sy + 3, sx, sy + 3); fs(g, '#5fcf4f', '#2f7a35', 1.3);
}
/* ---------- the Fruit Garden is one long journey: Fancy comes ashore from the sea and slowly flies into Prince Chimp's jungle island ----------
   Its far, near and top scenery are single long pictures (not repeating tiles) that scroll once across the stage: beach first, jungle by the end. */
var JT = 4, JD = 2600, JGW = JD + W + 8, JFW = Math.ceil(JD * .27) + W + 8, JMW = Math.ceil(JD * .56) + W + 8, HZ = 436;
function sstep(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
function pj(x, P) { return Math.max(0, Math.min(1, (x - 180) / (P - W))); }   // how far into the journey a spot on a strip is, 0 (the beach) to 1 (the jungle)
function leafShape(g, L, c1, c2) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * .5, -L * .34, L, L * .22); g.quadraticCurveTo(L * .55, L * .02, 0, 0); fs(g, c1, c2, 1.2); }
function palmGardenOld(g, x, yb, h, lean, s) {
  var tx = x + lean, ty = yb - h, i, a, t, L = 46 * s;
  g.beginPath(); g.moveTo(x, yb); g.quadraticCurveTo(x + lean * .1, yb - h * .55, tx, ty); g.strokeStyle = '#6a4318'; g.lineWidth = 9 * s; g.stroke(); g.strokeStyle = '#b98649'; g.lineWidth = 6 * s; g.stroke();
  g.strokeStyle = 'rgba(90,55,20,.55)'; g.lineWidth = 1.2; for (i = 1; i < 9; i++) { t = i / 9; var px = x + 2 * (1 - t) * t * lean * .1 + t * t * lean, py = yb - 2 * (1 - t) * t * h * .55 - t * t * h; g.beginPath(); g.moveTo(px - 3.2 * s, py); g.lineTo(px + 3.2 * s, py - 1.2); g.stroke(); }
  for (i = 0; i < 7; i++) { a = -2.9 + i * .5; g.save(); g.translate(tx, ty); g.rotate(a); if (Math.cos(a) < 0) g.scale(1, -1); leafShape(g, L * (i === 3 ? .8 : 1), i % 2 ? '#3fae4a' : '#58c957', '#1f6a2c'); g.restore(); }
  circ(g, tx - 3, ty + 5, 3.4 * s); fs(g, '#7a4a22', '#4a2a10', 1); circ(g, tx + 3, ty + 6, 3.2 * s); fs(g, '#8a5a2a', '#4a2a10', 1);
}
function umbrella(g, x, yb, c1, c2) {
  g.fillStyle = c1; g.fillRect(x - 38, yb - 3, 60, 5); g.fillStyle = c2; for (var i = 0; i < 60; i += 12) g.fillRect(x - 38 + i, yb - 3, 6, 5);   // towel
  g.beginPath(); g.moveTo(x, yb); g.lineTo(x + 4, yb - 54); g.strokeStyle = '#7a5a3a'; g.lineWidth = 3; g.stroke();
  g.save(); g.beginPath(); g.moveTo(x - 30, yb - 46); g.quadraticCurveTo(x + 4, yb - 92, x + 38, yb - 48); g.quadraticCurveTo(x + 27, yb - 52, x + 16, yb - 47); g.quadraticCurveTo(x + 4, yb - 52, x - 8, yb - 47); g.quadraticCurveTo(x - 19, yb - 52, x - 30, yb - 46); g.closePath();
  g.fillStyle = c1; g.fill(); g.clip(); g.fillStyle = c2; for (i = 0; i < 70; i += 20) g.fillRect(x - 30 + i, yb - 95, 10, 50); g.restore();
  g.beginPath(); g.moveTo(x - 30, yb - 46); g.quadraticCurveTo(x + 4, yb - 92, x + 38, yb - 48); g.strokeStyle = '#7a3a2a'; g.lineWidth = 1.6; g.stroke();
}
function sandcastle(g, x, yb) {
  g.beginPath(); g.moveTo(x - 30, yb); g.lineTo(x - 24, yb - 14); g.lineTo(x + 24, yb - 14); g.lineTo(x + 30, yb); g.closePath(); fs(g, '#e8c27a', '#b08a44', 1.4);
  [[-20, 22], [0, 30], [20, 22]].forEach(function (t) { rr(g, x + t[0] - 7, yb - 14 - t[1], 14, t[1], 2); fs(g, '#f0cc86', '#b08a44', 1.4); for (var i = 0; i < 3; i++) { g.fillStyle = '#f0cc86'; g.fillRect(x + t[0] - 7 + i * 5, yb - 14 - t[1] - 4, 4, 4); } });
  g.strokeStyle = '#7a5a3a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, yb - 44); g.lineTo(x, yb - 58); g.stroke(); g.beginPath(); g.moveTo(x, yb - 58); g.lineTo(x + 11, yb - 54); g.lineTo(x, yb - 50); g.closePath(); fs(g, '#ff5a6e', '#a8283a', 1);
}
function beachBall(g, x, yb) {
  circ(g, x, yb - 11, 11); g.fillStyle = '#fff'; g.fill(); g.save(); g.clip(); ['#ff5a6e', '#ffd93b', '#4fb8ff'].forEach(function (c, i) { g.beginPath(); g.moveTo(x, yb - 11); g.arc(x, yb - 11, 14, i * 2.1 + .3, i * 2.1 + 1.05); g.closePath(); g.fillStyle = c; g.fill(); }); g.restore(); circ(g, x, yb - 11, 11); g.strokeStyle = '#6a5a7a'; g.lineWidth = 1.3; g.stroke();
}
function starfish(g, x, yb, c) { var i, a, r; g.beginPath(); for (i = 0; i < 10; i++) { a = -1.57 + i * .6283; r = i % 2 ? 3.4 : 8; g.lineTo(x + Math.cos(a) * r, yb - 5 + Math.sin(a) * r); } g.closePath(); fs(g, c, drk(c, .4), 1.1); }
function crab(g, x, yb) {
  g.strokeStyle = '#a8301f'; g.lineWidth = 1.6; for (var d = -1; d <= 1; d += 2) for (var i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + d * 7, yb - 5); g.lineTo(x + d * (12 + i * 2), yb - 3 + i * 1.5); g.stroke(); }
  ell(g, x, yb - 7, 10, 6.5); fs(g, rg(g, x - 3, yb - 10, 1, x, yb - 7, 11, [[0, '#ff7a5a'], [1, '#d8402a']]), '#8a2214', 1.3);
  [-1, 1].forEach(function (d) { circ(g, x + d * 12, yb - 13, 4.6); fs(g, '#e8503a', '#8a2214', 1.2); g.beginPath(); g.moveTo(x + d * 3, yb - 12); g.lineTo(x + d * 3.5, yb - 17); g.strokeStyle = '#8a2214'; g.lineWidth = 1.2; g.stroke(); circ(g, x + d * 3.5, yb - 18, 2.4); fs(g, '#fff', '#3a2008', 1); circ(g, x + d * 3.5, yb - 18, 1); fs(g, '#222', null); });
}
function rowboat(g, x, yb) {
  g.beginPath(); g.moveTo(x - 36, yb - 16); g.quadraticCurveTo(x - 30, yb + 1, x - 8, yb + 1); g.lineTo(x + 20, yb + 1); g.quadraticCurveTo(x + 36, yb - 2, x + 42, yb - 18); g.closePath(); fs(g, lg(g, 0, yb - 18, 0, yb + 1, [[0, '#d98a4a'], [1, '#9a5a2a']]), '#5a3418', 1.6);
  g.fillStyle = '#f3e7d0'; g.fillRect(x - 33, yb - 14, 72, 3.2); g.strokeStyle = '#7a4a22'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 6, yb - 12); g.lineTo(x + 44, yb + 4); g.stroke(); rr(g, x + 40, yb, 12, 5, 2); fs(g, '#c9a060', '#7a4a22', 1);
}
function surfboard(g, x, yb, c) { g.save(); g.translate(x, yb - 26); g.rotate(.18); ell(g, 0, 0, 7.5, 28); fs(g, c, drk(c, .4), 1.4); g.fillStyle = '#fff'; g.fillRect(-1.6, -26, 3.2, 52); g.restore(); }
function sign(g, x, yb) {
  g.fillStyle = '#7a4a22'; g.fillRect(x - 3, yb - 56, 6, 56); g.beginPath(); g.moveTo(x - 44, yb - 54); g.lineTo(x + 38, yb - 54); g.lineTo(x + 52, yb - 42); g.lineTo(x + 38, yb - 30); g.lineTo(x - 44, yb - 30); g.closePath(); fs(g, lg(g, 0, yb - 54, 0, yb - 30, [[0, '#e0a560'], [1, '#b87a3a']]), '#5a3418', 1.8);
  g.fillStyle = '#3a1f0a'; g.font = 'bold 10px ' + FONT; g.textAlign = 'center'; g.fillText('CHIMP', x - 2, yb - 45); g.fillText('ISLAND', x - 2, yb - 34); g.textAlign = 'start';
}
function torch(g, x, yb) { g.fillStyle = '#6a4318'; g.fillRect(x - 2.5, yb - 52, 5, 52); g.fillStyle = '#9a6a30'; g.fillRect(x - 4, yb - 52, 8, 5); g.beginPath(); g.moveTo(x - 5, yb - 54); g.quadraticCurveTo(x - 8, yb - 66, x, yb - 76); g.quadraticCurveTo(x + 8, yb - 66, x + 5, yb - 54); g.closePath(); fs(g, lg(g, 0, yb - 76, 0, yb - 54, [[0, '#fff0a0'], [1, '#ff7a1f']]), '#c9501a', 1.2); }
function fern(g, x, yb, s, c) { for (var i = -3; i <= 3; i++) { g.save(); g.translate(x, yb); g.rotate(i * .32); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(4 * s, -28 * s, 14 * s * Math.sign(i || 1) * .5, -44 * s); g.strokeStyle = c; g.lineWidth = 4.4 - Math.abs(i) * .5; g.stroke(); g.restore(); } }
function bush(g, x, yb, s, c1, c2) { [[-12, -8, 12], [0, -14, 15], [13, -8, 12], [0, -5, 13]].forEach(function (b) { circ(g, x + b[0] * s, yb + b[1] * s, b[2] * s); fs(g, rg(g, x + b[0] * s - 3, yb + b[1] * s - 4, 1, x + b[0] * s, yb + b[1] * s, b[2] * s * 1.2, [[0, c1], [1, c2]]), drk(c2, .4), 1.3); }); }
function bigLeaf(g, x, yb, s) { for (var i = -2; i <= 2; i++) { g.save(); g.translate(x, yb); g.rotate(i * .5); g.scale(1, -1); g.rotate(-Math.PI / 2 + .1 * i); g.scale(s, s); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(16, -14, 14, -52, 0, -66); g.bezierCurveTo(-14, -52, -16, -14, 0, 0); fs(g, lg(g, -14, 0, 14, 0, [[0, '#2f9a3a'], [.5, '#62d04e'], [1, '#2a8a36']]), '#17481f', 1.3); g.strokeStyle = 'rgba(20,80,30,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -62); g.stroke(); g.restore(); } }
function jtree(g, x, yb, h, r) {
  var ty = yb - h, i;
  g.beginPath(); g.moveTo(x - 11, yb); g.quadraticCurveTo(x - 7, yb - h * .5, x - 6, ty); g.lineTo(x + 6, ty); g.quadraticCurveTo(x + 8, yb - h * .5, x + 11, yb); g.closePath(); fs(g, lg(g, x - 11, 0, x + 11, 0, [[0, '#4a3018'], [.45, '#7a5430'], [1, '#3a2410']]), '#2a1a0c', 1.5);
  for (i = 0; i < 6; i++) { var a = i * 1.05, cx2 = x + Math.cos(a) * 24, cy2 = ty - 6 + Math.sin(a) * 12; circ(g, cx2, cy2, 24 + r() * 8); fs(g, rg(g, cx2 - 6, cy2 - 8, 2, cx2, cy2, 34, [[0, '#4fc04a'], [1, '#1f6a2c']]), '#17481f', 1.4); }
  g.strokeStyle = '#2f8a3a'; g.lineWidth = 2.2; for (i = 0; i < 3; i++) { var vx = x - 24 + i * 22; g.beginPath(); g.moveTo(vx, ty + 12); g.quadraticCurveTo(vx + 5, ty + 36, vx - 2, ty + 56 + r() * 20); g.stroke(); }
}
function sailboat(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s); g.beginPath(); g.moveTo(-14, -2); g.lineTo(14, -2); g.lineTo(9, 5); g.lineTo(-9, 5); g.closePath(); fs(g, '#d9534f', '#7a1f1c', 1.3);
  g.strokeStyle = '#5a3418'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -26); g.stroke();
  g.beginPath(); g.moveTo(1, -25); g.lineTo(12, -6); g.lineTo(1, -6); g.closePath(); fs(g, '#ffffff', '#8a9ab8', 1.1); g.beginPath(); g.moveTo(-1, -22); g.lineTo(-10, -6); g.lineTo(-1, -6); g.closePath(); fs(g, '#fff4d6', '#8a9ab8', 1.1); g.restore();
}
function lighthouse(g, x, y) {
  ell(g, x, y + 2, 26, 8); fs(g, '#8a8a96', '#4a4a56', 1.3);
  g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x - 6, y - 52); g.lineTo(x + 6, y - 52); g.lineTo(x + 9, y); g.closePath(); g.save(); g.fillStyle = '#ffffff'; g.fill(); g.clip(); g.fillStyle = '#e8283f'; g.fillRect(x - 12, y - 42, 24, 10); g.fillRect(x - 12, y - 20, 24, 10); g.restore();
  g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x - 6, y - 52); g.lineTo(x + 6, y - 52); g.lineTo(x + 9, y); g.closePath(); g.strokeStyle = '#6a3040'; g.lineWidth = 1.4; g.stroke();
  rr(g, x - 7, y - 62, 14, 10, 2); fs(g, '#ffe27a', '#8a5a10', 1.2); g.beginPath(); g.moveTo(x - 9, y - 62); g.lineTo(x, y - 72); g.lineTo(x + 9, y - 62); g.closePath(); fs(g, '#e8283f', '#7a1020', 1.2);
}
var J = {
  sea: function (g) {   // the open sea behind everything: it fills the lower sky, and the island scenery rises over it
    g.fillStyle = lg(g, 0, HZ, 0, GY, [[0, '#8fe0f4'], [.35, '#46bde6'], [1, '#1f8fc8']]); g.fillRect(0, HZ, W, GY - HZ);
    g.fillStyle = lg(g, 0, HZ - 30, 0, HZ + 4, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,.55)']]); g.fillRect(0, HZ - 30, W, 34);
    var r = rnd(9), i; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.6; for (i = 0; i < 26; i++) { var y = HZ + 8 + r() * (GY - HZ - 14), x = r() * W, l = 10 + (y - HZ) * .25 + r() * 10; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke(); }
    g.fillStyle = 'rgba(255,248,190,.55)'; for (i = 0; i < 9; i++) { ell(g, 292 + (r() - .5) * 40, HZ + 8 + i * 12, 14 - i, 1.8); g.fill(); }   // sunlight on the water
  },
  far: function (g, P) {
    var r = rnd(41), x, h, y, i;
    function ridge(x0, x1, hm, c0, c1, sd) { g.beginPath(); g.moveTo(x0, HZ + 16); for (x = x0; x <= P; x += 5) { h = hm * sstep((x - x0) / (x1 - x0)) * (.8 + .2 * Math.sin(x * .021 + sd) + .1 * Math.sin(x * .067)); g.lineTo(x, HZ + 6 - h); } g.lineTo(P, HZ + 16); g.closePath(); fs(g, lg(g, 0, HZ - hm, 0, HZ + 16, [[0, c0], [1, c1]]), null); }
    function tufts(x0, x1, hm, sd, c) { for (x = x0; x < P; x += 24 + r() * 14) { h = hm * sstep((x - x0) / (x1 - x0)) * (.8 + .2 * Math.sin(x * .021 + sd) + .1 * Math.sin(x * .067)); if (h < 8) continue; y = HZ + 6 - h; g.strokeStyle = '#2a5a30'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + 1, y - 8); g.stroke(); for (i = 0; i < 5; i++) { g.save(); g.translate(x + 1, y - 8); g.rotate(-2.6 + i * .65); if (i < 3) g.scale(1, -1); leafShape(g, 11, c, '#1f5a28'); g.restore(); } } }
    [[100, 1], [470, .8], [790, 1.1]].forEach(function (b) { sailboat(g, b[0], HZ + 10, b[1]); });
    lighthouse(g, 330, HZ + 6);
    ell(g, 640, HZ + 8, 34, 8); fs(g, '#7fb890', null); palm(g, 640, HZ + 6, 24, 3, .34);   // a tiny islet with one palm
    ridge(P * .3, P * .6, 92, '#9fd0b4', '#6aa890', 1); tufts(P * .3, P * .6, 92, 1, '#6fb48a');
    g.beginPath(); g.moveTo(P * .74 - 86, HZ + 12); g.lineTo(P * .74 - 16, HZ - 128); g.quadraticCurveTo(P * .74, HZ - 136, P * .74 + 16, HZ - 128); g.lineTo(P * .74 + 86, HZ + 12); g.closePath(); fs(g, lg(g, 0, HZ - 136, 0, HZ + 12, [[0, '#8a6a86'], [1, '#5a4a6a']]), '#3a2a4a', 1.5);   // the volcano
    ell(g, P * .74, HZ - 129, 17, 5); fs(g, rg(g, P * .74, HZ - 129, 1, P * .74, HZ - 129, 18, [[0, '#fff0a0'], [1, '#ff6a1f']]), '#a8401a', 1.2);
    for (i = 0; i < 4; i++) { circ(g, P * .74 + 4 + i * 9, HZ - 150 - i * 20, 9 + i * 4); g.fillStyle = 'rgba(210,205,220,' + (.8 - i * .15) + ')'; g.fill(); }
    var tx = P * .9; rr(g, tx - 14, HZ - 96, 28, 106, 2); fs(g, lg(g, tx - 14, 0, tx + 14, 0, [[0, '#8e9a8a'], [.5, '#c7d1c0'], [1, '#6c7868']]), '#3a4636', 1.6); for (i = 0; i < 4; i++) { g.fillStyle = '#8e9a8a'; g.fillRect(tx - 14 + i * 8, HZ - 102, 6, 7); }
    rr(g, tx - 4, HZ - 70, 8, 14, 4); fs(g, '#2a3a2a', null);   // the keep with a gold crown
    g.beginPath(); g.moveTo(tx - 10, HZ - 104); g.lineTo(tx - 12, HZ - 120); g.lineTo(tx - 5, HZ - 113); g.lineTo(tx, HZ - 124); g.lineTo(tx + 5, HZ - 113); g.lineTo(tx + 12, HZ - 120); g.lineTo(tx + 10, HZ - 104); g.closePath(); fs(g, gold(g, HZ - 124, HZ - 104), '#8a5a10', 1.3);
    ridge(P * .46, P * .8, 66, '#4fa060', '#2f7a40', 3); tufts(P * .46, P * .8, 66, 3, '#2f8a3f');
  },
  mid: function (g, P) {
    var r = rnd(77), x, p, e, c, i, n = 0, u, s;
    for (x = 0; x < P; x += 6) {   // the land: wet sand, dry sand, then grass and jungle floor
      p = pj(x + 3, P); e = 556 - 40 * sstep(p / .2) - 84 * sstep((p - .42) / .4) - 3 * Math.sin(x * .05) - 2 * Math.sin(x * .13);
      c = p < .4 ? mix('#f6dc9a', '#a6cf68', sstep(p / .4)) : mix('#a6cf68', '#3f9a45', sstep((p - .4) / .4));
      g.fillStyle = c; g.fillRect(x, e, 6.6, 570 - e);
      if (p > .3 && x % 12 === 0) { var rr2 = 13 + 9 * Math.abs(Math.sin(x * .37)), cc = mix('#58b84c', '#1f6a2c', sstep((p - .3) / .5)); circ(g, x + 3, e + 2, rr2 * sstep((p - .3) / .25)); fs(g, rg(g, x, e - 4, 2, x + 3, e + 2, rr2 + 4, [[0, lit(cc, .25)], [1, cc]]), drk(cc, .4), 1.2); }   // leafy undergrowth along the top edge, thicker deeper in the island
      if (p < .5) { g.fillStyle = 'rgba(190,130,60,' + (.5 * (1 - p / .5)) + ')'; g.fillRect(x, e, 6.6, 8); }
    }
    for (x = 0; x < P; x += 15) { p = pj(x, P); if (p > .32) break; e = 556 - 40 * sstep(p / .2) - 3 * Math.sin(x * .05) - 2 * Math.sin(x * .13); g.fillStyle = 'rgba(255,255,255,' + (.9 * (1 - p / .32)) + ')'; circ(g, x + 4, e - 1, 5.5 + 1.5 * Math.sin(x * .3)); g.fill(); }   // foam at the water's edge
    var done = {}, pairs = [['#ff7fa9', '#ffffff'], ['#ffd93b', '#ff5a6e'], ['#4fb8ff', '#ffffff']];
    for (x = 50; x < P - 40; x += (pj(x, P) > .6 ? 36 + r() * 34 : 62 + r() * 56)) {
      p = pj(x, P); u = r(); s = .85 + r() * .35;
      if (!done.sign && p > .46) { done.sign = 1; sign(g, x, 566); continue; }
      if (p < .3) {
        if (u < .26) palm(g, x, 563, 82 + r() * 40, (r() - .5) * 30, s);
        else if (u < .36) umbrella(g, x, 565, pairs[n % 3][0], pairs[n++ % 3][1]);
        else if (u < .46) sandcastle(g, x, 566);
        else if (u < .54) beachBall(g, x, 566);
        else if (u < .64) starfish(g, x, 567, r() < .5 ? '#ff8a5a' : '#ff6b9a');
        else if (u < .74) crab(g, x, 566);
        else if (u < .8 && !done.boat) { done.boat = 1; rowboat(g, x, 566); }
        else if (u < .88) surfboard(g, x, 566, r() < .5 ? '#ffd93b' : '#ff6b9a');
        else fern(g, x, 566, .5, '#5fae4a');
      } else if (p < .66) {
        if (u < .3) palm(g, x, 564, 90 + r() * 40, (r() - .5) * 26, s);
        else if (u < .5) fern(g, x, 566, .9, '#3f9e45');
        else if (u < .64) bush(g, x, 566, s, '#6fd45a', '#2f8a3a');
        else if (u < .78) bigLeaf(g, x, 566, .7 * s);
        else if (u < .9) torch(g, x, 566);
        else starfish(g, x, 567, '#ff8a5a');
      } else {
        if (u < .34) jtree(g, x, 566, 130 + r() * 50, r);
        else if (u < .54) bigLeaf(g, x, 566, .9 * s);
        else if (u < .72) fern(g, x, 566, 1.1, '#2f8a3a');
        else if (u < .88) bush(g, x, 566, s * 1.1, '#4fc04a', '#1f6a2c');
        else torch(g, x, 566);
      }
    }
    for (x = 20; x < P; x += 38 + r() * 30) { p = pj(x, P); if (p > .5 && r() < .8) { c = ['#ff6b8a', '#ffd23f', '#b07aff', '#ff9a3c'][Math.floor(r() * 4)]; for (i = 0; i < 5; i++) { ell(g, x + Math.cos(i * 1.256) * 3.6, 554 + Math.sin(i * 1.256) * 3.6, 2.8, 2.8); fs(g, c, drk(c, .3), .8); } circ(g, x, 554, 2); fs(g, '#ffd84a', null); } }   // jungle flowers
  },
  top: function (g, P) {   // a solid leafy roof along the top edge (thicker deeper in the island); leaves and vines grow out of it, so nothing floats
    var r = rnd(12), x, p, th, cy, rr, c, d, l, i;
    for (x = -8; x < P + 10; x += 9) {
      p = pj(x, P); th = (4 + 24 * sstep((p - .1) / .55)) * sstep((p - .03) / .1); if (th < .5) continue;
      cy = -8 + th * (.3 + .4 * r()); rr = 12 + r() * 8; c = mix('#4fb84a', '#1f6a2c', sstep((p - .15) / .6) * (.6 + .4 * r()));
      circ(g, x, cy, rr); fs(g, rg(g, x - 4, cy - 4, 2, x, cy, rr * 1.2, [[0, lit(c, .3)], [1, c]]), drk(c, .45), 1.3);
    }
    for (x = -10; x < P + 10; x += 22) {
      p = pj(x, P); th = (4 + 24 * sstep((p - .1) / .55)) * sstep((p - .03) / .1); if (th < 10 || r() > .75) continue;
      l = 14 + r() * (12 + 20 * p);
      g.save(); g.translate(x, 2 + r() * 4); g.rotate(.5 - r()); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(l * .5, 2, l * .6, l * .8, 0, l); g.bezierCurveTo(-l * .5, l * .8, -l * .5, 2, 0, 0); fs(g, lg(g, -l * .4, 0, l * .4, 0, [[0, '#2f8a3a'], [.5, '#62d04e'], [1, '#226a2c']]), '#17481f', 1.3); g.restore();
    }
    for (x = 20; x < P; x += 58) { p = pj(x, P); if (p < .42 || r() > .85) continue; l = 24 + r() * 40 * p; g.strokeStyle = '#2b7a35'; g.lineWidth = 2.3; g.beginPath(); g.moveTo(x, 4); g.quadraticCurveTo(x + 7, 8 + l * .55, x - 1, 8 + l); g.stroke(); for (i = 1; i < 4; i++) { ell(g, x + (i % 2 ? 4 : -4), 8 + l * i / 4, 4.5, 2.6, i % 2 ? .6 : -.6); fs(g, '#5fcf4f', '#2f7a35', .9); } }
  },
  ground: function (g, P) {
    var r = rnd(5), x, p, c1, c2, i;
    for (x = 0; x < P; x += 8) {
      p = pj(x + 4, P);
      c1 = p < .45 ? mix('#f2d891', '#9ae06a', sstep(p / .45)) : mix('#9ae06a', '#58b84c', sstep((p - .45) / .4));
      c2 = p < .45 ? mix('#d9b86c', '#9a6a3a', sstep(p / .45)) : mix('#9a6a3a', '#6a4524', sstep((p - .45) / .4));
      g.fillStyle = c2; g.fillRect(x, 14, 8.5, 58); g.fillStyle = c1; g.fillRect(x, 0, 8.5, 16);
      if (r() < sstep((p - .15) / .5)) { g.fillStyle = mix('#6fd04f', '#2f8a3a', p); g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 3, -4); g.lineTo(x + 6, 4); g.fill(); }
      if (r() < .1) { ell(g, x + 3, 22 + r() * 36, 3 + r() * 3, 2 + r() * 1.5); fs(g, p < .4 ? '#fff0d0' : '#a89880', p < .4 ? '#c9a878' : '#5a4a38', 1); }
    }
    g.fillStyle = lg(g, 0, 0, 0, 72, [[0, 'rgba(255,255,255,.2)'], [.3, 'rgba(255,255,255,0)'], [1, 'rgba(30,15,5,.3)']]); g.fillRect(0, 0, P, 72);
  }
};
DEF[4] = {
  ov: 22,
  ts: [{ pitch: 70, h: 70, nv: 4 }, { pitch: 70, h: 70, nv: 4 }], kinds: 3, capH: [[66, 66, 66], [66, 66, 66]],
  sky: function (g) {
    g.fillStyle = lg(g, 0, 0, 0, GY, [[0, '#8fd6ff'], [.7, '#dff4ff'], [1, '#cdeeb8']]); g.fillRect(0, 0, W, GY);
    g.fillStyle = rg(g, 292, 92, 6, 292, 92, 90, [[0, 'rgba(255,248,190,.9)'], [1, 'rgba(255,248,190,0)']]); g.fillRect(180, 0, 180, 200); circ(g, 292, 92, 24); fs(g, rg(g, 286, 86, 2, 292, 92, 26, [[0, '#fffbd0'], [1, '#ffd84a']]), '#e8a91a', 2);
    [[60, 90, 1], [190, 150, 1.3], [300, 220, .8]].forEach(function (c) { var x = c[0], y = c[1], s = c[2]; g.fillStyle = 'rgba(255,255,255,.9)'; [[0, 0, 26], [24, -8, 22], [48, 0, 24], [22, 8, 20]].forEach(function (b) { circ(g, x + b[0] * s, y + b[1] * s, b[2] * s); g.fill(); }); });
    J.sea(g);
  },
  farP: JFW, farY: 260, farH: 240, far: J.far,
  midP: JMW, midY: 330, midH: 238, mid: J.mid,
  topP: JMW, topY: 0, topH: 86, top: J.top,
  ground: J.ground,
  tile: function (g, side, v) { return tile4(g, side, v); },
  cap: function (g, side, kind) { return cap4(g, side, kind); },
  hit: function (side) { return [[8, 6, 42, 18], [2, 18, 54, 48], [10, 48, 38, 58], [17, 56, 24, Infinity]]; }
};

/* ---------- 5: PRINCE CHIMP'S JUNGLE KINGDOM ---------- */
function stoneG(g, x0, x1) { return lg(g, x0, 0, x1, 0, [[0, '#5d6d58'], [.28, '#a7b79d'], [.58, '#7e8f78'], [1, '#4a5946']]); }
function moss(g, x, y, w, r) { g.fillStyle = '#5fbf4a'; for (var i = 0; i < w; i += 5) { circ(g, x + i + 2, y + Math.sin(i * 1.7 + r) * 1.4, 3.2 + (i % 3)); g.fill(); } g.fillStyle = 'rgba(255,255,255,.25)'; for (i = 0; i < w; i += 9) { circ(g, x + i + 1, y - 1.5, 1.1); g.fill(); } }
function glyph(g, cx, cy, v) {
  g.strokeStyle = '#2f3b2c'; g.lineWidth = 1.8; g.beginPath();
  if (v === 0) { g.arc(cx, cy, 6, 0, 5.2); g.arc(cx, cy, 2.6, 0, 5.2); }                                            // spiral
  else if (v === 1) { g.moveTo(cx - 8, cy + 4); g.lineTo(cx - 4, cy - 4); g.lineTo(cx, cy + 4); g.lineTo(cx + 4, cy - 4); g.lineTo(cx + 8, cy + 4); }   // zig zag
  else if (v === 2) { g.moveTo(cx - 8, cy - 2); g.quadraticCurveTo(cx, cy + 10, cx + 8, cy - 2); g.moveTo(cx - 5, cy - 6); g.lineTo(cx + 5, cy + 6); g.moveTo(cx + 5, cy - 6); g.lineTo(cx - 5, cy + 6); }   // crossed banana
  else { g.moveTo(cx - 8, cy + 4); g.lineTo(cx - 8, cy - 3); g.lineTo(cx - 4, cy + 1); g.lineTo(cx, cy - 5); g.lineTo(cx + 4, cy + 1); g.lineTo(cx + 8, cy - 3); g.lineTo(cx + 8, cy + 4); g.closePath(); }       // crown
  g.stroke(); g.strokeStyle = 'rgba(255,230,140,.55)'; g.lineWidth = .8; g.stroke();
}
function totemTile(g, v) {
  g.fillStyle = stoneG(g, 15, 43); g.fillRect(15, 0, 28, 70);
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(19, 0, 4, 70); g.fillStyle = 'rgba(30,45,28,.28)'; g.fillRect(38, 0, 5, 70);
  g.strokeStyle = '#2f3b2c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(15, 0); g.lineTo(15, 70); g.moveTo(43, 0); g.lineTo(43, 70); g.stroke();
  g.fillStyle = '#3a4837'; g.fillRect(15, 33, 28, 2.4); g.fillRect(15, 0, 28, 1.6); g.fillRect(15, 68.4, 28, 1.6);
  rr(g, 18.5, 8, 21, 22, 4); fs(g, 'rgba(30,45,28,.18)', 'rgba(30,45,28,.55)', 1); glyph(g, 29, 19, v);
  rr(g, 18.5, 39, 21, 24, 4); fs(g, 'rgba(30,45,28,.18)', 'rgba(30,45,28,.55)', 1); glyph(g, 29, 51, (v + 2) % 4);
  moss(g, 15, 33, 28, v); if (v % 2) moss(g, 15, 68, 28, v + 3);
  g.strokeStyle = '#4fa83e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(41, 0); g.quadraticCurveTo(36, 18 + v * 4, 41, 36); g.stroke();
}
function idol(g, cx, cy, kind) {                                                       // a carved stone chimp head, always upright
  var i;
  if (kind) { for (i = -2; i <= 2; i++) { g.save(); g.translate(cx, cy - 14); g.rotate(i * .42); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-7, -18, 0, -34 + Math.abs(i) * 3); g.quadraticCurveTo(7, -18, 0, 0); g.closePath(); fs(g, lg(g, 0, 0, 0, -34, [[0, ['#ff5c8a', '#ffb43b', '#41c9a2', '#ffb43b', '#ff5c8a'][i + 2]], [1, ['#c4285a', '#d9801a', '#17956f', '#d9801a', '#c4285a'][i + 2]]]), '#3c4a38', 1.2); g.restore(); } }
  circ(g, cx - 25, cy + 1, 8.5); fs(g, stoneG(g, cx - 34, cx - 17), '#2f3b2c', 1.7); circ(g, cx + 25, cy + 1, 8.5); fs(g, stoneG(g, cx + 17, cx + 34), '#2f3b2c', 1.7);
  rr(g, cx - 22, cy - 22, 44, 46, 15); fs(g, stoneG(g, cx - 22, cx + 22), '#2f3b2c', 2.2);
  g.fillStyle = 'rgba(255,255,255,.26)'; rr(g, cx - 17, cy - 19, 9, 22, 4.5); g.fill();
  ell(g, cx, cy + 5, 16, 14); fs(g, lg(g, cx, cy - 8, cx, cy + 20, [[0, '#d5dfc9'], [1, '#98aa90']]), '#3c4a38', 1.3);
  g.strokeStyle = '#2f3b2c'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - 17, cy - 9); g.lineTo(cx - 3, cy - 5); g.moveTo(cx + 17, cy - 9); g.lineTo(cx + 3, cy - 5); g.stroke();   // angry brow
  [-1, 1].forEach(function (d) { ell(g, cx + d * 8, cy - 1, 4.6, 4); fs(g, rg(g, cx + d * 8, cy - 1, 0, cx + d * 8, cy - 1, 5, [[0, '#fff3a0'], [1, '#ff9a1f']]), '#6a3a10', 1.1); circ(g, cx + d * 8.4, cy - .6, 1.5); g.fillStyle = '#2b1a0c'; g.fill(); });
  circ(g, cx - 2.6, cy + 7, 1); circ(g, cx + 2.6, cy + 7, 1); g.fillStyle = '#2f3b2c'; g.fill();
  g.beginPath(); g.moveTo(cx - 10, cy + 13); g.quadraticCurveTo(cx, cy + 19, cx + 10, cy + 13); g.lineWidth = 2.2; g.strokeStyle = '#2f3b2c'; g.stroke();
  [-6, 6].forEach(function (x) { g.beginPath(); g.moveTo(cx + x - 2.6, cy + 14.6); g.lineTo(cx + x, cy + 20); g.lineTo(cx + x + 2.6, cy + 14.6); g.closePath(); fs(g, '#fffdf0', '#2f3b2c', 1); });
  moss(g, cx - 20, cy - 21, 40, kind + 2);
  if (!kind) { g.beginPath(); g.moveTo(cx - 18, cy - 21); g.lineTo(cx - 19, cy - 36); g.lineTo(cx - 9, cy - 28); g.lineTo(cx, cy - 40); g.lineTo(cx + 9, cy - 28); g.lineTo(cx + 19, cy - 36); g.lineTo(cx + 18, cy - 21); g.closePath(); fs(g, gold(g, cy - 40, cy - 21), '#8a5a10', 1.8); [[-19, -36, '#ff4a6a'], [0, -40, '#3fd0ff'], [19, -36, '#ff4a6a']].forEach(function (j) { circ(g, cx + j[0], cy + j[1], 2.8); fs(g, j[2], '#6a1a2a', 1); }); }
}
DEF[5] = {
  ts: [{ pitch: 70, h: 70, nv: 4 }, { pitch: 70, h: 70, nv: 4 }], kinds: 2, capH: [[76, 76], [76, 76]],
  sky: function (g) {
    g.fillStyle = lg(g, 0, 0, 0, GY, [[0, '#3b2a6e'], [.3, '#a9488a'], [.58, '#ff9d62'], [1, '#ffe08e']]); g.fillRect(0, 0, W, GY);
    var r = rnd(8), i; for (i = 0; i < 22; i++) { circ(g, r() * W, r() * 170, .6 + r() * 1.2); g.fillStyle = 'rgba(255,255,255,' + (.4 + r() * .5) + ')'; g.fill(); }
    g.fillStyle = rg(g, 258, 372, 10, 258, 372, 150, [[0, 'rgba(255,240,170,.85)'], [1, 'rgba(255,200,120,0)']]); g.fillRect(100, 220, 260, 300);
    circ(g, 258, 372, 40); fs(g, rg(g, 250, 362, 2, 258, 372, 42, [[0, '#fffbd6'], [1, '#ffc94a']]), '#e8932a', 2);
    g.fillStyle = 'rgba(255,255,255,.14)'; [[40, 140, 90], [200, 100, 120], [280, 190, 70]].forEach(function (c) { rr(g, c[0], c[1], c[2], 10, 5); g.fill(); });
  },
  farP: 420, farY: 250, farH: 280,
  far: function (g, P) {
    g.fillStyle = '#7a3f7a'; g.beginPath(); g.moveTo(-10, 500); g.lineTo(-10, 430); g.lineTo(40, 380); g.lineTo(90, 420); g.lineTo(140, 360); g.lineTo(200, 410); g.lineTo(250, 350); g.lineTo(300, 400); g.lineTo(350, 370); g.lineTo(P + 10, 420); g.lineTo(P + 10, 500); g.closePath(); g.fill();
    g.fillStyle = '#5d2f66'; g.beginPath(); g.moveTo(-10, 500); g.lineTo(-10, 460); g.lineTo(60, 430); g.lineTo(120, 462); g.lineTo(190, 440); g.lineTo(260, 470); g.lineTo(330, 440); g.lineTo(P + 10, 470); g.lineTo(P + 10, 500); g.closePath(); g.fill();
    g.fillStyle = '#4a2658'; g.fillRect(150, 300, 120, 120); g.beginPath(); g.moveTo(130, 460); g.lineTo(160, 380); g.lineTo(260, 380); g.lineTo(290, 460); g.closePath(); g.fill();   // castle rock
    [[160, 330, 26, 70], [196, 300, 30, 100], [236, 322, 26, 78]].forEach(function (t) { g.fillStyle = '#6a3a78'; g.fillRect(t[0], t[1], t[2], t[3] + 20); g.beginPath(); g.moveTo(t[0] - 4, t[1]); g.lineTo(t[0] + t[2] / 2, t[1] - 26); g.lineTo(t[0] + t[2] + 4, t[1]); g.closePath(); g.fillStyle = '#8a4a9a'; g.fill(); g.fillStyle = '#ffd24a'; g.fillRect(t[0] + t[2] / 2 - 3, t[1] + 14, 6, 9); });
    g.beginPath(); g.moveTo(190, 268); g.lineTo(188, 252); g.lineTo(196, 260); g.lineTo(211, 248); g.lineTo(226, 260); g.lineTo(234, 252); g.lineTo(232, 268); g.closePath(); fs(g, gold(g, 248, 268), '#8a5a10', 1.4);   // a giant crown on the tallest tower
    g.fillStyle = '#d9335a'; g.beginPath(); g.moveTo(211, 248); g.lineTo(211, 232); g.lineTo(225, 237); g.lineTo(211, 242); g.fill();
  },
  midP: 360, midY: 400, midH: 168,
  mid: function (g, P) {
    var r = rnd(21), x, i;
    for (x = 20; x < P; x += 110) { g.fillStyle = '#2d5a38'; g.beginPath(); g.moveTo(x, 568); g.quadraticCurveTo(x + 4, 480, x + 10, 400); g.lineTo(x + 30, 400); g.quadraticCurveTo(x + 36, 480, x + 40, 568); g.closePath(); g.fill(); g.fillStyle = '#24492e'; g.fillRect(x + 22, 410, 6, 158);
      for (i = 0; i < 3; i++) { g.strokeStyle = '#3f8a4a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + 20, 404); g.quadraticCurveTo(x + 20 + (i - 1) * 40, 380, x + 20 + (i - 1) * 60, 418 + i * 4); g.stroke(); } }
    for (x = 70; x < P; x += 180) { g.fillStyle = '#4a3a2a'; g.fillRect(x, 480, 5, 88); g.fillStyle = '#3a2c20'; g.fillRect(x + 3, 480, 2, 88);                                   // banner pole and cloth
      g.beginPath(); g.moveTo(x + 5, 484); g.lineTo(x + 5 + 38, 484); g.lineTo(x + 5 + 38, 536); g.lineTo(x + 5 + 19, 524); g.lineTo(x + 5, 536); g.closePath(); fs(g, lg(g, 0, 484, 0, 536, [[0, '#a24ad8'], [1, '#5f2a98']]), '#3b1a5c', 1.6);
      g.beginPath(); g.moveTo(x + 14, 508); g.quadraticCurveTo(x + 24, 520, x + 34, 508); g.quadraticCurveTo(x + 24, 514, x + 14, 508); fs(g, '#ffd93b', '#8a5a10', 1); circ(g, x + 20, 497, 3.6); fs(g, '#e8bf98', '#6a4128', 1); circ(g, x + 32, 497, 3.6); fs(g, '#e8bf98', '#6a4128', 1); }
    for (x = 36; x < P; x += 120) { g.fillStyle = '#3a2c20'; g.fillRect(x, 520, 4, 48); circ(g, x + 2, 516, 7); fs(g, rg(g, x + 2, 516, 0, x + 2, 516, 8, [[0, '#fff3a0'], [1, '#ff7a1f']]), '#a24a10', 1); g.fillStyle = rg(g, x + 2, 514, 0, x + 2, 514, 30, [[0, 'rgba(255,190,80,.35)'], [1, 'rgba(255,190,80,0)']]); g.fillRect(x - 28, 484, 60, 60); }
    g.fillStyle = '#1f4a2a'; for (x = 0; x < P; x += 14) { g.beginPath(); g.moveTo(x, 568); g.quadraticCurveTo(x + 4, 544 - r() * 18, x + 10, 568); g.fill(); }
  },
  topP: 360, topY: 0, topH: 86,
  top: function (g, P) {
    var r = rnd(33), x, i;
    for (x = -12; x < P + 12; x += 26) { var s = 18 + r() * 12; g.save(); g.translate(x, 4 + r() * 8); g.rotate(.4 - r() * .8); ell(g, 0, 8, 11, s); fs(g, lg(g, -10, 0, 10, 0, [[0, '#2f8a3a'], [.5, '#59c24a'], [1, '#226a2c']]), '#17481f', 1.4); g.strokeStyle = 'rgba(20,70,28,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 8 + s); g.stroke(); g.restore(); }
    for (x = 18; x < P; x += 58) { var l = 30 + r() * 36; g.strokeStyle = '#2b7a35'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, 10); g.quadraticCurveTo(x + 7, 10 + l * .55, x - 1, 10 + l); g.stroke(); for (i = 1; i < 4; i++) { ell(g, x + (i % 2 ? 4 : -4), 10 + l * i / 4, 4.6, 2.6, i % 2 ? .6 : -.6); fs(g, '#5fcf4f', '#2f7a35', .9); } if (r() < .6) { circ(g, x - 1, 12 + l, 3.6); fs(g, r() < .5 ? '#ff6b8a' : '#ffd23f', '#8a2a3a', 1); } }
  },
  ground: function (g) {
    g.fillStyle = lg(g, 0, 16, 0, 72, [[0, '#6a4a2a'], [1, '#33200f']]); g.fillRect(0, 14, 64, 58);
    g.fillStyle = lg(g, 0, 0, 0, 16, [[0, '#4fa83e'], [1, '#256a2e']]); g.fillRect(0, 0, 64, 16);
    g.fillStyle = '#6fd04f'; for (var x = 0; x < 64; x += 8) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 3, -4 + (x % 16 ? 2 : 0)); g.lineTo(x + 6, 4); g.fill(); }
    rr(g, 2, 22, 28, 18, 4); fs(g, lg(g, 0, 22, 0, 40, [[0, '#a7b79d'], [1, '#6f8068']]), '#3c4a38', 1.2); rr(g, 34, 28, 28, 18, 4); fs(g, lg(g, 0, 28, 0, 46, [[0, '#a7b79d'], [1, '#6f8068']]), '#3c4a38', 1.2);
    g.strokeStyle = '#2a1a0c'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 56); g.quadraticCurveTo(14, 48, 30, 60); g.quadraticCurveTo(46, 68, 64, 54); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 16, 64, 4);
  },
  tile: function (g, side, v) { totemTile(g, v); },
  cap: function (g, side, kind) {
    if (side) { g.fillStyle = stoneG(g, 15, 43); g.fillRect(15, 58, 28, 18); g.fillStyle = '#3a4837'; g.fillRect(15, 58, 28, 2); g.strokeStyle = '#2f3b2c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(15, 58); g.lineTo(15, 76); g.moveTo(43, 58); g.lineTo(43, 76); g.stroke(); idol(g, 29, 38, kind); }
    else { g.fillStyle = stoneG(g, 15, 43); g.fillRect(15, 0, 28, 24); g.fillStyle = '#3a4837'; g.fillRect(15, 22, 28, 2); g.strokeStyle = '#2f3b2c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(15, 0); g.lineTo(15, 24); g.moveTo(43, 0); g.lineTo(43, 24); g.stroke(); idol(g, 29, 46, kind); }
  },
  hit: function (side) { return side ? [[16, 0, 26, 18], [6, 16, 46, 46], [15, 58, 28, Infinity]] : [[6, 6, 46, 52], [16, 50, 26, 70], [15, 66, 28, Infinity]]; }
};
[3, 5].forEach(function (n) { var t = DEF[n].tile, c = DEF[n].cap; DEF[n].tile = function (g, s, v) { t(g, s, v); return puff(g, 1, true); }; DEF[n].cap = function (g, s, k) { c(g, s, k); return puff(g); }; });
DEF[5].wash = ['#f4d2c0', .4, .35, .12];
DEF[0].wash = ['#ffe9f1', .64, .52, .3]; DEF[1].wash = ['#fbe6bf', .45, .4, .2]; DEF[2].wash = ['#d5f6ef', .45, .4, .2]; DEF[3].wash = ['#222b46', .4, .35, 0]; DEF[4].wash = ['#dff4ff', .3, .05, .08];

/* ---------- the loop-de-loop launch track ---------- */
/* ============================ BUILD AND DRAW ============================ */
function strip(P, y, h, fn, wc, wa, fa) {
  var s = mk(P, h); s.g.translate(0, -y); fn(s.g, P); s.y = y; s.P = P; s.h = h;
  if (wa) { s.g.save(); s.g.setTransform(1, 0, 0, 1, 0, 0); s.g.globalCompositeOperation = 'source-atop'; s.g.globalAlpha = wa; s.g.fillStyle = wc; s.g.fillRect(0, 0, s.c.width, s.c.height); s.g.restore(); }
  if (fa && fa < 1) { s.g.save(); s.g.setTransform(1, 0, 0, 1, 0, 0); s.g.globalCompositeOperation = 'destination-in'; s.g.globalAlpha = fa; s.g.fillStyle = '#000'; s.g.fillRect(0, 0, s.c.width, s.c.height); s.g.restore(); }   // fade baked into the picture: stamping with a constant alpha is 3x slower in Firefox
  return s;
}
/* The same picture as strip(), but drawn in clipped bands (and the finishing washes as their own steps) so no single step is a long stall. */
function stripSteps(P, y, h, fn, wc, wa, fa, nb, done) {
  var s, st = [], i;
  st.push(function () { s = mk(P, h); s.y = y; s.P = P; s.h = h; });
  for (i = 0; i < nb; i++) (function (i) { st.push(function () { var g = s.g, sx = s.c.width / P, x0 = Math.round(P * i / nb * sx) / sx, x1 = i === nb - 1 ? P : Math.round(P * (i + 1) / nb * sx) / sx; g.save(); g.beginPath(); g.rect(x0, 0, x1 - x0, h); g.clip(); g.save(); g.translate(0, -y); fn(g, P); g.restore();
    if (wa) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = wa; g.fillStyle = wc; g.fillRect(x0, 0, x1 - x0, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    if (fa && fa < 1) { g.globalCompositeOperation = 'destination-in'; g.globalAlpha = fa; g.fillStyle = '#000'; g.fillRect(x0, 0, x1 - x0, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    g.restore(); }); })(i);
  st.push(function () { done(s); });
  return st;
}
/* bold cartoon outline around an obstacle picture. mode 0 tile: sides only (so tile joints stay seamless); 1 / 2: caps (not toward the far end) */
var OLG = { r: 1.5, c: '#33402f' };   // the Jungle Kingdom's pieces get a thin, forest-dark edge instead of the heavy plum one
function* boldG(w, h, draw, mode, ol) {   // an obstacle picture with its dark outline, built in slices (draw may be a plain function or a generator)
  var s = mk(w + PAD * 2, h + PAD * 2, 0, true), t, o, i, d, offs = [], r = ol ? ol.r : 2.7, a;
  s.g.translate(PAD, PAD); var rd = draw(s.g); if (rd && rd.next) yield* rd; yield;
  t = scratch(s.c.width, s.c.height); var tg = t.getContext('2d', RF); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, t.width, t.height);
  tg.drawImage(s.c, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = ol ? ol.c : INK; tg.fillRect(0, 0, t.width, t.height);   // (the shared scratch is stamped in the same slice)
  o = mk(w + PAD * 2, h + PAD * 2);
  for (i = 0; i < 12; i++) { a = i * PI2 / 12; d = [Math.cos(a) * r, Math.sin(a) * r]; if (mode === 0 && Math.abs(d[1]) > .01) continue; if (mode === 1 && d[1] > .3) continue; if (mode === 2 && d[1] < -.3) continue; offs.push(d); }
  o.g.setTransform(1, 0, 0, 1, 0, 0);
  for (i = 0; i < offs.length; i++) o.g.drawImage(t, Math.round(offs[i][0] * K), Math.round(offs[i][1] * K));
  o.g.drawImage(s.c, 0, 0); o.h = h; return o;
}
function bold(w, h, draw, mode) { var gen = boldG(w, h, draw, mode), r; while (!(r = gen.next()).done); return r.value; }
/* A stage's pictures are built as a list of small steps. ART.warm() queues them and ART.pump() runs a few milliseconds' worth per frame (no single big hitch);
   if the stage is needed before the queue finishes, sets() simply finishes the rest at once. */
var PLAN = {}, QUEUE = [], SLICEW = 60;
function pcLayer(p) {   // a saved layer (PicCache) back into the kind of picture mk() or chunkStrip() would have made
  var L, c, g, i;
  if (p.ch) { L = { ch: [], P: p.P, y: p.y, h: p.h }; for (i = 0; i < p.ch.length; i++) { c = PicCache.canvas(p.ch[i]); c.lw = p.ch[i].lw; L.ch.push(c); } return L; }
  c = PicCache.canvas(p); g = c.getContext('2d', RF); g.setTransform(c.width / p.w, 0, 0, c.height / p.h, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round';
  L = { c: c, g: g, w: p.w, h: p.h }; if (p.P !== undefined) { L.y = p.y; L.P = p.P; } return L;
}
function pcSave(L) {   // the pixels of a finished layer, ready to keep
  var o, i; if (L.ch) { o = { ch: [], P: L.P, y: L.y, h: L.h }; for (i = 0; i < L.ch.length; i++) { o.ch.push(PicCache.part(L.ch[i])); o.ch[i].lw = L.ch[i].lw; } return o; }
  o = PicCache.part(L.c); o.w = L.w; o.h = L.h; if (L.P !== undefined) { o.y = L.y; o.P = L.P; } return o;
}
function slicer(make, done) { var gen = null; return function () { var r; if (!gen) gen = make(); r = gen.next(); if (r.done) { done(r.value); return false; } return true; }; }   // a plan step that takes many calls: it returns true until it is finished
function planFor(th) {
  var p = PLAN[th]; if (p) return p; var D = DEF[th], s = { tiles: [[], []], caps: [[], []] }, st = [], side, i, v, JG = th === JT;
  st.push(function () { s.sky = mk(W, GY); });
  for (i = 0; i < 6; i++) (function (i) { st.push(function () { var g = s.sky.g, sy = s.sky.c.height / GY, y0 = Math.round(GY * i / 6 * sy) / sy, y1 = i === 5 ? GY : Math.round(GY * (i + 1) / 6 * sy) / sy; g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip(); D.sky(g); g.restore(); }); })(i);
  for (i = 0; i < 6; i++) (function (i) { st.push(function () { var g = s.sky.g, q = g.createRadialGradient(W / 2, GY * .45, GY * .35, W / 2, GY * .45, GY * 1.05); g.save(); q.addColorStop(0, 'rgba(70,30,100,0)'); q.addColorStop(1, 'rgba(70,30,100,.2)'); g.fillStyle = q; g.fillRect(0, GY * i / 6, W, GY / 6 + .5); g.restore(); }); })(i);   // a soft vignette in the sky (six small strips, like the sky itself): the eye settles on the middle
  function layerSteps(name, P, y, h, fn, wa, fa) {
    if (JG) { chunkStrip(P, y, h, fn, D.wash[0], wa, fa, function (L) { s[name] = L; }).forEach(function (f) { st.push(f); }); return; }
    var nb = Math.max(2, Math.round(P / SLICEW)); stripSteps(P, y, h, fn, D.wash[0], wa, fa, nb, function (L) { s[name] = L; }).forEach(function (f) { st.push(f); });
  }
  layerSteps('far', D.farP, D.farY, D.farH, D.far, D.wash[1], FARA[th]);
  layerSteps('mid', D.midP, D.midY, D.midH, D.mid, D.wash[2], MIDA[th]);
  layerSteps('top', D.topP, D.topY, D.topH, D.top, D.wash[3]);
  if (JG) {
    chunkStrip(JGW, 0, 72, D.ground, 0, 0, 0, function (L) { s.ground = L; }).forEach(function (f) { st.push(f); });
  } else st.push(function () { s.ground = mk(GP[th], 72); D.ground(s.ground.g, GP[th]); var g = s.ground.g, q = g.createLinearGradient(0, 0, 0, 72); g.save(); g.globalCompositeOperation = 'source-atop'; q.addColorStop(0, 'rgba(255,255,255,.34)'); q.addColorStop(.08, 'rgba(255,255,255,0)'); q.addColorStop(.55, 'rgba(60,30,90,0)'); q.addColorStop(1, 'rgba(60,30,90,.22)'); g.fillStyle = q; g.fillRect(0, 0, GP[th], 72); g.restore(); var gc = s.ground.c, ex = Math.ceil(K), gw = document.createElement('canvas'), wg; gw.width = gc.width + ex; gw.height = gc.height; wg = gw.getContext('2d', RF); wg.drawImage(gc, 0, 0); wg.drawImage(gc, 0, 0, ex, gc.height, gc.width, 0, ex, gc.height); s.ground.c = gw; });   // the floor: a lit top edge and a deeper tone toward the bottom; one picture-pixel of the next tile is added on the right, so the floor can slide by fractions of a pixel without a hairline between tiles
  var sc = st.length, pcn = 'scen' + th, pcs = PicCache.on && PicCache.boot ? PicCache.take(pcn, K) : null, pci, pcl;   // everything above is scenery (what the title screen shows); the obstacle pieces below are only needed once a run starts
  if (pcs) st.splice(0, sc, function () { var n; for (n in pcs) s[n] = pcLayer(pcs[n]); }), sc = 1;   // the first screen's scenery, put back from the browser's own storage (PicCache): exactly the pixels drawn on an earlier visit
  else if (PicCache.on && PicCache.boot) {
    for (pci = 0; pci < sc; pci++) (function (f) { st[pci] = function () { var t = performance.now(), r = f(); PicCache.built(performance.now() - t); return r; }; })(st[pci]);
    st.splice(sc, 0, function () { pcl = {}; ['sky', 'far', 'mid', 'top', 'ground'].forEach(function (n) { if (s[n]) pcl[n] = function () { return pcSave(s[n]); }; }); PicCache.save(pcn, K, pcl); }); sc++;
  }
  (TEXT[th] || []).forEach(function (k) { st.push(function () { tex3(k); }); });
  for (side = 0; side < 2; side++) {
    for (v = 0; v < D.ts[side].nv; v++) (function (side, v) { st.push(slicer(function () { return boldG(OW, D.ts[side].h, function (g) { return D.tile(g, side, v); }, 0, th === 5 ? OLG : null); }, function (o) { if (!D.noCyl) cylShade(o); rimH(o); edgeRows(o); s.tiles[side][v] = o; })); })(side, v);
    for (i = 0; i < D.kinds; i++) (function (side, i) { st.push(slicer(function () { return boldG(OW, D.capH[side][i], function (g) { return D.cap(g, side, i); }, side ? 1 : 2, th === 5 ? OLG : null); }, function (o) { capFinish(o); rimH(o); s.caps[side][i] = o; })); })(side, i);
  }
  var lr = rnd(th * 977 + 13), lout = [];   // the drifting life (balloons, butterflies, sparkles): one sprite per step, so no stage start ever builds them all at once
  (LIFE[th] || []).forEach(function (e) { for (var j = 0; j < e[1]; j++) (function (e, j) { st.push(function () { lout.push(lifeItem(th, e, j, lr)); }); })(e, j); });
  st.push(function () { s.life = lout; });
  st.push(function () {   // last: touch every finished picture once (a 1-pixel stamp), a step at a time, so the first real draw of a new stage is not the moment each one is first used
    var cs = [], k, L;
    ['sky', 'far', 'mid', 'top', 'ground'].forEach(function (n) { L = s[n]; if (!L) return; if (L.c) cs.push(L.c); if (L.ch) L.ch.forEach(function (c) { cs.push(c); }); });
    for (k = 0; k < 2; k++) { s.tiles[k].forEach(function (o) { cs.push(o.c); }); s.caps[k].forEach(function (o) { cs.push(o.c); }); }
    cs.forEach(function (c) { st.push(function () { if (TSKIP) return; if (TWAIT && TBUD <= 0) return 'wait'; TBUD -= c.width * c.height; touch(c); }); });   // each touch sends a whole picture to the graphics card: only a limited number of pixels per frame (see pump), or a burst of them can freeze the card for a fifth of a second
  });
  return (PLAN[th] = { s: s, st: st, i: 0, sc: sc });
}
var TCH = null, TBUD = 0, TWAIT = false, TSKIP = false, TLAST = 0, TBMAX = 420000;   // TBUD: pixels the touch steps may still send to the graphics card in this pump call
function touch(c) { if (!TCH) { TCH = document.createElement('canvas'); TCH.width = TCH.height = 1; TCH = TCH.getContext('2d', RF); } TCH.drawImage(c, 0, 0, 1, 1); }
function sets(th) {
  var s = SET[th]; if (s) return s; var p = planFor(th); TSKIP = true;
  /*TEST_HOOK_START*/ if (window.__sync) window.__sync.push([th, p.st.length - p.i, window.__stg]); /*TEST_HOOK_END*/
  while (p.i < p.st.length) { if (p.st[p.i]() !== true) p.i++; }
  TSKIP = false; SET[th] = p.s; delete PLAN[th]; return p.s;
}
function scenery(th) {   // just the sky, hills and ground: enough to draw the title screen. The obstacle pieces keep building in the background (pump) or when a run needs them (sets)
  var s = SET[th]; if (s) return s; var p = planFor(th);
  while (p.i < p.sc) { if (p.st[p.i]() !== true) p.i++; }
  return p.s;
}
function sceneStep(th, ms) {   // build the scenery a few milliseconds at a time (the first screen of a first visit): true once the sky, hills and ground are all built
  if (sceneReady(th)) return true; var p = planFor(th), t0 = performance.now();
  while (p.i < p.sc) { if (p.st[p.i]() !== true) p.i++; if (performance.now() - t0 >= ms) break; }
  return p.i >= p.sc;
}
function warm(th, front) {   // front: this stage is needed next (the retry after a death): it jumps the queue and the plans of other stages wait (their finished steps are kept)
  if (SET[th]) return; var i = QUEUE.indexOf(th);
  if (front) { planFor(th); QUEUE = [th]; return; }
  if (i < 0) { planFor(th); QUEUE.push(th); }
}
/*TEST_HOOK_START*/ function slowBurn(t0) { if (window.__slow > 1) { var d = (performance.now() - t0) * (window.__slow - 1), b = performance.now(); while (performance.now() - b < d); } } /*TEST_HOOK_END*/
function pump(ms, min) {   // run queued build steps for about `ms` milliseconds, and at least `min` steps (default 1); returns true while work is left
  var t0 = performance.now(), th, p, c = 0, mn = min || 1, s0, r; TWAIT = ms < 1000; TBUD = TBMAX; TLAST = 0;
  while (TASKQ.length) { /*TEST_HOOK_START*/ s0 = performance.now(); /*TEST_HOOK_END*/ if (TASKQ[0]() !== true) TASKQ.shift(); /*TEST_HOOK_START*/ slowBurn(s0); /*TEST_HOOK_END*/ if (++c >= mn && performance.now() - t0 >= ms) return true; }
  while (MGQ.length) { /*TEST_HOOK_START*/ s0 = performance.now(); /*TEST_HOOK_END*/ MGQ.shift()(); /*TEST_HOOK_START*/ slowBurn(s0); /*TEST_HOOK_END*/ if (++c >= mn && performance.now() - t0 >= ms) return true; }
  while (QUEUE.length) {
    th = QUEUE[0]; p = PLAN[th];
    if (!p) { QUEUE.shift(); continue; }
    if (p.i >= p.st.length) { sets(th); QUEUE.shift(); continue; }
    /*TEST_HOOK_START*/ var ts0 = performance.now(), ti0 = p.i; /*TEST_HOOK_END*/
    r = p.st[p.i](); if (r === 'wait') break; if (r !== true) p.i++; /*TEST_HOOK_START*/ slowBurn(ts0); if (window.__pl) window.__pl.push([th, ti0, performance.now() - ts0]); /*TEST_HOOK_END*/
    if (++c >= mn && performance.now() - t0 >= ms) break;
  }
  TLAST = TBMAX - TBUD; return QUEUE.length > 0;
}
function pend(th, mg) {   // how many build steps are still waiting before theme th is ready (th < 0: only the picture and mini game queues)
  var n = TASKQ.length + (mg ? MGQ.length : 0), i, q, p;
  if (th < 0) return n;
  if (SET[th]) return n;
  for (i = 0; i < QUEUE.length; i++) { q = QUEUE[i]; p = PLAN[q]; if (p) n += p.st.length - p.i; if (q === th) break; }
  return n;
}
function px(x) { return Math.round(x * K) / K; }
/* Every cached picture is stamped at its own pixel size, on whole device pixels: a 1:1 copy. (Stretching a picture by even 0.1% makes Firefox resample it, which was 15x slower.) */
function put(g, c, x, y) { g.drawImage(c, Math.round(x * K) / K, Math.round(y * K) / K, c.width / K, c.height / K); }
var OBSNAP = false;   // Test Lab switch: pillars on whole device pixels instead of sliding by fractions
function putX(g, c, x, y) { g.drawImage(c, OBSNAP ? Math.round(x * K) / K : x, Math.round(y * K) / K, c.width / K, c.height / K); }   // slides sideways by fractions of a pixel (so a gate glides instead of stepping), still on whole rows
function putS(g, c, x, y) { g.drawImage(c, x, y, c.width / K, c.height / K); }   // a lone moving picture: any fraction, both ways
function subpx() { return K < 1.75; }   // on a sharp screen (two or more device pixels to a unit) a whole-device-pixel step is already finer than the eye can follow; only a plainer screen gets the sliding-by-fractions drawing, which costs more in Firefox
function layer(g, L, off) {   // a repeating hill band: one pattern fill that slides by fractions of a pixel, so it glides instead of stepping (a pattern has no seams, even when the band is see-through)
  var c = L.c, Pc = c.width / K, o = off % Pc;
  if (!subpx()) { for (var x0 = px(-(off % L.P)); x0 < W; x0 += L.P) put(g, c, x0, L.y); return; }
  if (!L.pg || L.pg.g !== g) L.pg = { g: g, p: g.createPattern(c, 'repeat') };
  g.save(); g.translate(-o, Math.round(L.y * K) / K); g.scale(1 / K, 1 / K); g.fillStyle = L.pg.p; g.fillRect(0, 0, Math.ceil((W + o + 1) * K), c.height); g.restore();
}
function chunky(L) {   // cut a long picture into screen-wide pieces: stamping whole small pictures 1:1 is much cheaper in Firefox than copying a window out of a huge one
  var w = Math.round(W * K), n = Math.ceil(L.c.width / w), i, c, cg, out = [];
  for (i = 0; i < n; i++) { c = document.createElement('canvas'); c.width = Math.min(w, L.c.width - i * w); c.height = L.c.height; cg = c.getContext('2d', RF); cg.drawImage(L.c, -i * w, 0); out.push(c); }
  L.ch = out; L.c = null; return L;
}
function chunkStrip(P, y, h, fn, wc, wa, fa, done) {   // the garden's long pictures: built straight into screen-wide pieces (no giant canvas), a 60-unit band per step
  var L = { ch: [], P: P, y: y, h: h }, st = [], n = Math.ceil(P / W), bands = 6, i, j;
  for (i = 0; i < n; i++) (function (i) { st.push(function () { var c, g, w, lw = Math.min(W, P - i * W); w = Math.round(lw * K); c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, Math.ceil(h * K)); g = c.getContext('2d', RF); g.setTransform(K, 0, 0, K, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; c.lw = lw; L.ch.push(c); }); })(i);
  for (i = 0; i < n; i++) for (j = 0; j < bands; j++) (function (i, j) {
    st.push(function () {
      var c = L.ch[i], g = c.getContext('2d', RF), lw = c.lw, x0 = Math.round(lw * j / bands * K) / K, x1 = j === bands - 1 ? lw : Math.round(lw * (j + 1) / bands * K) / K;
      if (x1 - x0 <= 0) return;
      g.save(); g.beginPath(); g.rect(x0, 0, x1 - x0, h); g.clip(); g.save(); g.translate(-i * W, -y); fn(g, P); g.restore();
      if (wa) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = wa; g.fillStyle = wc; g.fillRect(x0, 0, x1 - x0, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (fa && fa < 1) { g.globalCompositeOperation = 'destination-in'; g.globalAlpha = fa; g.fillStyle = '#000'; g.fillRect(x0, 0, x1 - x0, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      g.restore();
    });
  })(i, j);
  if (subpx()) for (i = 0; i < n - 1; i++) (function (i) { st.push(function () {   // widen each piece by a few device pixels of its neighbor (see layerJ), one piece per step
    var ex = Math.ceil(K) + 1, c = L.ch[i], nx = L.ch[i + 1], w = document.createElement('canvas'), wg, m = Math.min(ex, nx.width);
    w.width = c.width + m; w.height = c.height; wg = w.getContext('2d', RF); wg.drawImage(c, 0, 0); wg.drawImage(nx, 0, 0, m, nx.height, c.width, 0, m, nx.height); w.lw = c.lw; L.ch[i] = w;
  }); })(i);
  st.push(function () { done(L); });
  return st;
}
function chunkSteps(get, done) {   // the same cut as chunky(), one screen-wide piece per step
  var L, w, n, out = [], st = [], i;
  st.push(function () { L = get(); w = Math.round(W * K); n = Math.ceil(L.c.width / w); });
  for (i = 0; i < 12; i++) (function (i) { st.push(function () { if (i >= n) return; var c = document.createElement('canvas'), cg; c.width = Math.min(w, L.c.width - i * w); c.height = L.c.height; cg = c.getContext('2d', RF); cg.drawImage(L.c, -i * w, 0); out.push(c); }); })(i);
  st.push(function () { L.ch = out; L.c = null; done(L); });
  return st;
}
function layerJ(g, L, off) {   // the garden's long journey pictures: screen-wide pieces that slide by fractions of a pixel. Each piece carries a pixel or two of the next one, and is cut off on a whole device pixel, so no seam shows
  var o = Math.max(0, Math.min(off || 0, L.P - W)), k = Math.floor(o / W), x = -(o - k * W), a = L.ch[k], b = L.ch[k + 1], y = Math.round(L.y * K) / K, q = Math.ceil((x + W) * K - 1e-6) / K, h = a.height / K;
  if (!subpx()) { put(g, a, px(x), L.y); if (b) put(g, b, px(x) + W, L.y); return; }
  if (!b) { putX(g, a, x, L.y); return; }
  g.save(); g.beginPath(); g.rect(-20, y - 2, q + 20, h + 4); g.clip(); putX(g, a, x, L.y); g.restore();
  g.save(); g.beginPath(); g.rect(q, y - 2, W + 20 - q, h + 4); g.clip(); putX(g, b, x + W, L.y); g.restore();
}   // the garden's long journey pictures
function sceneReady(th) { return !!SET[th] || !!(PLAN[th] && PLAN[th].i >= PLAN[th].sc); }   // the sky, hills and ground of this stage are built (asking for layersOf then costs nothing)
function layersOf(th) {   // the sky and the three hill bands as plain pictures (for a browser that slides them itself); null where the stage is built differently
  if (th === JT) return null;
  var s = scenery(th), f = s.far, m = s.mid, t = s.top;
  if (!s.sky || !s.sky.c || !f || !f.c || !m || !m.c || !t || !t.c) return null;
  return { K: K, sky: s.sky.c, bands: [{ L: f, f: .27 }, { L: m, f: .56 }, { L: t, f: .56 }] };
}
function back(g, th, dist) { var s = scenery(th); put(g, s.sky.c, 0, 0); if (th === JT) { layerJ(g, s.far, dist * .27); layerJ(g, s.mid, dist * .56); layerJ(g, s.top, dist * .56); return; } if (!ART.lite) layer(g, s.far, dist * .27); layer(g, s.mid, dist * .56); layer(g, s.top, dist * .56); }   // the quality governor's second step down (a struggling screen) skips the far hills; a normal screen draws them
function ground(g, th, off) { var s = scenery(th), P = GP[th]; if (th === JT) { s.ground.y = GY; layerJ(g, s.ground, off); return; } for (var x = -(off % P); x < W; x += P) putX(g, s.ground.c, x, GY); }
function edgeRows(o) {   // which pixel rows of a finished tile hold the picture (the first and the last): needed to close the one-pixel gaps that rounding can leave between stacked tiles
  var c = o.c, d = o.g.getImageData(0, 0, c.width, c.height).data, w0 = c.width, xs = [.35, .5, .65], i, y, x, a = c.height, b = -1;   // one read of the whole tile (each read can stall a phone's graphics chip), then look at three columns
  for (i = 0; i < xs.length; i++) {
    x = Math.floor(w0 * xs[i]);
    for (y = 0; y < c.height; y++) if (d[(y * w0 + x) * 4 + 3] > 100) { if (y < a) a = y; break; }
    for (y = c.height - 1; y >= 0; y--) if (d[(y * w0 + x) * 4 + 3] > 100) { if (y > b) b = y; break; }
  }
  o.r0 = a; o.r1 = b;
  if (b - a > 6) {   // the very first and last rows show the inside of the open tube (dark): paint them over with the row next to them, so a joint shows no line
    var g = o.g, w = c.width; g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, a, w, 1); g.drawImage(c, 0, a + 1, w, 1, 0, a, w, 1);
    g.clearRect(0, b, w, 1); g.drawImage(c, 0, b - 1, w, 1, 0, b, w, 1); g.restore();
  }
}
function cylShade(o) {   // makes a pole a round tube: a dark edge, a bright soft lobe on the left, a form shadow down the right. Only sideways, so stacked tiles still join without a seam.
  var c = o.c, w = c.width, h = c.height, ls = [], rs = [], i, d, x, y, g = o.g, q, mn, mx;
  for (i = 0; i < 9; i++) { y = Math.floor(h * (.06 + i * .11)); d = g.getImageData(0, y, w, 1).data; for (x = 0; x < w; x++) if (d[x * 4 + 3] > 120) { ls.push(x); break; } for (x = w - 1; x >= 0; x--) if (d[x * 4 + 3] > 120) { rs.push(x); break; } }
  if (ls.length < 4) return; ls.sort(function (a, b) { return a - b; }); rs.sort(function (a, b) { return a - b; }); mn = ls[ls.length >> 1]; mx = rs[rs.length >> 1];   // the MEDIAN edges of the body over nine rows, so a leaf or a branch on one tile cannot shift its shading against the next tile (that made visible joints)
  if (mx - mn < 8) return;
  q = g.createLinearGradient(mn, 0, mx, 0); q.addColorStop(0, 'rgba(40,20,70,.3)'); q.addColorStop(.1, 'rgba(40,20,70,0)'); q.addColorStop(.2, 'rgba(255,255,255,.42)'); q.addColorStop(.34, 'rgba(255,255,255,.05)'); q.addColorStop(.56, 'rgba(45,20,80,0)'); q.addColorStop(.86, 'rgba(45,20,80,.4)'); q.addColorStop(1, 'rgba(45,20,80,.16)');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = q; g.fillRect(0, 0, w, h); g.restore();
}
function capFinish(o) {   // the glossy toy finish on an end piece: a warm shade pooled lower right, a soft gloss up on the left with a crisp white dot, and a lit upper edge
  var c = o.c, w = c.width, h = c.height, g = o.g, q;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
  q = g.createRadialGradient(w * .74, h * .78, w * .04, w * .74, h * .78, w * .75); q.addColorStop(0, 'rgba(50,20,80,.4)'); q.addColorStop(1, 'rgba(50,20,80,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h);
  q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, 'rgba(255,255,255,.26)'); q.addColorStop(.18, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(w * .33, h * .3, w * .2, Math.min(h * .12, w * .09), -.55, 0, PI2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(w * .27, h * .24, Math.max(1.5, w * .022), 0, PI2); g.fill();
  g.restore();
}
function piece(g, s, D, th, side, x, edge, o, kind) {
  var t = D.ts[side], cp = s.caps[side][kind], ch = cp.h, ys = [], y, i, W2 = OW + PAD * 2, ov = D.ov || 6;   // ov: how far the pole runs in under the cap
  if (side) { for (y = edge + ch - ov; y < GY + 4; y += t.pitch) ys.push(y); } else { for (y = edge - ch + ov - t.h; y > -t.h - 2; y -= t.pitch) ys.push(y); }
  var tl;
  for (i = 0; i < ys.length; i++) {   // first a copy of each tile's last picture row, one row further down: it shows only where rounding left a gap between two tiles (the next tile is drawn over it otherwise)
    tl = s.tiles[side][(o.col + i) % t.nv];
    if (tl.r1 >= 0) g.drawImage(tl.c, 0, tl.r1, tl.c.width, 1, x - PAD, (Math.round((ys[i] - PAD) * K) + tl.r1 + 1) / K, tl.c.width / K, 1 / K);
  }
  for (i = ys.length - 1; i >= 0; i--) putX(g, s.tiles[side][(o.col + i) % t.nv].c, x - PAD, ys[i] - PAD);
  putX(g, cp.c, x - PAD, (side ? edge : edge - ch) - PAD);
}
function obstacle(g, o) {
  if (o.x > W + 40 || o.x < -OW - 40) return; var s = sets(o.th), D = DEF[o.th], x = o.x, kt = (o.kt || 0) % D.kinds, kb = (o.kb || 0) % D.kinds;
  piece(g, s, D, o.th, 0, x, o.gt, o, kt); piece(g, s, D, o.th, 1, x, o.gb, o, kb);
  var tt = performance.now() / 1000, sd = 0;   // a little star of light that glints on each end piece now and then, out of step from gate to gate
  for (sd = 0; sd < 2; sd++) {
    var ph = ((tt * .42 + (o.col * 3 + (sd ? kb : kt) * 5 + sd * 7) * .173) % 1), a = ph < .2 ? Math.sin(ph / .2 * Math.PI) : 0, cp = s.caps[sd][sd ? kb : kt];
    if (a > .05) { var sx = x - PAD + cp.c.width / K * .27, sy = (sd ? o.gb : o.gt - cp.h) - PAD + cp.c.height / K * .24, r = 7 * a; g.save(); g.globalAlpha = a; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(sx, sy - r); g.lineTo(sx + r * .25, sy - r * .25); g.lineTo(sx + r, sy); g.lineTo(sx + r * .25, sy + r * .25); g.lineTo(sx, sy + r); g.lineTo(sx - r * .25, sy + r * .25); g.lineTo(sx - r, sy); g.lineTo(sx - r * .25, sy - r * .25); g.closePath(); g.fill(); g.restore(); }
  }
}
function rects(o) {
  var D = DEF[o.th], out = [], side, L, i, e, d0, d1;
  for (side = 0; side < 2; side++) {
    L = D.hit(side, (side ? (o.kb || 0) : (o.kt || 0)) % D.kinds); e = side ? o.gb : o.gt;
    for (i = 0; i < L.length; i++) {
      d0 = L[i][1]; d1 = L[i][3];
      if (side) out.push([L[i][0], e + d0, L[i][2], (d1 === Infinity ? GY : e + d1) - (e + d0)]);
      else out.push([L[i][0], d1 === Infinity ? 0 : e - d1, L[i][2], (d1 === Infinity ? e - d0 : d1 - d0)]);
    }
  }
  return out;
}

/* ---------- little animated extras: drifting things and stage-specific life. Pre-drawn once, only stamped each frame ---------- */
function spr(w, h, draw) { var s = mk(w, h); draw(s.g); return s; }
var SPR = {
  cloud: function () { return spr(74, 34, function (g) { g.fillStyle = 'rgba(255,255,255,.92)'; [[18, 21, 13], [34, 15, 17], [52, 21, 13], [35, 24, 14]].forEach(function (c) { circ(g, c[0], c[1], c[2]); g.fill(); }); g.fillStyle = 'rgba(200,225,250,.55)'; g.fillRect(14, 27, 46, 4); }); },
  balloon: function (col) { return spr(26, 48, function (g) { ell(g, 13, 14, 10, 12.5); fs(g, rg(g, 9, 9, 1, 13, 14, 14, [[0, lit(col, .6)], [1, col]]), drk(col, .35), 1.2); g.beginPath(); g.moveTo(13, 26.5); g.lineTo(10.5, 30.5); g.lineTo(15.5, 30.5); g.closePath(); g.fillStyle = drk(col, .3); g.fill(); g.strokeStyle = 'rgba(80,60,90,.55)'; g.lineWidth = .9; g.beginPath(); g.moveTo(13, 30.5); g.quadraticCurveTo(8, 37, 13, 42); g.quadraticCurveTo(17, 46, 13, 48); g.stroke(); gloss(g, 7, 6, 4, 7, .7); }); },
  gull: function () { return spr(26, 14, function (g) { g.strokeStyle = '#ffffff'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(2, 9); g.quadraticCurveTo(7, 1, 13, 8); g.quadraticCurveTo(19, 1, 24, 9); g.stroke(); g.strokeStyle = '#8a98b0'; g.lineWidth = .9; g.stroke(); }); },
  bubble: function () { return spr(16, 16, function (g) { circ(g, 8, 8, 6); fs(g, 'rgba(255,255,255,.28)', 'rgba(255,255,255,.9)', 1.2); circ(g, 6, 5.8, 1.6); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill(); }); },
  dust: function () { return spr(10, 10, function (g) { g.fillStyle = rg(g, 5, 5, 0, 5, 5, 5, [[0, 'rgba(255,245,200,.95)'], [1, 'rgba(255,245,200,0)']]); g.fillRect(0, 0, 10, 10); }); },
  spark: function () { return spr(16, 16, function (g) { g.beginPath(); g.moveTo(8, 0); g.quadraticCurveTo(8.8, 7.2, 16, 8); g.quadraticCurveTo(8.8, 8.8, 8, 16); g.quadraticCurveTo(7.2, 8.8, 0, 8); g.quadraticCurveTo(7.2, 7.2, 8, 0); g.closePath(); fs(g, '#ffffff', 'rgba(255,225,120,.9)', .8); }); },
  leaf: function (col) { return spr(16, 12, function (g) { g.beginPath(); g.moveTo(1, 6); g.quadraticCurveTo(8, -3, 15, 6); g.quadraticCurveTo(8, 14, 1, 6); g.closePath(); fs(g, col, drk(col, .4), 1); g.strokeStyle = drk(col, .35); g.lineWidth = .8; g.beginPath(); g.moveTo(2, 6); g.lineTo(13, 6); g.stroke(); }); },
  butterfly: function (col) { return spr(24, 20, function (g) { [[-1, 0], [1, 0]].forEach(function (d) { g.save(); g.translate(12, 10); g.scale(d[0], 1); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(4, -11, 12, -9, 10, -2); g.bezierCurveTo(12, 3, 6, 9, 0, 1); g.closePath(); fs(g, col, drk(col, .45), 1); circ(g, 6, -4, 1.8); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); g.restore(); }); g.strokeStyle = '#4a3a5a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(12, 5); g.lineTo(12, 15); g.stroke(); }); }
};
var BAL = ['#ff7fa9', '#6fd0ff', '#ffd93b', '#a98bff'], FLY = ['#ffb43b', '#ff7fa9', '#8bd8ff'];
// per stage: [kind, how many, y range, rise or fall speed (px/s, up is negative), sideways drift (px/s), scenery follow factor, sway (px)]
var LIFE = [
  [['balloon', 3, 110, 420, -10, 0, .1, 7], ['spark', 7, 130, 430, 0, 0, .3, 0]],
  [['dust', 12, 100, 500, -3, -7, .12, 6], ['spark', 4, 150, 420, 0, 0, .35, 0]],
  [['bubble', 9, 150, 540, -24, 0, .12, 6], ['spark', 6, 150, 420, 0, 0, .3, 0]],
  [['dust', 10, 100, 500, -2, -5, .12, 5], ['spark', 9, 100, 500, 0, 0, .4, 0]],
  [['cloud', 3, 50, 190, 0, -8, .06, 0], ['gull', 3, 70, 300, 0, -24, .08, 8], ['butterfly', 3, 250, 470, 0, -16, .22, 22], ['leaf', 4, 30, 500, 20, -10, .16, 12]],
  [['spark', 11, 120, 500, 0, 0, .4, 0], ['leaf', 5, 30, 500, 22, -12, .16, 12], ['butterfly', 2, 250, 470, 0, -14, .22, 22]]
];
function lifeItem(th, e, j, r) {   // one drifting thing (its picture is cached after the first)
  var k = e[0], sp = k === 'balloon' ? SPR.balloon(BAL[(j + th) % 4]) : k === 'butterfly' ? SPR.butterfly(FLY[j % 3]) : k === 'leaf' ? SPR.leaf(j % 2 ? '#7ccf5a' : '#e8a23b') : SPR[k]();
  return { k: k, s: sp, y0: e[2], y1: e[3], vy: e[4], vx: e[5], par: e[6], sway: e[7], ph: r(), ph2: r(), f: .6 + r() * 1.4 };
}
function life(g, th, t, dist) {
  if (ART.lite) return;   // the quality governor (or a very slow screen) skips the drifting balloons, butterflies and sparkles
  var L = scenery(th).life, i, a, x, y, R, M = W + 90, ga = g.globalAlpha, tw;
  if (!L) return;   // still being built in the background (a step per frame): it simply appears when it is ready
  for (i = 0; i < L.length; i++) {
    a = L[i]; R = a.y1 - a.y0;
    x = (((a.ph2 * M + a.vx * t - dist * a.par) % M) + M) % M - 45 + (a.sway ? Math.sin(t * a.f + a.ph * 6.28) * a.sway : 0);
    if (a.vy < 0) y = a.y1 - (((t * -a.vy + a.ph * R) % R) + R) % R; else if (a.vy > 0) y = a.y0 + ((t * a.vy + a.ph * R) % R); else y = a.y0 + a.ph * R + Math.sin(t * a.f * 1.3 + a.ph * 6.28) * (a.k === 'butterfly' ? 14 : 3);
    if (a.k === 'spark') { tw = Math.sin(t * 2.6 * a.f + a.ph * 40); if (tw < .15) continue; g.globalAlpha = ga * tw; g.save(); g.translate(x, y); g.scale(.55 + tw * .6, .55 + tw * .6); g.drawImage(a.s.c, -8, -8, 16, 16); g.restore(); g.globalAlpha = ga; }
    else if (a.k === 'butterfly') { g.save(); g.translate(x, y); g.scale(1, .45 + .55 * Math.abs(Math.sin(t * 13 + a.ph * 9))); g.rotate(Math.sin(t * a.f) * .15); g.drawImage(a.s.c, -12, -10, 24, 20); g.restore(); }
    else if (a.k === 'leaf') { g.save(); g.translate(x, y); g.rotate(t * a.f * 1.5 + a.ph * 6); g.drawImage(a.s.c, -8, -6, 16, 12); g.restore(); }
    else if (a.k === 'dust') { g.globalAlpha = ga * (.45 + .35 * Math.sin(t * a.f + a.ph * 20)); g.drawImage(a.s.c, x - 5, y - 5, 10, 10); g.globalAlpha = ga; }
    else g.drawImage(a.s.c, x - a.s.w / 2, y - a.s.h / 2, a.s.w, a.s.h);
  }
}


/* ============================ MINI GAME ART: Chimp's Navy, seen from above. Fancy flies up over the sea; things scroll down toward him. ============================ */
function waterTile(g, P) {                                              // one 360 x P picture that repeats up and down
  var r = rnd(61), i, x, y, k;
  for (k = 0; k < 2; k++) for (i = 0; i < 34; i++) {
    x = r() * W; y = r() * P; var w = 16 + r() * 22, c = k ? 'rgba(255,255,255,.55)' : 'rgba(20,110,170,.28)';
    [0, -P, P].forEach(function (o) { g.strokeStyle = c; g.lineWidth = k ? 1.8 : 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - w / 2, y + o + 3 * k); g.quadraticCurveTo(x - w / 4, y + o - 4, x, y + o); g.quadraticCurveTo(x + w / 4, y + o + 4, x + w / 2, y + o); g.stroke(); });
  }
  g.fillStyle = 'rgba(255,255,255,.18)'; for (i = 0; i < 7; i++) { x = r() * W; y = r() * P; [0, -P, P].forEach(function (o) { ell(g, x, y + o, 30 + r() * 20, 5); g.fill(); }); }
}
function monkeyHead(g, s, hat) {   // a big cartoon chimp face, lit from the top left; hat: 'cap' (sailor cap) | 'band' (red bandana) | none
  g.save(); g.scale(s, s); g.lineJoin = 'round';
  [-1, 1].forEach(function (d) {   // ears: dark rim, pink middle
    circ(g, d * 14.6, 1.5, 6.4); fs(g, rg(g, d * 13, -1.5, 1, d * 14.6, 1.5, 8, [[0, '#b58558'], [1, '#5a3820']]), '#2b1a10', 1.7);
    circ(g, d * 14.6, 1.7, 3.6); fs(g, rg(g, d * 14, .6, .5, d * 14.6, 1.7, 4.4, [[0, '#ffd6c8'], [1, '#e08f80']]), null);
  });
  ell(g, 0, 0, 15.2, 14.4); fs(g, rg(g, -5.5, -7.5, 1.5, 0, 0, 20, [[0, '#c9946a'], [.55, '#8c5c3a'], [1, '#55331e']]), '#2b1a10', 1.9);   // head
  g.beginPath(); g.moveTo(0, -3.2); g.bezierCurveTo(-4, -8.4, -12.4, -5.4, -11.8, 1.4); g.bezierCurveTo(-11.8, 8.6, -6.4, 13.4, 0, 13.4); g.bezierCurveTo(6.4, 13.4, 11.8, 8.6, 11.8, 1.4); g.bezierCurveTo(12.4, -5.4, 4, -8.4, 0, -3.2); g.closePath();   // the light face
  fs(g, rg(g, -3, -2, 1, 0, 3, 16, [[0, '#fff0da'], [.7, '#f0c698'], [1, '#d9a070']]), '#6a4128', 1);
  [-1, 1].forEach(function (d) {   // big shiny eyes
    var x = d * 5.3; ell(g, x, -1.6, 4.1, 4.9); fs(g, rg(g, x - 1, -3.4, .5, x, -1.6, 5.6, [[0, '#ffffff'], [1, '#dfe6f0']]), '#2b1a10', 1.4);
    circ(g, x - d * .2 + .3, -.9, 2.7); g.fillStyle = '#1b100a'; g.fill(); circ(g, x + 1.2, -2.2, 1.05); g.fillStyle = '#fff'; g.fill(); circ(g, x - .7, .5, .5); g.fill();
    g.strokeStyle = '#2b1a10'; g.lineWidth = 2; g.beginPath(); g.moveTo(d * 9.6, -7.6); g.lineTo(d * 2.4, -5.8); g.stroke();   // cheeky brows
  });
  ell(g, 0, 6.2, 6.8, 5); fs(g, rg(g, -1.5, 4.4, .5, 0, 6.2, 7.6, [[0, '#fff3e2'], [1, '#e5b283']]), '#8a5a38', .9);   // muzzle
  g.fillStyle = '#6a3a22'; ell(g, -1.8, 4.5, .9, .65); g.fill(); ell(g, 1.8, 4.5, .9, .65); g.fill();
  g.beginPath(); g.moveTo(-4.8, 7.2); g.quadraticCurveTo(0, 14, 4.8, 7.2); g.quadraticCurveTo(0, 9, -4.8, 7.2); g.closePath(); fs(g, '#8a1e14', '#2b1a10', 1.1);   // a big grin
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-3.6, 7.7); g.quadraticCurveTo(0, 9.5, 3.6, 7.7); g.lineTo(3, 9); g.quadraticCurveTo(0, 10.2, -3, 9); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.4)'; ell(g, -6.4, -9.6, 5, 2.4, -.5); g.fill();   // a shine on the forehead
  if (hat === 'band') { g.beginPath(); g.moveTo(-14, -6.5); g.quadraticCurveTo(0, -18, 14, -6.5); g.lineTo(13.4, -2.4); g.quadraticCurveTo(0, -12.4, -13.4, -2.4); g.closePath(); fs(g, '#e8283f', '#6e0f20', 1.2); g.beginPath(); g.moveTo(13, -6); g.lineTo(21, -2.5); g.lineTo(14.6, -1); g.closePath(); fs(g, '#c41f35', '#6e0f20', 1); }
  if (hat === 'cap') {   // a sailor cap with a navy band and a gold button
    g.beginPath(); g.moveTo(-13.6, -6.6); g.quadraticCurveTo(-15, -16.5, 0, -17.2); g.quadraticCurveTo(15, -16.5, 13.6, -6.6); g.quadraticCurveTo(0, -3.4, -13.6, -6.6); g.closePath(); fs(g, lg(g, -14, -17, 12, -5, [[0, '#ffffff'], [1, '#cfd8ea']]), '#27307a', 1.6);
    g.beginPath(); g.moveTo(-13.8, -8.6); g.quadraticCurveTo(0, -5.2, 13.8, -8.6); g.lineTo(13.5, -5.6); g.quadraticCurveTo(0, -2.2, -13.5, -5.6); g.closePath(); fs(g, '#27307a', '#161c4e', 1); circ(g, 0, -16.8, 1.9); fs(g, '#ffd23a', '#8a5a00', .8);
  }
  g.restore();
}
function drawBarrels(g, n, vert) {   // one, two or three barrels seen from a little above (the staves and steel hoops show), a chimp popping out of each; neighbors are tied with a short knotted rope
  var i, k, cx, cy, R = 15.5, RY = 11, P = [], x, y, q;
  function front(cx, cy, dx, off) { return cy + off + RY * Math.sqrt(Math.max(0, 1 - (dx / R) * (dx / R))); }   // the front curve of the barrel at an offset down its side
  for (i = 0; i < n; i++) P.push(vert ? [22, 20 + i * 36] : [20 + i * 36, 22]);
  for (i = 0; i < n; i++) { ell(g, P[i][0] + 2, P[i][1] + 7, R + 4, RY + 3); fs(g, 'rgba(10,50,100,.32)', null); ell(g, P[i][0], P[i][1] + 5, R + 4, RY + 3); fs(g, 'rgba(255,255,255,.55)', null); }   // soft shadow on the sea, foam round the foot
  for (i = 0; i < n; i++) {
    cx = P[i][0]; cy = P[i][1];
    g.beginPath(); g.moveTo(cx - R, cy - 6); g.lineTo(cx - R, cy + 6); g.ellipse(cx, cy + 6, R, RY, 0, Math.PI, 0, true); g.lineTo(cx + R, cy - 6); g.closePath();   // the side of the barrel
    fs(g, lg(g, cx - R, 0, cx + R, 0, [[0, '#7a4a22'], [.3, '#e0a964'], [.5, '#c98f52'], [.82, '#8c5628'], [1, '#5e3416']]), '#35200f', 2.4);
    g.strokeStyle = 'rgba(60,30,10,.42)'; g.lineWidth = 1.1; for (k = -3; k <= 3; k++) { x = cx + k * 4.4; g.beginPath(); g.moveTo(x, front(cx, cy, k * 4.4, -6)); g.lineTo(x, front(cx, cy, k * 4.4, 6)); g.stroke(); }   // staves
    [-1.6, 4.4].forEach(function (off) {   // two steel hoops that follow the curve
      [['#2c3550', 3.4], ['#9aa6c0', 1.6]].forEach(function (c) { g.beginPath(); for (var d = -R + 1; d <= R - 1; d += 1.5) { y = front(cx, cy, d, off); if (d === -R + 1) g.moveTo(cx + d, y); else g.lineTo(cx + d, y); } g.strokeStyle = c[0]; g.lineWidth = c[1]; g.stroke(); });
    });
    ell(g, cx, cy - 6, R, RY); fs(g, rg(g, cx - 5, cy - 10, 1, cx, cy - 6, R + 2, [[0, '#f0c98a'], [.6, '#cf9758'], [1, '#8a5a2c']]), '#35200f', 2.4);   // the top
    ell(g, cx, cy - 6, R - 2.4, RY - 2.2); g.strokeStyle = 'rgba(255,235,200,.6)'; g.lineWidth = 1; g.stroke();
    ell(g, cx, cy - 6, 12.6, 8.4); fs(g, lg(g, cx - 10, cy - 14, cx + 10, cy + 2, [[0, '#9aa4bc'], [.5, '#e4e9f4'], [1, '#6c7690']]), '#2c3550', 1.5);   // the steel rim round the opening
    ell(g, cx, cy - 6, 10.6, 6.6); fs(g, rg(g, cx + 2, cy - 3, 1, cx, cy - 6, 11, [[0, '#4a2c14'], [1, '#1c0e06']]), '#2c3550', 1);
  }
  for (i = 0; i < n - 1; i++) {   // the rope: two turns round each barrel and a knot between, with a loose end
    g.save(); g.translate((P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); if (vert) g.rotate(Math.PI / 2);
    (vert ? [-6, 6] : [0, 8]).forEach(function (dy) {
      g.lineCap = 'round'; g.strokeStyle = '#3b2a12'; g.lineWidth = 5.6; g.beginPath(); g.moveTo(-10.5, dy); g.quadraticCurveTo(0, dy + 2.5, 10.5, dy); g.stroke();
      g.strokeStyle = '#ecd9a2'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-10.5, dy); g.quadraticCurveTo(0, dy + 2.5, 10.5, dy); g.stroke();
      g.strokeStyle = 'rgba(110,80,30,.7)'; g.lineWidth = 1; for (var t = -8.5; t < 9.5; t += 3.2) { g.beginPath(); g.moveTo(t, dy - 1.8); g.lineTo(t + 1.6, dy + 1.8); g.stroke(); }
    });
    circ(g, 0, vert ? 0 : 4, 4.6); fs(g, '#ecd9a2', '#3b2a12', 1.6); g.strokeStyle = 'rgba(110,80,30,.8)'; g.lineWidth = 1; g.beginPath(); g.arc(0, vert ? 0 : 4, 2.2, 0, 4.7); g.stroke();   // the knot
    g.strokeStyle = '#3b2a12'; g.lineWidth = 4.2; g.beginPath(); g.moveTo(0, 7); g.quadraticCurveTo(2, 13, -3, 16); g.stroke(); g.strokeStyle = '#ecd9a2'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 7); g.quadraticCurveTo(2, 13, -3, 16); g.stroke();
    g.restore();
  }
  for (i = 0; i < n; i++) {   // the chimps, last, so nothing covers a face
    cx = P[i][0]; cy = P[i][1];
    g.save(); g.translate(cx, cy - 8.6); monkeyHead(g, .58, 'band'); g.restore();
    [-1, 1].forEach(function (s) { ell(g, cx + s * 9.6, cy - 1.4, 4.2, 3.3, s * .6); fs(g, rg(g, cx + s * 8.8, cy - 2.4, .5, cx + s * 9.6, cy - 1.4, 4.6, [[0, '#b58558'], [1, '#6a4128']]), '#2b1a10', 1.4); });   // paws gripping the rim
  }
}
var SHP = null, JTL = null, SHH = 300;   // JTL: the jungle wall, a tile that repeats upward; SHH: how tall the beach picture is
function leafShape(g, len, w) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .3, -w, len, 0); g.quadraticCurveTo(len * .3, w, 0, 0); g.closePath(); }
function jungleLeaves(n, seed) {   // n big leaves of the jungle wall, shaded and veined, wrapping top to bottom so the tile repeats
  var g = JTL.g, r = rnd(seed), i, o, x, y, a, len, w, c = [['#1f6a32', '#13481f'], ['#2f8a3a', '#1d5f2a'], ['#46b04a', '#2b7f35'], ['#68cc5a', '#3d9a42'], ['#2a7a3a', '#16502a']], cc, k;
  for (i = 0; i < n; i++) {
    x = r() * W; y = r() * 160; a = r() * PI2; len = 34 + r() * 30; w = 9 + r() * 8; cc = c[Math.floor(r() * 5)];
    for (o = -1; o <= 1; o++) {
      g.save(); g.translate(x, y + o * 160); g.rotate(a); leafShape(g, len, w); g.fillStyle = lg(g, 0, -w, 0, w, [[0, cc[0]], [1, cc[1]]]); g.fill();
      g.strokeStyle = 'rgba(10,50,25,.45)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(210,255,170,.4)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(2, 0); g.lineTo(len * .92, 0); g.stroke();
      g.strokeStyle = 'rgba(10,60,25,.25)'; g.lineWidth = .8; for (k = 1; k < 5; k++) { g.beginPath(); g.moveTo(len * k * .18, 0); g.lineTo(len * (k * .18 + .12), -w * .62 * (1 - k * .15)); g.moveTo(len * k * .18, 0); g.lineTo(len * (k * .18 + .12), w * .62 * (1 - k * .15)); g.stroke(); }
      g.restore();
    }
  }
}
function palm(g, x, base, h, lean, seed) {   // a shaded palm: a ringed trunk and a crown of veined fronds with a few coconuts
  var r = rnd(seed), tx = x + lean, ty = base - h, k, a, len, q, ring, t;
  g.beginPath(); g.moveTo(x - 5, base); g.quadraticCurveTo(x + lean * .2 - 4, base - h * .55, tx - 2.4, ty); g.lineTo(tx + 2.4, ty); g.quadraticCurveTo(x + lean * .2 + 5, base - h * .55, x + 5, base); g.closePath();
  g.fillStyle = lg(g, x - 6, 0, x + 6, 0, [[0, '#6a4220'], [.35, '#b8824a'], [.7, '#8a5a2c'], [1, '#4f3016']]); g.fill(); g.strokeStyle = '#33200f'; g.lineWidth = 1.4; g.stroke();
  g.strokeStyle = 'rgba(40,22,8,.4)'; g.lineWidth = 1; for (ring = 1; ring < 9; ring++) { t = ring / 9; g.beginPath(); g.arc(x + lean * t * t * .8, base - h * t, 5 - t * 2.4, 0.2, 2.9); g.stroke(); }   // trunk rings
  for (k = 0; k < 8; k++) {
    a = -Math.PI * (k / 7) * 1.02 - .06 + (r() - .5) * .22; len = 32 + r() * 14; g.save(); g.translate(tx, ty); g.rotate(a);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .5, -len * .38, len, len * .14 + 4); g.quadraticCurveTo(len * .55, -len * .1, 0, 3.6); g.closePath();
    g.fillStyle = lg(g, 0, -len * .4, 0, 6, [[0, '#7ddc5c'], [.5, '#3da64a'], [1, '#1f6a32']]); g.fill(); g.strokeStyle = '#17501f'; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = 'rgba(210,255,170,.55)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, 1); g.quadraticCurveTo(len * .5, -len * .26, len * .96, len * .1 + 3); g.stroke();
    g.strokeStyle = 'rgba(15,70,28,.5)'; g.lineWidth = .9; for (ring = 1; ring < 6; ring++) { t = ring / 6; g.beginPath(); g.moveTo(len * t, -len * .26 * (1 - Math.pow(2 * t - 1, 2)) * .7); g.lineTo(len * t + 3, len * .05 * t + 3 + 3 * t); g.stroke(); }
    g.restore();
  }
  [[-3, 5], [3, 6], [0, 9]].forEach(function (c) { circ(g, tx + c[0], ty + c[1], 3.6); fs(g, rg(g, tx + c[0] - 1, ty + c[1] - 1, .3, tx + c[0], ty + c[1], 4.2, [[0, '#b0763a'], [1, '#4a2a10']]), '#2b1808', 1); });
}
function hibiscus(g, x, y, s) { var k; g.save(); g.translate(x, y); g.scale(s, s); for (k = 0; k < 5; k++) { g.save(); g.rotate(k * 1.2566); ell(g, 0, -4.2, 3.2, 4.4); fs(g, lg(g, 0, -8, 0, 0, [[0, '#ff8aa8'], [1, '#e0245a']]), '#8a0f33', .8); g.restore(); } circ(g, 0, 0, 1.6); fs(g, '#ffe14d', '#a06a00', .6); g.restore(); }
function bush(g, x, y, s, flowers) { var k, r = rnd(Math.floor(x) + 7); for (k = 0; k < 7; k++) { g.save(); g.translate(x + (k - 3) * 5 * s, y); g.rotate(-1.57 + (k - 3) * .32); leafShape(g, (16 + r() * 8) * s, 4.4 * s); g.fillStyle = lg(g, 0, -5, 0, 5, [[0, k % 2 ? '#5fc454' : '#3da64a'], [1, '#1f6a32']]); g.fill(); g.strokeStyle = '#17501f'; g.lineWidth = .9; g.stroke(); g.restore(); } if (flowers) { hibiscus(g, x - 6 * s, y - 12 * s, .9 * s); hibiscus(g, x + 7 * s, y - 16 * s, .75 * s); } }
function tiki(g, x, y) {   // a bamboo torch (the flame, its glow and the embers are drawn live, see mgFlame in game.js)
  rr(g, x - 4.5, y - 60, 9, 62, 3); fs(g, lg(g, x - 4.5, 0, x + 4.5, 0, [[0, '#9a6a2a'], [.4, '#f0cf84'], [1, '#7a4e1c']]), '#3f2812', 1.3);
  g.strokeStyle = 'rgba(60,34,10,.6)'; g.lineWidth = 1.3; [-44, -28, -12].forEach(function (d) { g.beginPath(); g.moveTo(x - 4.5, y + d); g.lineTo(x + 4.5, y + d); g.stroke(); });
  g.beginPath(); g.moveTo(x - 8, y - 62); g.lineTo(x + 8, y - 62); g.lineTo(x + 5, y - 56); g.lineTo(x - 5, y - 56); g.closePath(); fs(g, '#5a3a1a', '#2b1808', 1.2);
}
function wood(g, x, y, w, h, c0, c1, rad) {   // a plank with a frame, grain and a lit top edge
  rr(g, x, y, w, h, rad); fs(g, lg(g, 0, y, 0, y + h, [[0, c0], [1, c1]]), '#3f2812', 2.6);
  g.save(); g.clip(); g.strokeStyle = 'rgba(60,32,10,.16)'; g.lineWidth = 1; var r = rnd(Math.floor(x + y * 3)), i, gy;
  for (i = 0; i < 16; i++) { gy = y + 3 + r() * (h - 6); g.beginPath(); g.moveTo(x + r() * w * .5, gy); g.bezierCurveTo(x + w * .3, gy + (r() - .5) * 3, x + w * .6, gy + (r() - .5) * 3, x + w * (.6 + r() * .4), gy + (r() - .5) * 2); g.stroke(); }
  g.fillStyle = 'rgba(255,240,200,.35)'; g.fillRect(x + 2, y + 1.6, w - 4, 2); g.fillStyle = 'rgba(40,20,5,.25)'; g.fillRect(x + 2, y + h - 3.6, w - 4, 2); g.restore();
}
var SHORE = [   // the beach is painted in small steps (the warm-up runs one per frame, so no single step is a visible stall)
  function (g) { JTL = mk(W, 160); var q = JTL.g; q.fillStyle = '#17502a'; q.fillRect(0, 0, W, 160); var r = rnd(44), i; SHP = []; for (i = 0; i < 7; i++) SHP.push([22 + i * 52 + r() * 14, 80 + r() * 36, (r() - .5) * 18]); jungleLeaves(26, 12); },
  function (g) { jungleLeaves(30, 13); },
  function (g) {   // flowers, vines and spots of sunlight on the jungle wall, then the wall itself at the top of the beach picture
    var q = JTL.g, r = rnd(15), i, x, y, o; for (i = 0; i < 9; i++) { x = r() * W; y = r() * 160; for (o = -1; o <= 1; o++) hibiscus(q, x, y + o * 160, .9 + r() * .4); }
    q.fillStyle = 'rgba(255,255,200,.1)'; for (i = 0; i < 12; i++) { x = r() * W; y = r() * 160; for (o = -1; o <= 1; o++) { q.beginPath(); q.ellipse(x, y + o * 160, 10 + r() * 14, 6 + r() * 8, r(), 0, PI2); q.fill(); } }
    g.drawImage(JTL.c, 0, 0, W, 160); g.drawImage(JTL.c, 0, 160, W, 160);
    var sh = lg(g, 0, 0, 0, 230, [[0, 'rgba(0,30,15,0)'], [.55, 'rgba(10,50,20,.12)'], [1, 'rgba(30,90,40,.45)']]); g.fillStyle = sh; g.fillRect(0, 0, W, 230);
  },
  function (g) { var i; for (i = 0; i < 4; i++) palm(g, SHP[i][0], 196, SHP[i][1], SHP[i][2], 30 + i); },
  function (g) { var i; for (i = 4; i < 7; i++) palm(g, SHP[i][0], 196, SHP[i][1], SHP[i][2], 30 + i); bush(g, 34, 212, 1, true); bush(g, 326, 212, 1, true); bush(g, 110, 206, .8, false); bush(g, 252, 208, .85, true); },
  function (g) {   // the sand, with a wet edge, shallows and foam
    var i, x, y, r = rnd(61), q;
    g.beginPath(); g.moveTo(0, 206); for (x = 0; x <= W; x += 12) g.lineTo(x, 204 + Math.sin(x * .03) * 5 + Math.sin(x * .09 + 1) * 2); g.lineTo(W, SHH); g.lineTo(0, SHH); g.closePath();
    g.fillStyle = lg(g, 0, 200, 0, 290, [[0, '#f6e6b0'], [.45, '#f9edc2'], [1, '#e9c987']]); g.fill();
    g.strokeStyle = 'rgba(120,80,20,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 206); for (x = 0; x <= W; x += 12) g.lineTo(x, 204 + Math.sin(x * .03) * 5 + Math.sin(x * .09 + 1) * 2); g.stroke();
    g.fillStyle = 'rgba(150,100,40,.28)'; for (i = 0; i < 90; i++) { x = r() * W; y = 214 + r() * 70; g.fillRect(x, y, 1.4, 1.4); }
    g.fillStyle = 'rgba(255,255,255,.45)'; for (i = 0; i < 40; i++) { x = r() * W; y = 214 + r() * 70; g.fillRect(x, y, 1.6, 1.2); }
    g.beginPath(); g.moveTo(0, 268); for (x = 0; x <= W; x += 10) g.lineTo(x, 268 + Math.sin(x * .05) * 4); g.lineTo(W, SHH); g.lineTo(0, SHH); g.closePath(); g.fillStyle = lg(g, 0, 266, 0, SHH, [[0, 'rgba(150,100,40,.0)'], [.3, 'rgba(150,100,40,.4)'], [1, 'rgba(110,200,190,.55)']]); g.fill();   // wet sand running into the shallows
    [['rgba(255,255,255,.9)', 3.6, 282], ['rgba(255,255,255,.6)', 2.4, 289], ['rgba(190,255,245,.7)', 1.8, 295]].forEach(function (f, n) { g.strokeStyle = f[0]; g.lineWidth = f[1]; g.lineCap = 'round'; g.beginPath(); for (x = 0; x <= W; x += 6) { y = f[2] + Math.sin(x * .07 + n * 1.7) * 3 + Math.sin(x * .19 + n) * 1.2; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); });   // foam lines
    q = lg(g, 0, 288, 0, SHH, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]); g.globalCompositeOperation = 'destination-out'; g.fillStyle = q; g.fillRect(0, 288, W, SHH - 288); g.globalCompositeOperation = 'source-over';   // the bottom fades out so the beach melts into the sea
  },
  function (g) {   // Prince Chimp and the gate
    tiki(g, 17, 252); tiki(g, 343, 252);
    g.save(); g.translate(180, 98); g.scale(1.18, 1.18); chimpDraw(g, 0); g.restore();
    var q;
    [[143, 'L'], [203, 'R']].forEach(function (p) { rr(g, p[0], 150, 14, 90, 4); fs(g, lg(g, p[0], 0, p[0] + 14, 0, [[0, '#6a3e1c'], [.4, '#d49a58'], [1, '#6a3e1c']]), '#3f2812', 1.8); g.save(); g.clip(); g.strokeStyle = 'rgba(255,225,90,.8)'; g.lineWidth = 2.6; for (var k = -2; k < 9; k++) { g.beginPath(); g.moveTo(p[0] - 2, 150 + k * 12); g.lineTo(p[0] + 16, 160 + k * 12); g.stroke(); } g.restore(); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(p[0] + 2, 152, 2.4, 84); });
    rr(g, 132, 140, 96, 22, 7); fs(g, lg(g, 0, 140, 0, 162, [[0, '#d98cff'], [.5, '#a24ad8'], [1, '#6a2a98']]), '#3b1a5c', 2); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(138, 143, 84, 2.4);
    g.strokeStyle = '#ffd93b'; g.lineWidth = 2; g.beginPath(); g.moveTo(136, 157); g.lineTo(224, 157); g.stroke(); [140, 160, 180, 200, 220].forEach(function (x) { circ(g, x, 150, 2.2); fs(g, rg(g, x - .6, 149, .3, x, 150, 2.6, [[0, '#fff6b0'], [1, '#e0a010']]), '#8a5a00', .7); });   // gold studs
    [['#ff6b81', 140], ['#ffd93b', 160], ['#7be07b', 180], ['#7ad8ff', 200], ['#ff9f2a', 220]].forEach(function (f, n) { g.beginPath(); g.moveTo(f[1] - 7, 162); g.lineTo(f[1] + 7, 162); g.lineTo(f[1], 176 + (n % 2) * 4); g.closePath(); fs(g, f[0], '#3a2a4d', 1.2); });   // a little bunting along the lintel
  },
  function (g) {   // the big signboard on two posts, with rope, brackets, vines and flowers
    [60, 300].forEach(function (x) { rr(g, x - 6, 252, 12, 26, 3); fs(g, lg(g, x - 6, 0, x + 6, 0, [[0, '#6a3e1c'], [.4, '#c48a4a'], [1, '#5a3418']]), '#3f2812', 1.6); g.strokeStyle = '#e8d49a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, 256); g.lineTo(x + 6, 262); g.moveTo(x - 6, 262); g.lineTo(x + 6, 268); g.stroke(); });
    wood(g, 22, 214, 316, 46, '#d29655', '#8a5428', 9);
    g.strokeStyle = 'rgba(50,26,8,.4)'; g.lineWidth = 1.3; [229.5, 244.5].forEach(function (y) { g.beginPath(); g.moveTo(24, y); g.lineTo(336, y); g.stroke(); });   // plank seams
    [[26, 218], [334, 218], [26, 256], [334, 256]].forEach(function (p) { circ(g, p[0], p[1], 3); fs(g, rg(g, p[0] - .8, p[1] - .8, .3, p[0], p[1], 3.4, [[0, '#fff6c0'], [1, '#c08a10']]), '#6a4400', .8); });
    [[34, 214, 1], [326, 214, -1]].forEach(function (v) { g.strokeStyle = '#2f8a3a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(v[0], v[1]); g.bezierCurveTo(v[0] + v[2] * 6, v[1] - 14, v[0] + v[2] * 22, v[1] - 8, v[0] + v[2] * 30, v[1] - 20); g.stroke(); [[8, -8], [18, -10], [26, -16]].forEach(function (l) { g.save(); g.translate(v[0] + v[2] * l[0], v[1] + l[1]); g.rotate(-.6 * v[2]); leafShape(g, 9, 3.4); fs(g, '#4fbf4a', '#17501f', .8); g.restore(); }); });
    hibiscus(g, 24, 210, 1.1); hibiscus(g, 336, 210, 1.1);
  },
  function (g) {   // the lettering, and the small sign that hangs from the gate
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    var t1 = 'Prince Chimp\u2019s Tropical Jungle Island', sz = 17; g.font = '800 17px ' + FONT; sz = Math.min(17, 17 * 292 / g.measureText(t1).width); g.font = '800 ' + sz.toFixed(1) + 'px ' + FONT;
    g.strokeStyle = '#3a2a4d'; g.lineWidth = 4; g.strokeText(t1, 180, 238); g.fillStyle = lg(g, 0, 229, 0, 247, [[0, '#fffbe0'], [.5, '#ffe9a0'], [1, '#ffc94a']]); g.fillText(t1, 180, 238);
    g.strokeStyle = '#6a4220'; g.lineWidth = 1.6; [[152, 160, 154, 170], [208, 160, 206, 170]].forEach(function (c) { g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(c[2], c[3]); g.stroke(); });
    wood(g, 124, 170, 112, 26, '#e8b878', '#b07a3a', 8);
    [[130, 176], [230, 176]].forEach(function (p) { circ(g, p[0], p[1], 2); fs(g, '#fff0a0', '#6a4400', .7); });
    g.font = '800 13px ' + FONT; g.strokeStyle = '#3a2a4d'; g.lineWidth = 3.4; g.strokeText('AKA Rhode Island', 180, 184); g.fillStyle = '#ffd93b'; g.fillText('AKA Rhode Island', 180, 184);
    g.textAlign = 'start'; g.textBaseline = 'alphabetic';
  },
  function (g) {   // torches, shells and a starfish on the sand
    var i;
    g.save(); g.translate(98, 276); g.rotate(.3); g.beginPath(); for (i = 0; i < 10; i++) { var rr0 = i % 2 ? 4 : 10, a = i / 10 * PI2 - 1.57; g.lineTo(Math.cos(a) * rr0, Math.sin(a) * rr0); } g.closePath(); fs(g, lg(g, -8, -8, 8, 8, [[0, '#ffb067'], [1, '#e0602a']]), '#8a2e10', 1.1); g.fillStyle = 'rgba(255,230,180,.85)'; [[0, -5], [4, -1], [-4, -1], [2.6, 4], [-2.6, 4]].forEach(function (d) { g.fillRect(d[0] - .6, d[1] - .6, 1.4, 1.4); }); g.restore();
    g.save(); g.translate(262, 270); g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(-12, -2, -8, -9); g.quadraticCurveTo(0, -13, 8, -9); g.quadraticCurveTo(12, -2, 0, 6); g.closePath(); fs(g, lg(g, -10, -10, 10, 6, [[0, '#ffe0e8'], [1, '#e89aa8']]), '#9a5a6a', 1); g.strokeStyle = 'rgba(150,80,95,.6)'; g.lineWidth = .9; [-5, 0, 5].forEach(function (d) { g.beginPath(); g.moveTo(0, 6); g.lineTo(d * 1.1, -9); g.stroke(); }); g.restore();
    circ(g, 215, 280, 4.2); fs(g, rg(g, 214, 279, .3, 215, 280, 5, [[0, '#b0763a'], [1, '#4a2a10']]), '#2b1808', 1);
    g.fillStyle = 'rgba(150,100,40,.2)'; for (i = 0; i < 7; i++) { ell(g, 150 + i * 9 + (i % 2) * 3, 272 - i * 3.4, 2.6, 4.4, .3); g.fill(); }   // a trail of footprints
  }
];
var MG = {
  sub: function (a) { var R = a === 'r', d = R ? 61 : 0, P = R ? { top: [[0, '#ffc4bc'], [.3, '#f26a62'], [.75, '#cc3432'], [1, '#982228']], side: [[0, '#9a2a34'], [1, '#4c0f1c']], fin: [[0, '#f87a70'], [1, '#b42c30']], ink: '#42132e', fin2: '#5a1426', tw: [[0, '#b83440'], [1, '#521022']], tt: [[0, '#ffe0d8'], [.5, '#f47c76'], [1, '#c4302e']] } : { top: [[0, '#c0b6ff'], [.3, '#8576ea'], [.75, '#5a49c8'], [1, '#43379a']], side: [[0, '#3a3092'], [1, '#1b1550']], fin: [[0, '#6a5cd8'], [1, '#3a2f9c']], ink: '#1d1747', fin2: '#241c66', tw: [[0, '#4a3ca6'], [1, '#1f1758']], tt: [[0, '#d8d0ff'], [.5, '#9084ee'], [1, '#5a49c8']] }; return spr(184 + d, 60, function (g) {                                       // a Chimp Navy submarine seen from a little above: a glossy purple hull with a visible side, a tower standing on the deck, the captain chimp popping out of the hatch
    var i, a, x;
    ell(g, 94 + d / 2, 39, 90 + d / 2, 24); fs(g, 'rgba(10,50,100,.3)', null); ell(g, 92 + d / 2, 33, 90 + d / 2, 25); fs(g, 'rgba(255,255,255,.5)', null); ell(g, 92 + d / 2, 33, 84 + d / 2, 21); fs(g, 'rgba(255,255,255,.35)', null);   // shadow and foam
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, 24); g.quadraticCurveTo(2, 33, 10, 42); g.stroke();   // bow wave
    [[152 + d, 3], [152 + d, 45]].forEach(function (p) { rr(g, p[0], p[1] + 3, 20, 9, 4.5); fs(g, P.fin2, P.ink, 1.6); rr(g, p[0], p[1], 20, 9, 4.5); fs(g, lg(g, 0, p[1], 0, p[1] + 9, P.fin), P.ink, 2); });   // tail fins
    rr(g, 8, 19, 164 + d, 34, 17); fs(g, lg(g, 0, 19, 0, 53, P.side), P.ink, 2.6);   // the side of the hull
    rr(g, 8, 11, 164 + d, 34, 17); fs(g, lg(g, 0, 11, 0, 45, P.top), P.ink, 2.8);   // the top of the hull
    rr(g, 28, 15, 112 + d, 4.6, 2.3); fs(g, 'rgba(255,255,255,.6)', null);   // shine
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(24, 44.4); g.lineTo(156 + d, 44.4); g.stroke();   // lit lower edge
    rr(g, 22, 26.6, 140 + d, 6.4, 3.2); fs(g, lg(g, 0, 26, 0, 33, [[0, '#ffe680'], [1, '#e0a010']]), '#9a6a00', 1.1);   // yellow stripe
    for (i = 0; i < 9 + (R ? 4 : 0); i++) { x = 34 + i * 14; if (Math.abs(x - 92 - d / 2) < 13) continue; circ(g, x, 21.6, 1.6); fs(g, '#e8e4ff', P.ink, .7); circ(g, x, 39.4, 1.6); fs(g, '#e8e4ff', P.ink, .7); }
    (R ? [[44, 29.8], [76, 29.8], [140 + d - 32, 29.8], [140 + d, 29.8]] : [[44, 29.8], [140, 29.8]]).forEach(function (p) { circ(g, p[0], p[1], 6); fs(g, '#cfd8ea', P.ink, 1.6); circ(g, p[0], p[1], 3.8); fs(g, rg(g, p[0] - 1, p[1] - 1, .3, p[0], p[1], 4.2, [[0, '#b8ecff'], [1, '#2a5a9c']]), P.ink, .8); });   // portholes
    circ(g, 16, 29, 3); fs(g, rg(g, 15, 28, .3, 16, 29, 3.4, [[0, '#ffb0b0'], [1, '#d01818']]), '#7a1010', 1);   // bow light
    g.save(); g.translate(d / 2, 0);
    ell(g, 92, 38, 27, 19); fs(g, lg(g, 0, 20, 0, 58, P.tw), P.ink, 2.2);   // the tower's side
    ell(g, 92, 28, 27, 19); fs(g, rg(g, 84, 18, 1, 92, 28, 30, P.tt), P.ink, 2.4);   // the tower's top
    ell(g, 92, 28, 19, 13.8); fs(g, lg(g, 80, 16, 104, 40, [[0, '#f2f6ff'], [1, '#98a6c4']]), '#1d1747', 1.8); ell(g, 92, 28, 15, 10.6); fs(g, rg(g, 94, 31, 1, 92, 28, 15, [[0, '#46327a'], [1, '#1c1244']]), '#1d1747', 1.4);   // the hatch
    g.restore(); rr(g, 14, 12.5, 152 + d, 13, 6.5); fs(g, lg(g, 0, 12, 0, 26, [[0, 'rgba(255,255,255,.42)'], [1, 'rgba(255,255,255,0)']]), null); g.save(); g.translate(d / 2, 0); ell(g, 83, 19, 10, 4.4, -.45); fs(g, 'rgba(255,255,255,.6)', null); g.restore();   // sheen on the hull and the tower
    g.save(); g.translate(92 + d / 2, 27); monkeyHead(g, .8, 'cap'); g.restore();
    g.save(); g.translate(d / 2, 0); g.strokeStyle = '#6b7487'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(126, 29); g.lineTo(134, 20); g.stroke(); circ(g, 126, 29, 4); fs(g, rg(g, 125, 28, .3, 126, 29, 4.4, [[0, '#ffffff'], [1, '#9aa8c4']]), '#1d1747', 1.4); circ(g, 135, 19, 3.8); fs(g, rg(g, 134, 18, .3, 135, 19, 4, [[0, '#fff6c0'], [1, '#f0b020']]), P.ink, 1.3); g.restore();   // periscope
    g.save(); g.translate(d, 0);
    for (a = 0; a < 3; a++) { g.save(); g.translate(177, 29); g.rotate(a * 2.094 + .4); ell(g, 6, 0, 6.5, 2.8); fs(g, lg(g, 0, -3, 0, 3, [[0, '#ffffff'], [1, '#b4c0d8']]), '#1d1747', 1.2); g.restore(); } circ(g, 177, 29, 2.4); fs(g, '#ffd23a', '#1d1747', 1);   // propeller
    ell(g, 181, 29, 3, 8); fs(g, 'rgba(255,255,255,.7)', null); g.restore();
  }); },
  barrels: function (n) { return spr(n * 36 + 4, 44, function (g) { drawBarrels(g, n, false); }); },       // barrels in a row, chimps and all, tied with a short rope
  wafer: function () { return waferPic(); },                                                                      // a thrown vanilla wafer
  barrelsV: function (n) { return spr(44, n * 36 + 4, function (g) { drawBarrels(g, n, true); }); },      // the same barrels in a column
  gull: function (f) { if (f > 3) return spr(72, 60, function (g) {                        // the red gull (f = 4..7): the same bird in cherry red, with a fiercer brow
    var w = mgs('gull', f - 4), t = mk(72, 60);
    t.g.drawImage(w.c, 0, 0, 72, 60); t.g.globalCompositeOperation = 'multiply'; t.g.fillStyle = lg(t.g, 0, 0, 0, 60, [[0, '#ff4a40'], [1, '#e02a3a']]); t.g.fillRect(0, 0, 72, 60); t.g.globalCompositeOperation = 'destination-in'; t.g.drawImage(w.c, 0, 0, 72, 60);
    g.drawImage(t.c, 0, 0, 72, 60);
    g.fillStyle = 'rgba(255,200,190,.55)'; ell(g, 33, 22, 2, 7, .1); g.fill();
    circ(g, 36, 45, 7.6); fs(g, rg(g, 33, 41.5, 1, 36, 45, 9, [[0, '#ff8a80'], [.6, '#ee4a48'], [1, '#a82430']]), '#5a1426', 1.6);
    g.beginPath(); g.moveTo(32.5, 50); g.lineTo(36, 58.6); g.lineTo(39.5, 50); g.closePath(); fs(g, lg(g, 32, 0, 40, 0, [[0, '#ffd23a'], [1, '#f08a14']]), '#8a4a10', 1.2); g.fillStyle = '#7a0f1a'; g.beginPath(); g.arc(36, 57, 1.2, 0, 7); g.fill();
    [-3.4, 3.4].forEach(function (x) { circ(g, 36 + x, 44, 2.6); fs(g, '#ffffff', '#5a1426', .8); circ(g, 36 + x - x * .12, 44.9, 1.45); g.fillStyle = '#1f130c'; g.fill(); circ(g, 36 + x + .5, 44.2, .5); g.fillStyle = '#fff'; g.fill(); });
    g.strokeStyle = '#2b0a14'; g.lineWidth = 2.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(29.6, 38.6); g.lineTo(35, 42.4); g.moveTo(42.4, 38.6); g.lineTo(37, 42.4); g.stroke();
  }); return spr(72, 60, function (g) {                                       // a cross seagull seen from above, flying down the screen; f = 0..3 is the wing beat. Shaded like a toy: rounded body and head, layered feathers, dark wing tips
    var yt = [6, 20, 34, 20][f], i, s, k;
    g.beginPath(); g.moveTo(30, 16); g.lineTo(26, 3); g.lineTo(31.5, 7); g.lineTo(36, 0); g.lineTo(40.5, 7); g.lineTo(46, 3); g.lineTo(42, 16); g.closePath(); fs(g, lg(g, 0, 0, 0, 16, [[0, '#7e8aa4'], [1, '#e8edf5']]), '#46506a', 1.4);   // the tail fan
    g.strokeStyle = 'rgba(70,85,120,.55)'; g.lineWidth = .9; [31.5, 36, 40.5].forEach(function (x) { g.beginPath(); g.moveTo(x, 7); g.lineTo(x, 15); g.stroke(); });
    for (s = -1; s <= 1; s += 2) {
      g.beginPath(); g.moveTo(36 + s * 5, 24); g.quadraticCurveTo(36 + s * 20, yt - 8, 36 + s * 33, yt); g.quadraticCurveTo(36 + s * 24, yt + 14, 36 + s * 5, 38); g.closePath();
      g.save(); g.clip(); g.fillStyle = lg(g, 36, 0, 36 + s * 33, 0, [[0, '#ffffff'], [.55, '#e0e7f2'], [1, '#aeb9d0']]); g.fillRect(0, 0, 72, 60);
      g.fillStyle = 'rgba(60,75,115,.3)'; g.beginPath(); g.moveTo(36 + s * 5, 38); g.quadraticCurveTo(36 + s * 24, yt + 14, 36 + s * 33, yt); g.quadraticCurveTo(36 + s * 26, yt + 6, 36 + s * 5, 30); g.closePath(); g.fill();   // the shaded under-edge
      g.fillStyle = lg(g, 36 + s * 22, 0, 36 + s * 33, 0, [[0, 'rgba(48,58,86,0)'], [.5, 'rgba(48,58,86,.75)'], [1, 'rgba(32,40,66,.95)']]); g.fillRect(0, 0, 72, 60);   // dark wing tip
      g.strokeStyle = 'rgba(60,75,115,.5)'; g.lineWidth = 1; for (k = 0; k < 4; k++) { g.beginPath(); g.moveTo(36 + s * 11, 27 + k * 2.6 + (yt - 20) * .12); g.lineTo(36 + s * 32, yt + k * 3.2 - 1.5); g.stroke(); }   // feathers
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(36 + s * 6, 25); g.quadraticCurveTo(36 + s * 18, yt - 4, 36 + s * 26, yt - .5); g.quadraticCurveTo(36 + s * 17, yt + 1, 36 + s * 6, 28); g.closePath(); g.fill();   // a bright top edge
      g.restore();
      g.beginPath(); g.moveTo(36 + s * 5, 24); g.quadraticCurveTo(36 + s * 20, yt - 8, 36 + s * 33, yt); g.quadraticCurveTo(36 + s * 24, yt + 14, 36 + s * 5, 38); g.closePath(); g.strokeStyle = '#46506a'; g.lineWidth = 1.6; g.stroke();
    }
    g.beginPath(); g.moveTo(32, 12); g.lineTo(36, 2); g.lineTo(40, 12); g.closePath(); fs(g, '#aab4c6', '#46506a', 1.2);
    ell(g, 36, 28, 8.4, 15.4); fs(g, rg(g, 32.5, 21, 1, 36, 28, 17, [[0, '#ffffff'], [.55, '#e8edf5'], [1, '#aab6cc']]), '#46506a', 1.6);   // body
    g.fillStyle = 'rgba(255,255,255,.9)'; ell(g, 33, 22, 2, 7, .1); g.fill();
    circ(g, 36, 45, 7.6); fs(g, rg(g, 33, 41.5, 1, 36, 45, 9, [[0, '#ffffff'], [.6, '#eef2f8'], [1, '#b2bdd2']]), '#46506a', 1.6);   // head
    g.beginPath(); g.moveTo(32.5, 50); g.lineTo(36, 58.6); g.lineTo(39.5, 50); g.closePath(); fs(g, lg(g, 32, 0, 40, 0, [[0, '#ffc548'], [1, '#e8861c']]), '#8a4a10', 1.2); g.fillStyle = '#e03a2a'; g.beginPath(); g.arc(36, 57, 1.2, 0, 7); g.fill();   // beak with its red spot
    [-3.4, 3.4].forEach(function (x) { circ(g, 36 + x, 44, 2.5); fs(g, '#ffffff', '#46506a', .8); circ(g, 36 + x, 44.7, 1.35); g.fillStyle = '#1f130c'; g.fill(); circ(g, 36 + x + .5, 44, .5); g.fillStyle = '#fff'; g.fill(); });
    g.strokeStyle = '#2b1a12'; g.lineWidth = 1.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(30.6, 39.6); g.lineTo(35, 42); g.moveTo(41.4, 39.6); g.lineTo(37, 42); g.stroke();   // a cross brow
  }); },
  gullShadow: function (f) { return spr(72, 60, function (g) {                                // the gull's own shape as a soft dark patch on the water (blurred by stacking offset copies)
    var s = mgs('gull', f % 4), t = mk(72, 60), dx, dy; t.g.drawImage(s.c, 0, 0, 72, 60); t.g.globalCompositeOperation = 'source-in'; t.g.fillStyle = 'rgb(0,28,60)'; t.g.fillRect(0, 0, 72, 60);
    g.globalAlpha = .045; for (dx = -2; dx <= 2; dx++) for (dy = -2; dy <= 2; dy++) g.drawImage(t.c, dx * .9, dy * .9, 72, 60); g.globalAlpha = 1;
  }); },
  whirl: function () { return spr(56, 56, function (g) {                                      // the funnel itself: lit from the top left, so the far wall is dark and the near wall bright; it does not spin (the foam arms do)
    circ(g, 28, 28, 27); fs(g, rg(g, 28, 28, 17, 28, 28, 27.5, [[0, 'rgba(170,235,250,0)'], [.6, 'rgba(170,235,250,.55)'], [1, 'rgba(255,255,255,.9)']]), null);   // foam lip
    circ(g, 28, 28, 23.5); fs(g, rg(g, 20, 19, 2, 28, 28, 26, [[0, '#04284a'], [.5, '#0b4c86'], [1, '#43b0e0']]), 'rgba(255,255,255,.75)', 1.8);   // the bowl
    for (var r = 18; r > 6; r -= 4.2) { g.strokeStyle = 'rgba(0,25,60,.28)'; g.lineWidth = 1.6; g.beginPath(); g.arc(29 + (18 - r) * .12, 29 + (18 - r) * .12, r, 0, 7); g.stroke(); }   // depth rings
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.beginPath(); g.arc(28, 28, 20.5, -.1, 1.7); g.stroke();   // bright near wall
    g.strokeStyle = 'rgba(0,15,40,.4)'; g.lineWidth = 3; g.beginPath(); g.arc(28, 28, 20.5, 3.1, 4.9); g.stroke();   // dark far wall
    circ(g, 29.5, 29.5, 7.4); fs(g, rg(g, 27, 27, 1, 29.5, 29.5, 8.4, [[0, '#010d1c'], [1, '#08355f']]), 'rgba(160,220,255,.5)', 1);   // the drain
  }); },
  whirlArms: function () { return spr(56, 56, function (g) {                                   // the spiral foam arms (these are what spin)
    var a, t, r, arm, x, y, x0, y0;
    g.lineCap = 'round';
    for (arm = 0; arm < 3; arm++) {
      x0 = y0 = null;
      for (t = 0; t < 8.6; t += .3) {
        a = t + arm * 2.094; r = 5 + t * 2.1; x = 28 + Math.cos(a) * r; y = 28 + Math.sin(a) * r;
        if (x0 !== null) { g.strokeStyle = 'rgba(20,70,120,.35)'; g.lineWidth = 1.4 + t * .24; g.beginPath(); g.moveTo(x0 + .8, y0 + .9); g.lineTo(x + .8, y + .9); g.stroke(); g.strokeStyle = 'rgba(255,255,255,' + (0.4 + t * .05).toFixed(2) + ')'; g.lineWidth = .9 + t * .22; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x, y); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = .6; g.beginPath(); g.moveTo(x0 - .6, y0 - .7); g.lineTo(x - .6, y - .7); g.stroke(); }
        x0 = x; y0 = y;
      }
    }
  }); },
  bubble: function () { return spr(48, 48, function (g) {   // a soap bubble with a friend in it: a thin rainbow skin, a bright window shine and a little sparkle
    var q;
    circ(g, 24, 24, 21.5); fs(g, rg(g, 20, 19, 3, 24, 24, 22, [[0, 'rgba(235,252,255,.22)'], [.7, 'rgba(190,235,255,.3)'], [.9, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,.8)']]), null);
    friend(g, 24, 26, 0, .68, 0);
    circ(g, 24, 24, 21.5); fs(g, 'rgba(210,245,255,.16)', null);
    g.lineWidth = 1.8; g.strokeStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(24, 24, 21.2, 0, PI2); g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,120,190,.55)'; g.beginPath(); g.arc(24, 24, 19.6, .5, 1.5); g.stroke(); g.strokeStyle = 'rgba(120,200,255,.6)'; g.beginPath(); g.arc(24, 24, 19.6, 3.7, 4.6); g.stroke(); g.strokeStyle = 'rgba(255,240,130,.55)'; g.beginPath(); g.arc(24, 24, 19.6, 1.7, 2.6); g.stroke();   // the rainbow skin
    g.fillStyle = 'rgba(255,255,255,.95)'; ell(g, 14.5, 13.5, 5.2, 2.7, -.75); g.fill(); circ(g, 33.5, 34, 1.6); g.fill(); circ(g, 30, 36.5, .9); g.fill();
  }); },
  wake: function () { return spr(72, 130, function (g) {   // the foam trail behind a swimmer: two spreading lines of foam and a bubbly middle, fading away down the page (the nose is at the top)
    var s, k, y, x, r = rnd(5);
    for (s = -1; s <= 1; s += 2) {
      for (k = 0; k < 2; k++) {
        g.beginPath(); g.moveTo(36 + s * 3, 4); g.quadraticCurveTo(36 + s * 12, 36, 36 + s * 30, 124);
        g.strokeStyle = k ? 'rgba(255,255,255,.75)' : 'rgba(190,240,255,.3)'; g.lineWidth = k ? 2.2 : 6; g.lineCap = 'round'; g.stroke();
      }
    }
    for (k = 0; k < 26; k++) { y = 6 + r() * 112; x = 36 + (r() - .5) * (6 + y * .38); circ(g, x, y, 1 + r() * 2.6 * (1 - y / 150)); fs(g, 'rgba(255,255,255,' + (.8 - y / 170).toFixed(2) + ')', null); }
    var q = g.createLinearGradient(0, 0, 0, 130); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(1, 'rgba(255,255,255,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = q; g.fillRect(0, 0, 72, 130); g.globalCompositeOperation = 'source-over';
  }); },
  ripple: function () { return spr(80, 48, function (g) { ell(g, 40, 24, 36, 20); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.4; g.stroke(); ell(g, 40, 24, 33, 17.6); g.strokeStyle = 'rgba(130,215,255,.5)'; g.lineWidth = 2.6; g.stroke(); }); },
  buoy: function () { return spr(56, 56, function (g) {   // a life ring seen from above, with a heart floating in the middle: touch it to win a heart back
    var i, c = 28;
    ell(g, c + 3, c + 5, 23, 21); fs(g, 'rgba(0,40,80,.25)', null);
    for (i = 0; i < 4; i++) { g.beginPath(); g.arc(c, c, 23, i * 1.5708, (i + 1) * 1.5708); g.arc(c, c, 12.5, (i + 1) * 1.5708, i * 1.5708, true); g.closePath(); fs(g, i % 2 ? '#ffffff' : '#ef3b4b', INK, 1.8); }
    g.beginPath(); g.arc(c, c, 23, 0, PI2); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke(); g.beginPath(); g.arc(c, c, 12.5, 0, PI2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, 16, 13, 6, 2.4, -.7); g.fill();
    g.save(); g.translate(c, c + 0.5); g.scale(.74, .74); g.translate(-12, -10.5); g.beginPath(); g.moveTo(12, 20); g.bezierCurveTo(-4, 9, 4, -2, 12, 5); g.bezierCurveTo(20, -2, 28, 9, 12, 20); g.closePath(); fs(g, lg(g, 0, 0, 0, 20, [[0, '#ff7a90'], [1, '#d9254a']]), '#7a0f26', 2); g.fillStyle = 'rgba(255,255,255,.6)'; ell(g, 7.5, 6.5, 2.6, 1.6, -.6); g.fill(); g.restore();
  }); },
  glow: function () { return spr(72, 72, function (g) { g.fillStyle = rg(g, 36, 36, 1, 36, 36, 36, [[0, 'rgba(255,214,120,.7)'], [.5, 'rgba(255,170,70,.28)'], [1, 'rgba(255,160,60,0)']]); g.fillRect(0, 0, 72, 72); }); },
  shadowSub: function () { return spr(200, 54, function (g) {   // a submarine seen far down in the water: only a dark shape (drawn faint, behind everything)
    g.fillStyle = '#06284f'; rr(g, 10, 14, 176, 28, 14); g.fill(); ell(g, 100, 22, 22, 15); g.fill(); rr(g, 94, 6, 12, 12, 4); g.fill(); rr(g, 176, 18, 20, 20, 6); g.fill();
    g.beginPath(); g.moveTo(10, 28); g.lineTo(2, 20); g.lineTo(2, 36); g.closePath(); g.fill(); rr(g, 54, 38, 22, 6, 3); g.fill(); rr(g, 134, 38, 22, 6, 3); g.fill();
    g.fillStyle = 'rgba(120,200,255,.35)'; [34, 60, 86, 128, 152].forEach(function (x) { circ(g, x, 28, 3); g.fill(); });
  }); },
  heart: function (full) { return spr(24, 22, function (g) { g.beginPath(); g.moveTo(12, 20); g.bezierCurveTo(-4, 9, 4, -2, 12, 5); g.bezierCurveTo(20, -2, 28, 9, 12, 20); g.closePath(); if (full) { fs(g, lg(g, 0, 0, 0, 20, [[0, '#ff7a90'], [1, '#d9254a']]), '#7a0f26', 1.8); g.fillStyle = 'rgba(255,255,255,.55)'; ell(g, 7.5, 6.5, 2.6, 1.6, -.6); g.fill(); } else fs(g, 'rgba(255,255,255,.35)', '#7a0f26', 1.8); }); },
  shore: function () { var s = mk(W, SHH); SHORE.forEach(function (p) { p(s.g); }); return s; }   // Prince Chimp's beach: the finish line of the mini game (built in three parts, see SHORE)
};
var MGC = {};
function mgs(k, a) { var key = k + (a === undefined ? '' : a); return MGC[key] || (MGC[key] = MG[k](a)); }
/* draw one mini game thing centred on (x, y) */
function mgdraw(g, k, x, y, a) { var s = mgs(k, a); putS(g, s.c, x - s.w / 2, y - s.h / 2); }
var MGW = null;
var MGQ = [], MGSH = null;
function mgwarm() { MGQ = [['sub'], ['barrels', 1], ['barrels', 2], ['barrels', 3], ['barrelsV', 2], ['barrelsV', 3], ['gull', 0], ['gull', 1], ['gull', 2], ['gull', 3], ['gull', 4], ['gull', 5], ['gull', 6], ['gull', 7], ['sub', 'r'], ['buoy'], ['glow'], ['shadowSub'], ['gullShadow', 0], ['gullShadow', 1], ['gullShadow', 2], ['gullShadow', 3], ['whirl'], ['whirlArms'], ['bubble'], ['wake'], ['ripple'], ['heart', true], ['heart', false], ['wafer']].map(function (a) { return function () { mgs(a[0], a[1]); }; }); MGQ.push(function () { if (!MGW) { MGW = mk(W, 320); waterTile(MGW.g, 320); } }); [0, 1, 2, 3, 4].forEach(function (n) { MGQ.push(function () { if (MGCP === n) mgCausticPart(MGCP++); }); }); SHORE.forEach(function (st, n) { MGQ.push(function () { if (MGC.shore) return; if (n === 0) MGSH = mk(W, SHH); if (!MGSH) return; st(MGSH.g); if (n === SHORE.length - 1) { MGC.shore = MGSH; MGSH = null; } }); }); }
function mgdone() { while (MGQ.length) MGQ.shift()(); }
function mgfree() {   // after the water bonus game: let go of its big pictures (the sea tile, the sunlight net, the beach, the boats and gulls, about 8 to 12 MB); the next run builds them again at the first gate of the Silverware Drawer. The small shared ones (wafer, heart, bubble) stay.
  var k; MGW = null; MGCA = null; MGCP = 0; MGSH = null; MGQ = [];
  for (k in MGC) if (/^(shore|sub|barrels|barrelsV|gull|gullShadow|shadowSub)/.test(k)) delete MGC[k];
}
function mgcol(a, b, w) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * w) + ',' + Math.round(a[1] + (b[1] - a[1]) * w) + ',' + Math.round(a[2] + (b[2] - a[2]) * w) + ')'; }
/* The sea is light and teal at the start and the end of the level and deep blue in the middle. The color is a gradient up the screen (what is ahead is at the top), so a change is seen traveling toward Fancy instead of switching in steps. p0 = the level's progress at the bottom, p1 = at the top (0..1). */
function mgbell(p) { p = Math.max(0, Math.min(1, p)); var a = Math.min(1, p / 0.3), b = Math.max(0, Math.min(1, (p - 0.7) / 0.3)); return (a * a * (3 - 2 * a)) * (1 - b * b * (3 - 2 * b)); }
function mgsea(g, p0, p1) {
  var q = g.createLinearGradient(0, 0, 0, 640), w0 = mgbell(p0), w1 = mgbell(p1), TEAL = [92, 222, 206], TEAL2 = [58, 196, 200], BLUE = [24, 86, 176], BLUE2 = [10, 40, 116];
  q.addColorStop(0, mgcol(TEAL, BLUE, w1)); q.addColorStop(1, mgcol(TEAL2, BLUE2, w0)); g.fillStyle = q; g.fillRect(0, 0, W, 640);
}
var MGCA = null, MGCP = 0;
function mgCausticPart(n) {   // the net of bright light lines the sun throws through shallow water (a tile that repeats both ways), drawn in 5 slices so no single frame pays for all of it
  var g, r = rnd(77 + n), i, k, a, cx, cy, rad, pts, ox, oy, m = 6;
  if (!MGCA) MGCA = mk(W, 320); g = MGCA.g; g.lineJoin = 'round';
  for (i = 0; i < 19; i++) {
    cx = r() * W; cy = r() * 320; rad = 7 + r() * 10; pts = [];
    for (k = 0; k < m; k++) { a = k / m * PI2; pts.push([Math.cos(a) * rad * (.75 + r() * .5), Math.sin(a) * rad * (.75 + r() * .5) * .8]); }
    for (ox = -1; ox <= 1; ox++) for (oy = -1; oy <= 1; oy++) {
      g.beginPath(); g.moveTo((pts[0][0] + pts[m - 1][0]) / 2 + cx + ox * W, (pts[0][1] + pts[m - 1][1]) / 2 + cy + oy * 320);
      for (k = 0; k < m; k++) g.quadraticCurveTo(pts[k][0] + cx + ox * W, pts[k][1] + cy + oy * 320, (pts[k][0] + pts[(k + 1) % m][0]) / 2 + cx + ox * W, (pts[k][1] + pts[(k + 1) % m][1]) / 2 + cy + oy * 320);
      g.closePath(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = 'rgba(235,255,255,.46)'; g.lineWidth = 1.1; g.stroke();
    }
  }
}
function mgcaustic(g, off, p) { var a = .6 * (1 - .75 * mgbell(p)); if (a < .02) return; while (MGCP < 5) mgCausticPart(MGCP++); var y = ((off * .6 % 320) + 320) % 320 - 320; g.globalAlpha = a; for (; y < 640; y += 320) put(g, MGCA.c, 0, y); g.globalAlpha = 1; }
function mgglints(g, off, t, p) {   // sun sparkles twinkling on the water
  var a = .95 * (1 - .55 * mgbell(p)); if (a < .02) return; var i, y0 = ((off % 320) + 320) % 320, q, x, y, ph, v, rr0 = rnd(33);
  for (i = 0; i < 30; i++) {
    x = rr0() * W; y = rr0() * 320; ph = rr0() * 6.28; v = Math.sin(t * 2.6 + ph); if (v < .55) continue; v = (v - .55) / .45 * a;
    for (var o = 0; o < 3; o++) { var yy = (y + y0) % 320 + o * 320 - 320; if (yy < -10 || yy > 650) continue; g.fillStyle = 'rgba(255,255,255,' + v.toFixed(2) + ')'; g.fillRect(x - 1, yy - 1, 2.4, 2.4); g.fillRect(x - 4.5 * v - 1, yy - .4, 9 * v + 2.4, .9); g.fillRect(x - .4, yy - 4.5 * v - 1, .9, 9 * v + 2.4); }
  }
}
function mgwater(g, off) { if (!MGW) { MGW = mk(W, 320); waterTile(MGW.g, 320); } var y = ((off % 320) + 320) % 320 - 320; for (; y < 640; y += 320) put(g, MGW.c, 0, y); }

function init(k) { K = k; SCR = {}; BOSSP = {}; FXP = {}; HNDP = {}; ARN = null; ARS = null; MGCA = null; MGCP = 0; JTL = null; CRP = null; CHP = {}; BALP = {}; WAFP = null; PARTY = null; PARTYN = null; BALWN = false; BALW = false; SET = {}; PLAN = {}; QUEUE = []; MGQ = []; MGSH = null; TASKQ = []; MGC = {}; MGW = null; COIN = null; initBanana(); coinFrames(); [[.78, 0], [.42, 1], [.56, 2], [1.15, 2]].forEach(function (c) { TASKQ.push(function () { chimpPic(c[0], c[1]); }); }); }   // the chimp pictures for the Oops and stage cards are built early, a few ms per frame
function keep(list) { for (var key in SET) if (list.indexOf(+key) < 0) delete SET[key]; }

/* ---------- the launch track: a huge loop-de-loop, drawn live as vectors (so it is big and sharp, and costs no memory) ----------
   TK: loop centre cx (track units), cy, ribbon radius r, and rb, the radius Fancy himself rides at. x is where the track's origin sits on screen. */
var TK = { cx: 250, cy: 285, r: 108, rb: 80 };
/* track colors per stage look: [ribbon edge, ribbon, ribbon shine, pillar, pillar light, pillar shade, band or stripe, light 1, 2, 3, clamp] */
var TKP = [['#a8386a', '#ff7fb0', 'rgba(255,230,240,.8)', '#ff9ec4', '#ffffff', '#e0608f', '#ffffff', '#ff4d9d', '#ffe14d', '#6be0ff', '#b79cff'],
  ['#5a1a2e', '#c8283f', 'rgba(255,200,200,.7)', '#a02848', '#e87a90', '#6e1830', '#f0c040', '#ff4d6d', '#ffd93b', '#c77dff', '#6a3a8a'],
  ['#3a7a78', '#7fe0c8', 'rgba(255,255,255,.8)', '#a8ecd8', '#ffffff', '#5ab8a0', '#ff9ec4', '#ff7fb0', '#fff2a0', '#8fe0ff', '#ffd1e6'],
  ['#4a5270', '#aab4d0', 'rgba(255,255,255,.85)', '#8a93af', '#e6ebf6', '#596180', '#d0d8ee', '#59e0ff', '#ffffff', '#ffd93b', '#646c89'],
  ['#2f6a2a', '#6ccf5a', 'rgba(230,255,200,.8)', '#4fa34a', '#a8e89a', '#2f6a2a', '#ffd23f', '#ff7a5a', '#ffd93b', '#fff2a0', '#8a5a2a'],
  ['#3f2812', '#a8742e', 'rgba(255,230,160,.7)', '#7a4a22', '#c08a50', '#4a2c12', '#ffd93b', '#ff8a1f', '#ffd93b', '#8ae28a', '#a24ad8']];
/* A glossy chrome-and-enamel tube. The light is up and to the left, so each pass is the same path nudged toward the light (highlight) or away from it (shade):
   that gives a real round tube on the curves too, with no pictures to store. */
function ribbon(g, P) {
  g.lineCap = 'butt'; g.lineWidth = 39.5; g.strokeStyle = '#2b2140'; g.stroke();                                   // the dark outline
  g.lineWidth = 36; g.strokeStyle = P[0]; g.stroke();                                          // dark rim
  g.lineWidth = 31; g.strokeStyle = P[1]; g.stroke();                                                              // enamel body
  g.save(); g.translate(5.5, 6.5); g.lineWidth = 16; g.strokeStyle = 'rgba(20,10,40,.42)'; g.stroke(); g.restore();    // shade side
  g.save(); g.translate(-2.5, -3); g.lineWidth = 19; g.strokeStyle = 'rgba(255,255,255,.26)'; g.stroke(); g.restore();   // broad soft light
  g.save(); g.translate(-5, -6); g.lineWidth = 7; g.strokeStyle = P[2]; g.stroke(); g.restore();                   // bright band
  g.save(); g.translate(-6.2, -7.4); g.lineWidth = 3.2; g.strokeStyle = '#fff'; g.stroke(); g.restore();             // chrome glint
  g.save(); g.translate(7.4, 8.6); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke(); g.restore();   // bounce light on the shade rim
  g.save(); g.translate(8.4, 9.8); g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke(); g.restore();   // a crisp rim light on the lower right edge
}
var TKG = null;
function tkGlow(c, lv) {   // the glare around a lit bulb, drawn with light ADDED to the scene: colored, with a white-hot middle
  TKG = TKG || {}; var k = c + lv; if (TKG[k]) return TKG[k];
  var s = document.createElement('canvas'); s.width = s.height = 128; var g = s.getContext('2d', RF), hr = [0, 13, 19, 31][lv], q = g.createRadialGradient(64, 64, 2, 64, 64, hr * 2);
  q.addColorStop(0, '#ffffff'); q.addColorStop(lv === 3 ? .1 : .28, lv === 3 ? '#ffffff' : c); if (lv === 3) q.addColorStop(.3, c); q.addColorStop(.4, c); q.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = [0, .35, .7, 1][lv]; g.fillStyle = q; g.fillRect(0, 0, 128, 128);
  return TKG[k] = s;
}
var TKW = null, TKB2 = null;
function tkWash() {   // a soft dark blue-violet patch under a flare, so the white-hot light has a night to shine out of (a flare on a pale picture would just vanish)
  if (TKW) return TKW;
  var s = document.createElement('canvas'); s.width = s.height = 64; var g = s.getContext('2d', RF), q = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  q.addColorStop(0, 'rgba(30,26,100,.55)'); q.addColorStop(.45, 'rgba(40,60,160,.3)'); q.addColorStop(1, 'rgba(40,70,190,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64);
  return TKW = s;
}
function tkBurn(v) {   // a burning-magnesium flare: a blown-out white core, a bloom, and long thin sparks and jagged filaments shooting out (two pictures to flicker between)
  TKB2 = TKB2 || []; if (TKB2[v]) return TKB2[v];
  var s = document.createElement('canvas'); s.width = s.height = 192; var g = s.getContext('2d', RF), seed = v * 17 + 3, k, q, a, len, w, R = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.translate(96, 96); g.scale(2, 2);
  q = g.createRadialGradient(0, 0, 0, 0, 0, 46); q.addColorStop(0, 'rgba(255,255,255,.9)'); q.addColorStop(.1, 'rgba(225,240,255,.65)'); q.addColorStop(.3, 'rgba(110,170,255,.46)'); q.addColorStop(.65, 'rgba(60,110,230,.18)'); q.addColorStop(1, 'rgba(50,90,220,0)'); g.fillStyle = q; g.beginPath(); g.arc(0, 0, 46, 0, PI2); g.fill();
  for (k = 0; k < 18; k++) {   // thin tapering rays of different lengths
    a = k / 18 * PI2 + (R() - .5) * .35; len = k % 3 === 0 ? 40 + R() * 6 : k % 3 === 1 ? 24 + R() * 10 : 14 + R() * 8; w = .7 + R() * 1.4;
    g.save(); g.rotate(a); g.beginPath(); g.moveTo(3, 0); g.quadraticCurveTo(len * .35, -w, len, 0); g.quadraticCurveTo(len * .35, w, 3, 0);
    q = g.createLinearGradient(0, 0, len, 0); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(205,230,255,0)'); g.fillStyle = q; g.fill(); g.restore();
  }
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (k = 0; k < 6; k++) {   // jagged crackling filaments
    a = R() * PI2; len = 26 + R() * 18; g.save(); g.rotate(a); g.beginPath(); g.moveTo(5, 0);
    for (var j = 1; j <= 4; j++) g.lineTo(5 + j * len / 4, (R() - .5) * 7 * (j < 4 ? 1 : .5));
    g.lineWidth = .9; g.strokeStyle = 'rgba(232,244,255,.9)'; g.stroke(); g.lineWidth = .35; g.strokeStyle = '#ffffff'; g.stroke(); g.restore();
  }
  for (k = 0; k < 14; k++) { a = R() * PI2; len = 8 + R() * 38; g.beginPath(); g.arc(Math.cos(a) * len, Math.sin(a) * len, .6 + R() * 1.1, 0, PI2); g.fillStyle = 'rgba(245,250,255,' + (.95 - len / 55) + ')'; g.fill(); }
  q = g.createRadialGradient(0, 0, 0, 0, 0, 10); q.addColorStop(0, '#ffffff'); q.addColorStop(.55, '#ffffff'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.beginPath(); g.arc(0, 0, 10, 0, PI2); g.fill();
  return TKB2[v] = s;
}
function tkHash(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }
function tkTrail(g, at) {   // a few fading embers left behind a spark (at(d) gives the place d steps behind it)
  for (var d = 1; d < 7; d++) { var p = at(d), r = 2.4 - d * .3; g.fillStyle = 'rgba(200,225,255,' + (.75 - d * .1).toFixed(2) + ')'; g.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); }
}
function tkSparks(g, x, y, t, i) {   // hot sparks thrown off the head bulb (worked out from the clock, nothing to keep; one path for all of them)
  var k, u, a, d, m = i * 31, px, py;
  g.strokeStyle = 'rgba(235,245,255,.8)'; g.lineWidth = 1.2; g.beginPath();
  for (k = 0; k < 6; k++) {
    u = (t * 1.7 + tkHash(m + k) + k / 6) % 1; a = tkHash(m + k + 50) * PI2 + u * .6; d = 8 + u * 36 * (.6 + tkHash(m + k + 90) * .7);
    px = x + Math.cos(a) * d; py = y + Math.sin(a) * d - u * u * 10; g.moveTo(px - Math.cos(a) * 5 * (1 - u), py - Math.sin(a) * 5 * (1 - u)); g.lineTo(px, py);
  }
  g.stroke();
}
function tkSpark(g, x, y, sz, ft) {   // one small magnesium spark: a little dark-blue patch to shine out of, a blue-white glow and the flickering burst of rays
  var wz = sz * 1.7, gz = sz * .95, bs = sz * (.9 + .2 * ((ft * 7) % 4) / 3);
  g.drawImage(tkWash(), x - wz / 2, y - wz / 2, wz, wz);
  g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(tkGlow('#8cc0ff', 3), x - gz / 2, y - gz / 2, gz, gz); g.drawImage(tkBurn(ft & 3), x - bs / 2, y - bs / 2, bs, bs); g.restore();
}
function neonTube(g) {   // strokes the current path as a neon tube
  g.lineWidth = 17; g.strokeStyle = 'rgba(120,255,235,.22)'; g.stroke(); g.lineWidth = 12.5; g.strokeStyle = 'rgba(110,255,230,.4)'; g.stroke();
  g.lineWidth = 8.2; g.strokeStyle = '#5ff7e4'; g.stroke(); g.lineWidth = 5.4; g.strokeStyle = '#b6fff4'; g.stroke(); g.lineWidth = 2.2; g.strokeStyle = '#ffffff'; g.stroke();
}
function tkBolt(g, x, y) { circ(g, x, y, 2.4); fs(g, '#cfd6e6', '#2b2140', 1); g.fillStyle = '#fff'; g.fillRect(x - 1.2, y - 1.4, 1.4, 1.2); }
function tkPath(g, x, cx, ty) { g.beginPath(); g.moveTo(x - 400, ty); g.lineTo(cx + 70, ty); g.quadraticCurveTo(cx + 140, ty, cx + 200, ty - 85); }
var TKC = null;   // while the launcher just waits ('Tap to launch!') its solid parts never change: they are drawn once into one picture, and only the sparks and the twinkle are drawn live
function track(g, x, t, p, th, still) {
  if (still) {
    if (!TKC || TKC.x !== x || TKC.th !== th || TKC.K !== K) { var m = mk(W, GY + 10); trackUnder(m.g, x, 0, 0, th); TKC = { m: m, x: x, th: th, K: K }; }
    put(g, TKC.m.c, 0, 0);
  } else { TKC = null; trackUnder(g, x, t, p, th); }
  trackLive(g, x, t, th);
}
function trackUnder(g, x, t, p, th) {
  var P = TKP[th || 0] || TKP[0], cx = x + TK.cx, cy = TK.cy, r = TK.r, ty = cy + r, i, a, q;
  [-180, -60, 60, 180].forEach(function (d) {                                                                                   // round striped pillars with flanges and bolts
    var px0 = cx + d - 11; if (px0 > W + 30 || px0 < -50) return;
    g.fillStyle = 'rgba(30,20,60,.22)'; g.beginPath(); g.ellipse(px0 + 11, GY + 4, 24, 6, 0, 0, PI2); g.fill();                  // contact shadow
    g.fillStyle = P[3]; g.fillRect(px0, ty, 22, GY - ty + 6); g.fillStyle = P[6]; for (var y = ty + 34; y < GY; y += 46) g.fillRect(px0, y, 22, 10);
    q = g.createLinearGradient(px0, 0, px0 + 22, 0); q.addColorStop(0, 'rgba(20,10,40,.45)'); q.addColorStop(.18, 'rgba(20,10,40,.05)'); q.addColorStop(.3, 'rgba(255,255,255,.55)'); q.addColorStop(.42, 'rgba(255,255,255,.1)'); q.addColorStop(.75, 'rgba(20,10,40,.1)'); q.addColorStop(1, 'rgba(20,10,40,.5)');
    g.fillStyle = q; g.fillRect(px0, ty, 22, GY - ty + 6); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(px0 + 19.4, ty, 1.4, GY - ty + 6); g.strokeStyle = '#2b2140'; g.lineWidth = 2.2; g.strokeRect(px0, ty, 22, GY - ty + 6);   // the white rim light on the right, a dark outline all round
    [ty + 2, GY - 6].forEach(function (fy) { rr(g, px0 - 5, fy - 4, 32, 10, 4); fs(g, P[4], P[0], 1.6); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(px0 - 2, fy - 2.4, 26, 2); tkBolt(g, px0 - 0.5, fy + 1); tkBolt(g, px0 + 22.5, fy + 1); });
  });
  g.lineJoin = 'round';
  g.save(); g.translate(7, 12); g.globalAlpha = .16; g.strokeStyle = '#1a1030'; g.lineWidth = 36; g.lineCap = 'butt';   // soft drop shadow of the whole track
  tkPath(g, x, cx, ty); g.stroke(); g.beginPath(); g.arc(cx, cy, r, 0, PI2); g.stroke(); g.restore();
  tkPath(g, x, cx, ty); ribbon(g, P);                                                                                           // run-up, exit, and the ramp into the sky
  g.beginPath(); g.arc(cx, cy, r, 0, PI2); ribbon(g, P);                                                                        // the big ring
  g.save(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.setLineDash([12, 12]); g.lineDashOffset = -(p || 0) * 400;
  tkPath(g, x, cx, ty); g.stroke(); g.beginPath(); g.arc(cx, cy, r, 0, PI2); g.stroke(); g.restore();
  for (i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#fff' : '#2b2140'; g.fillRect(cx + 30 + i * 6, ty - 15, 6, 15); g.fillStyle = i % 2 ? '#2b2140' : '#fff'; g.fillRect(cx + 30 + i * 6, ty, 6, 15); }   // checkered start
  g.strokeStyle = '#2b2140'; g.lineWidth = 1.6; g.strokeRect(cx + 30, ty - 15, 60, 30);
  q = g.createLinearGradient(0, ty - 15, 0, ty + 15); q.addColorStop(0, 'rgba(255,255,255,.35)'); q.addColorStop(.5, 'rgba(255,255,255,0)'); q.addColorStop(1, 'rgba(20,10,40,.3)'); g.fillStyle = q; g.fillRect(cx + 30, ty - 15, 60, 30);
  var ra = r + 24, xa = cx + 36, xb = Math.max(-20, cx - 270), ty2 = ty - 26;
  g.save(); g.lineCap = 'butt'; g.beginPath(); g.arc(cx, cy, ra, 0, PI2); neonTube(g); g.restore();   // a neon light tube: a soft glow, a bright colored tube and a white-hot line down its middle
  g.save(); g.beginPath(); g.moveTo(xb, ty2); g.lineTo(xa, ty2); g.lineCap = 'round'; neonTube(g); g.restore();
}
function trackLive(g, x, t, th) {
  var P = TKP[th || 0] || TKP[0], cx = x + TK.cx, cy = TK.cy, r = TK.r, ty = cy + r, i, a, q, ra = r + 24, xa = cx + 36, xb = Math.max(-20, cx - 270), ty2 = ty - 26, k, u, sx0, sy0, sz = 40;
  var RS = [.31, .47, .38, .55, .26], US = [.43, .66, .5, .74, .35], ph1 = [0, .37, .61, .12, .83];   // every spark has its own speed, and they speed up and slow down
  for (k = 0; k < 5; k++) {   // magnesium sparks race round the ring, and then others run along the run-up from the front (right) to the back (left)
    var zs = sz * (.72 + .5 * tkHash(k * 3.1 + 1)) * (1 + .55 * Math.pow(Math.max(0, Math.sin(t * (1.7 + k * .6) + k * 2.3)), 4)), fk = Math.floor(t * (15 + k * 4.5)) + k * 3, jx = (tkHash(Math.floor(t * 19) + k * 7) - .5) * 4, jy = (tkHash(Math.floor(t * 23) + k * 5) - .5) * 4;
    u = (t * RS[k] + ph1[k] + .06 * Math.sin(t * (1.3 + k * .5) + k * 1.9) + .03 * Math.sin(t * 5.1 + k)) % 1; if (u < 0) u += 1; a = Math.PI / 2 + u * PI2; sx0 = cx + Math.cos(a) * ra + jx; sy0 = cy + Math.sin(a) * ra + jy; tkSpark(g, sx0, sy0, zs, fk);
    g.save(); g.globalCompositeOperation = 'lighter'; tkSparks(g, sx0, sy0, t * (.8 + k * .13), k); tkTrail(g, function (d) { var b = a - d * .09 * (.7 + .3 * k / 4); return [cx + Math.cos(b) * ra, cy + Math.sin(b) * ra]; }); g.restore();
    zs = sz * (.7 + .55 * tkHash(k * 5.3 + 9)) * (1 + .6 * Math.pow(Math.max(0, Math.sin(t * (2.3 + k * .4) + k * 1.1)), 4)); fk = Math.floor(t * (17 + k * 3.7)) + k * 5 + 1;
    u = (t * US[k] + ph1[(k + 2) % 5] + .07 * Math.sin(t * (1.9 + k * .4) + k * 2.7) + .03 * Math.sin(t * 6.3 + k * 2)) % 1; if (u < 0) u += 1; sx0 = xa - u * (xa - xb) + (tkHash(Math.floor(t * 21) + k * 3) - .5) * 4; sy0 = ty2 + (tkHash(Math.floor(t * 17) + k * 11) - .5) * 5; tkSpark(g, sx0, sy0, zs, fk);
    g.save(); g.globalCompositeOperation = 'lighter'; tkSparks(g, sx0, sy0, t * (.9 + k * .11), k + 10); tkTrail(g, function (d) { return [sx0 + d * 7, sy0]; }); g.restore();
  }
  [[cx - 70, ty], [cx, cy - r], [cx + 70, ty]].forEach(function (c2) {                                                          // bolted metal collars
    rr(g, c2[0] - 13, c2[1] - 26, 26, 52, 7); fs(g, P[10], '#2b2140', 2.2);
    q = g.createLinearGradient(c2[0] - 13, 0, c2[0] + 13, 0); q.addColorStop(0, 'rgba(255,255,255,.55)'); q.addColorStop(.35, 'rgba(255,255,255,.05)'); q.addColorStop(1, 'rgba(20,10,40,.45)');
    rr(g, c2[0] - 13, c2[1] - 26, 26, 52, 7); g.fillStyle = q; g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(c2[0] - 9, c2[1] - 22, 5, 4);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(c2[0] - 10.5, c2[1] - 9, 3, 18); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(c2[0] + 10, c2[1] - 22, 1.3, 44);   // a long shine down the left and a rim light on the right
    g.fillStyle = 'rgba(30,16,60,.35)'; g.fillRect(c2[0] - 12, c2[1] - 2, 24, 4); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(c2[0] - 12, c2[1] - 3, 24, 1.2);   // a grooved band across the middle
    tkBolt(g, c2[0] - 7, c2[1] - 20); tkBolt(g, c2[0] + 7, c2[1] - 20); tkBolt(g, c2[0] - 7, c2[1] + 20); tkBolt(g, c2[0] + 7, c2[1] + 20);
  });
  a = (t * .7) % 1; q = a < .3 ? Math.sin(a / .3 * Math.PI) : 0;   // a twinkle that travels round the big ring
  if (q > .05) { var ta = -2.2 + t * 2.1, sx = cx + Math.cos(ta) * (r - 6), sy = cy + Math.sin(ta) * (r - 6), sr = 7 * q; g.fillStyle = 'rgba(255,255,255,' + q + ')'; g.beginPath(); g.moveTo(sx, sy - sr); g.lineTo(sx + sr * .24, sy - sr * .24); g.lineTo(sx + sr, sy); g.lineTo(sx + sr * .24, sy + sr * .24); g.lineTo(sx, sy + sr); g.lineTo(sx - sr * .24, sy + sr * .24); g.lineTo(sx - sr, sy); g.lineTo(sx - sr * .24, sy - sr * .24); g.closePath(); g.fill(); }
  g.lineCap = 'round';
}
/* the golden banana coin: 8 pre-drawn frames of it spinning */
var COIN = null, COINN = 20;
var COINK = null;
function coinShape() {   // the banana outline as points (once): a crescent with a thick middle, plus the ridge lines
  if (COINK) return COINK;
  var N = 18, P0 = [-16, -6], P1 = [.5, 19], P2 = [16.5, -9], up = [], dn = [], mid = [], j, t, u, cx, cy, dx, dy, l, nx, ny, w;
  for (j = 0; j <= N; j++) {
    t = j / N; u = 1 - t; cx = u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0]; cy = u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1];
    dx = 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]); dy = 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]); l = Math.sqrt(dx * dx + dy * dy) || 1; nx = -dy / l; ny = dx / l;
    w = 1.6 + 7.4 * Math.pow(Math.sin(Math.min(1, t * .96 + .02) * Math.PI), .62); up.push([cx - nx * w, cy - ny * w]); dn.push([cx + nx * w, cy + ny * w]); mid.push([cx, cy, nx, ny, w]);
  }
  return COINK = { N: N, up: up, dn: dn, mid: mid, P0: P0, P2: P2 };
}
function coinFrame(i) {   // a GOLD banana turning about its up-down axis like a coin on a spindle: 20 steps. The face narrows, shows its back (mirrored), and a thick milled gold edge shows when it is side-on. No shadow (it floats in the air).
  if (!COIN) COIN = [];
  if (COIN[i]) return COIN[i];
  var m = mk(44, 48), g = m.g, S = coinShape(), N = S.N, th = i / COINN * PI2, c = Math.cos(th), sn = Math.sin(th), ac = Math.abs(c), SC = .84, T = 3.4, k, n = 7, q, ox, base = 22, by0 = 23;
  function path(dx) { g.save(); g.translate(base + dx, by0); g.scale(Math.max(.02, ac) * SC * (c < 0 ? -1 : 1), SC); g.beginPath(); g.moveTo(S.up[0][0], S.up[0][1]); for (var j = 1; j <= N; j++) g.lineTo(S.up[j][0], S.up[j][1]); for (var j = N; j >= 0; j--) g.lineTo(S.dn[j][0], S.dn[j][1]); g.closePath(); g.restore(); }
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (k = 0; k <= n; k++) { ox = sn * T * (1 - 2 * k / n); path(ox); g.lineWidth = 3.2; g.strokeStyle = INK; g.stroke(); g.fillStyle = INK; g.fill(); }   // the dark outline of the whole thickness
  for (k = 0; k <= n; k++) { ox = sn * T * (1 - 2 * k / n); path(ox); g.fillStyle = k % 2 ? '#d9980a' : '#f2b81c'; g.fill(); }   // the milled gold edge
  ox = sn * T * (c > 0 ? 1 : -1); path(ox); q = g.createLinearGradient(base + ox, by0 - 10, base + ox, by0 + 12); q.addColorStop(0, '#fff6b0'); q.addColorStop(.28, '#ffd726'); q.addColorStop(.7, '#f5ad06'); q.addColorStop(1, '#d08a00'); g.fillStyle = q; g.fill();   // the face: bright gold
  g.save(); path(ox); g.clip();
  g.save(); g.translate(base + ox, by0); g.scale(Math.max(.02, ac) * SC * (c < 0 ? -1 : 1), SC); g.lineJoin = 'round'; g.lineCap = 'round';
  function rib(f0, col, lw) { g.beginPath(); for (var k2 = 1; k2 < N; k2++) { var p = S.mid[k2], o = f0 * p[4]; if (k2 === 1) g.moveTo(p[0] + p[2] * o, p[1] + p[3] * o); else g.lineTo(p[0] + p[2] * o, p[1] + p[3] * o); } g.strokeStyle = col; g.lineWidth = lw; g.stroke(); }
  rib(-.6, 'rgba(255,244,170,.9)', 1.5); rib(-.28, 'rgba(170,100,0,.5)', 1); rib(.1, 'rgba(170,100,0,.45)', 1); rib(.5, 'rgba(140,76,0,.5)', 1.1); rib(.8, 'rgba(255,214,90,.6)', 1.1);   // the peel ridges
  g.fillStyle = 'rgba(120,60,0,.3)'; g.beginPath(); g.ellipse(5, 13.6, 11, 3.2, -.25, 0, PI2); g.fill();
  var fr = ((i / COINN) * 2) % 1, sa = Math.sin(fr * Math.PI), sxp = -24 + fr * 48;   // the shine lives ON the face: it sweeps across it once per half turn and squeezes with it, so it never slides over the edge or the background
  g.save(); g.rotate(.5); g.fillStyle = 'rgba(255,255,255,' + (.62 * sa) + ')'; g.fillRect(sxp - 2.2, -30, 4.4, 60); g.fillStyle = 'rgba(255,255,255,' + (.3 * sa) + ')'; g.fillRect(sxp + 4.6, -30, 2.4, 60); g.restore();
  g.restore();
  g.save(); g.translate(base + ox, by0); g.scale(Math.max(.02, ac) * SC, SC);   // the gloss is drawn the same way up on the front and the back (light from the upper left), and squeezes with the face as it turns
  q = g.createLinearGradient(-10, -9, 12, 14); q.addColorStop(0, 'rgba(0,0,0,0)'); q.addColorStop(.5, 'rgba(0,0,0,0)'); q.addColorStop(1, 'rgba(150,76,0,.45)'); g.fillStyle = q; g.fillRect(-22, -22, 44, 46);   // deep gold toward the lower right
  g.beginPath(); for (var k3 = 3; k3 < N - 4; k3++) { var pp = S.mid[k3], oo = -.5 * pp[4]; if (k3 === 3) g.moveTo(pp[0] + pp[2] * oo, pp[1] + pp[3] * oo); else g.lineTo(pp[0] + pp[2] * oo, pp[1] + pp[3] * oo); }
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 1.4; g.stroke();   // the long shine streak
  pp = S.mid[4]; oo = -.5 * pp[4]; g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(pp[0] + pp[2] * oo, pp[1] + pp[3] * oo, 3, 0, PI2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(pp[0] + pp[2] * oo, pp[1] + pp[3] * oo, 1.7, 0, PI2); g.fill();   // and its bright dot
  g.restore();
  g.fillStyle = 'rgba(110,60,0,' + (.32 * (1 - ac)) + ')'; g.fillRect(0, 0, 44, 48);   // the face darkens as it turns away
  g.restore();
  path(ox); g.lineWidth = 1.1; g.strokeStyle = '#7a4500'; g.stroke();
  g.save(); g.translate(base + ox, by0); g.scale(Math.max(.02, ac) * SC * (c < 0 ? -1 : 1), SC);
  g.beginPath(); g.moveTo(S.P2[0] - 1, S.P2[1] + .5); g.lineTo(S.P2[0] + 2.4, S.P2[1] - 4.8); g.restore();   // the stem
  g.lineWidth = 3.6; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2; g.strokeStyle = '#8a5a1c'; g.stroke();
  g.save(); g.translate(base + ox, by0); g.scale(Math.max(.02, ac) * SC * (c < 0 ? -1 : 1), SC); g.fillStyle = '#4a2a10'; g.beginPath(); g.ellipse(S.P0[0] - .4, S.P0[1] - .2, 2.6, 2.3, -.5, 0, PI2); g.fill(); g.restore();   // the dark tip
  return COIN[i] = m;
}
function coinFrames() { COIN = []; for (var i = 0; i < COINN; i++) (function (i) { TASKQ.push(function () { coinFrame(i); }); })(i); }
function coin(g, x, y, t) {
  var m = coinFrame(Math.floor(t * 11) % COINN), ph = (t * .9 + x * .013 + y * .007) % 1, a = ph < .22 ? Math.sin(ph / .22 * Math.PI) : 0, r;
  put(g, m.c, x - 22, y - 23);
  if (a > .05) { r = 6.5 * a; g.save(); g.globalAlpha = a; g.fillStyle = '#fffbe0'; g.beginPath(); g.moveTo(x - 9, y - 15 - r); g.lineTo(x - 9 + r * .28, y - 15 - r * .28); g.lineTo(x - 9 + r, y - 15); g.lineTo(x - 9 + r * .28, y - 15 + r * .28); g.lineTo(x - 9, y - 15 + r); g.lineTo(x - 9 - r * .28, y - 15 + r * .28); g.lineTo(x - 9 - r, y - 15); g.lineTo(x - 9 - r * .28, y - 15 - r * .28); g.closePath(); g.fill(); g.restore(); }   // a twinkle that crosses each coin now and then (out of step, so the coins do not blink together)
}

/* ===================== SPECIALS: party balloons, vanilla wafers, the party sky ===================== */
var BALW = false, BALC = ['#ff4d6d', '#ff9a3c', '#ffd93b', '#4fd36a', '#2fc7c0', '#4d9bff', '#9a6cff', '#ff7ad0', '#ffc43a'], BALP = {}, WAFP = null, PARTY = null, PARTYN = null, BALWN = false;   // the last balloon is the gold one
function meshPic(w, h, ol, build) {   // a toon-lit 3D picture w x h (units): build(R, s) draws the meshes; finished with the dark outline all round, like Fancy
  var m = mk(w, h), sx = m.c.width / w, sy = m.c.height / h, ss = sx * SS, R = new Rast(Math.ceil(w * ss), Math.ceil(h * ss)), S = document.createElement('canvas'), sg, B, Bg;
  build(R, ss); S.width = R.w; S.height = R.h; sg = S.getContext('2d', RF); sg.putImageData(new ImageData(R.px, R.w, R.h), 0, 0); R.release();
  B = document.createElement('canvas'); B.width = m.c.width; B.height = m.c.height; Bg = B.getContext('2d', RF); Bg.imageSmoothingQuality = 'high'; Bg.drawImage(S, 0, 0, B.width, B.height);
  m.g.setTransform(1, 0, 0, 1, 0, 0); m.g.drawImage(outlinePic(B, ol * sx, OUTK), 0, 0); m.g.setTransform(sx, 0, 0, sy, 0, 0);
  return m;
}
function balloonFn(cx, cy, rx, ry) {   // a round balloon, a little narrower toward the knot
  return function (u, v) { var ph = (u - .5) * Math.PI, th = v * PI2, cp = Math.cos(ph), sp = Math.sin(ph), t = 1 - .2 * (sp > 0 ? sp * sp : 0); return { x: cx + rx * t * cp * Math.cos(th), y: cy + ry * sp, z: rx * t * cp * Math.sin(th), nx: cp * Math.cos(th) / rx, ny: sp / ry, nz: cp * Math.sin(th) / rx }; };
}
function balloonPic(ci) {   // a glossy 3D party balloon with its knot and a curly string: 60 x 106 units, the middle of the balloon at (30, 33)
  var p = BALP[ci]; if (p) return p; var col = BALC[ci % BALC.length], mat = ci === 8 ? 5 : matFor(col), m, g;
  m = meshPic(60, 106, 1.9, function (R, s) {
    meshNow(R, balloonFn(30, 33, 23, 28), 26, 24, s, 0, 0, mat, null, 0);
    meshNow(R, rodFn(30, 60, 0, 30, 66, 0, 1.6, 4.2), 3, 10, s, 0, 0, mat, null, 0);
    meshNow(R, ballFn(30, 67.4, 0, 3.4, 2.4, 3.4), 6, 10, s, 0, 0, mat, null, 0);
  });
  g = m.g;
  g.save(); ell(g, 30, 33, 22.2, 27.2); g.clip();   // bounce light from the floor, up the lower right, and a darker, richer rim all round (the rubber is thin and glows)
  g.fillStyle = rg(g, 40, 56, 2, 38, 52, 22, [[0, 'rgba(255,255,255,.34)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, 60, 70);
  g.lineWidth = 3.2; g.strokeStyle = 'rgba(' + hex(drk(col, .35)).join(',') + ',.5)'; ell(g, 30, 33, 22.4, 27.4); g.stroke();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.78)'; rr(g, 15.6, 15, 6.6, 9.4, 2.6); g.fill(); rr(g, 23.2, 13.6, 3.4, 8, 1.7); g.fill(); rr(g, 15.6, 25.6, 6.6, 3.4, 1.7); g.fill();   // the window reflected in the shine: panes, like a real toy balloon
  g.fillStyle = 'rgba(255,255,255,.5)'; circ(g, 38.6, 47.6, 1.5); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; ell(g, 29.2, 66.2, 2, 1.2, -.3); g.fill();   // a glint on the knot
  g.lineCap = 'round'; g.beginPath(); g.moveTo(30, 70); g.bezierCurveTo(23, 79, 37, 89, 30, 101); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.strokeStyle = '#fffdf6'; g.lineWidth = 1.3; g.stroke();
  return (BALP[ci] = m);
}
function balloon(g, ci, x, y, sc, sy, ns) {   // centred on the balloon's middle; sc / sy stretch it (a squash before the pop); ns: leave off its own string
  var p = balloonPic(ci), a = sc === undefined ? 1 : sc, b = sy === undefined ? a : sy, k2;
  if (ns) { k2 = p.c.width / 60; g.drawImage(p.c, 0, 0, p.c.width, Math.round(70 * k2), x - 30 * a, y - 33 * b, 60 * a, 70 * b); }
  else if (a === 1 && b === 1) put(g, p.c, x - 30, y - 33); else g.drawImage(p.c, x - 30 * a, y - 33 * b, 60 * a, 106 * b);
}
function waferPic() {   // a round vanilla wafer: a thin beige dome with a pressed grid, a raised rim and a thick brown edge
  if (WAFP) return WAFP; var m, g, i;
  m = meshPic(36, 36, 1.5, function (R, s) { meshNow(R, domeFn(18, 17, 15.5, 4.5), 14, 28, s, 0, 0, matFor('#ebc98f'), null, 0); });
  g = m.g; g.save(); circ(g, 18, 17, 14.2); g.clip(); g.strokeStyle = 'rgba(140,96,48,.24)'; g.lineWidth = .7;
  for (i = -36; i < 40; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 36, 36); g.moveTo(i + 36, 0); g.lineTo(i, 36); g.stroke(); }
  circ(g, 18, 17, 8.4); g.strokeStyle = 'rgba(140,96,48,.3)'; g.lineWidth = .9; g.stroke(); g.restore();
  circ(g, 18, 17, 14.6); g.strokeStyle = 'rgba(120,76,30,.6)'; g.lineWidth = 1.3; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.42)'; ell(g, 11.5, 9.5, 5, 2.4, -.65); g.fill();
  g.globalCompositeOperation = 'destination-over'; circ(g, 19.2, 19.6, 15.6); fs(g, '#a06c32', OUTK, 1.5); g.globalCompositeOperation = 'source-over';   // the thick edge peeks out below and to the right
  return (WAFP = m);
}
function partyBuild(nt) {   // the balloon party's sky: sunny gradient, soft hills and clouds, a string of bunting, and a picnic-cloth floor that scrolls
  var P = { }, g, i, x, m;
  m = mk(W, GY); g = m.g; g.fillStyle = lg(g, 0, 0, 0, GY, nt ? [[0, '#0b1540'], [.55, '#2b2a6b'], [1, '#8a4f94']] : [[0, '#62c4ff'], [.55, '#b8e8ff'], [1, '#fff1d6']]); g.fillRect(0, 0, W, GY);
  g.fillStyle = nt ? rg(g, 280, 92, 4, 280, 92, 150, [[0, 'rgba(210,225,255,.7)'], [.4, 'rgba(160,190,255,.25)'], [1, 'rgba(160,190,255,0)']]) : rg(g, 280, 92, 4, 280, 92, 150, [[0, 'rgba(255,250,200,.95)'], [.4, 'rgba(255,240,170,.35)'], [1, 'rgba(255,240,170,0)']]); g.fillRect(0, 0, W, GY);
  if (nt) { for (i = 0; i < 46; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.5 * ((i * 37) % 10) / 10).toFixed(2) + ')'; circ(g, (i * 97 + 13) % W, ((i * 61 + 7) % (GY * 0.62)), 0.7 + (i % 3) * 0.5); g.fill(); } g.fillStyle = '#f6f1d6'; circ(g, 280, 92, 22); g.fill(); g.fillStyle = 'rgba(150,140,110,.35)'; circ(g, 272, 86, 5); g.fill(); circ(g, 288, 100, 4); g.fill(); circ(g, 286, 82, 3); g.fill(); } else { g.fillStyle = '#fff6b8'; circ(g, 280, 92, 22); g.fill(); }
  P.sky = m;
  function hills(base, amp, col, col2, ph) { var c = mk(W, 150); c.g.beginPath(); c.g.moveTo(0, 150); for (x = 0; x <= W; x += 6) c.g.lineTo(x, 150 - base - amp * Math.sin(x / W * PI2 * 2 + ph) - amp * .5 * Math.sin(x / W * PI2 * 3 + ph * 2)); c.g.lineTo(W, 150); c.g.closePath(); c.g.fillStyle = lg(c.g, 0, 150 - base - amp * 1.6, 0, 150, [[0, col2], [1, col]]); c.g.fill(); return { c: c.c, P: W, y: GY - 150 }; }
  P.far = nt ? hills(60, 18, '#2f4f86', '#4a6fa8', .7) : hills(60, 18, '#a8dd96', '#c6f0b0', .7); P.mid = nt ? hills(30, 14, '#264a5e', '#3b6e80', 2.1) : hills(30, 14, '#6fc668', '#92dd80', 2.1);
  function clouds(spec) { var c = mk(W, 110), cg = c.g; spec.forEach(function (q) { var j, cx = q[0], cy = q[1], r = q[2]; [[-1.1, .25, .8], [-.45, -.2, 1.05], [.35, -.28, 1.15], [1.1, .15, .85], [0, .35, 1]].forEach(function (b) { circ(cg, cx + b[0] * r, cy + b[1] * r, r * b[2]); cg.fillStyle = rg(cg, cx + b[0] * r - r * .2, cy + b[1] * r - r * .3, 1, cx + b[0] * r, cy + b[1] * r, r * b[2], [[0, '#ffffff'], [.7, '#f4f9ff'], [1, '#cfe0f5']]); cg.fill(); }); }); return { c: c.c, P: W, y: 0 }; }
  P.cl1 = clouds([[78, 40, 17], [262, 66, 14]]); P.cl2 = clouds([[170, 50, 22]]); P.cl1.y = 60; P.cl2.y = 150;
  if (nt) [P.cl1, P.cl2].forEach(function (q) { var cg = q.c.getContext('2d'); cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = 'rgba(40,40,110,.6)'; cg.fillRect(0, 0, q.c.width, q.c.height); });
  m = mk(W, 56); g = m.g; g.lineWidth = 1.6; g.strokeStyle = INK; var seg = W / 4, cols = ['#ff4d6d', '#ffd93b', '#4d9bff', '#4fd36a', '#ff9a3c', '#9a6cff'], n = 0;
  for (i = 0; i < 4; i++) { var x0 = i * seg, x1 = x0 + seg; g.beginPath(); g.moveTo(x0, 6); g.quadraticCurveTo((x0 + x1) / 2, 24, x1, 6); g.stroke();
    for (var j = 1; j < 6; j++) { var t = j / 6, bx = x0 + seg * t, by0 = 6 * (1 - t) * (1 - t) + 2 * 24 * t * (1 - t) + 6 * t * t; g.beginPath(); g.moveTo(bx - 7, by0); g.lineTo(bx + 7, by0); g.lineTo(bx, by0 + 17); g.closePath(); fs(g, cols[n++ % cols.length], INK, 1.5); } }
  P.bun = { c: m.c, P: W, y: 0 };
  m = mk(72, 72); g = m.g; for (i = 0; i < 6; i++) for (x = 0; x < 6; x++) { g.fillStyle = (i + x) % 2 ? (nt ? '#8a7ad8' : '#ffffff') : (nt ? '#3a2f7a' : '#ff6b81'); g.fillRect(x * 12, i * 12, 12, 12); }
  g.fillStyle = lg(g, 0, 0, 0, 72, [[0, 'rgba(255,255,255,.35)'], [.25, 'rgba(255,255,255,0)'], [1, 'rgba(60,20,40,.3)']]); g.fillRect(0, 0, 72, 72); g.fillStyle = INK; g.fillRect(0, 0, 72, 3); P.floor = m;
  return nt ? (PARTYN = P) : (PARTY = P);
}
function party(nt) { return nt ? PARTYN || partyBuild(true) : PARTY || partyBuild(); }
function balBack(g, off, nt) { var P = party(nt); put(g, P.sky.c, 0, 0); layer(g, P.cl1, off * .1); layer(g, P.far, off * .2); layer(g, P.cl2, off * .16); layer(g, P.mid, off * .45); layer(g, P.bun, off * .8); }
function balGround(g, off, nt) { var F = party(nt).floor, x; for (x = px(-(off % 72)); x < W; x += 72) put(g, F.c, x, GY); }
function balWarm(nt) { var i; if (nt && !BALWN) { BALWN = true; TASKQ.push(function () { party(true); }); } if (BALW) return; BALW = true; TASKQ.push(party); for (i = 0; i < BALC.length; i++) (function (i) { TASKQ.push(function () { balloonPic(i); }); })(i); TASKQ.push(waferPic); }
/*TEST_HOOK_START*/ window.__artT = { strip: strip, sets: sets, DEF: DEF, FARA: FARA, MIDA: MIDA, GP: GP, JGW: JGW, mk: mk, K: function () { return K; } }; /*TEST_HOOK_END*/
return { layersOf: layersOf, sceneReady: sceneReady, sceneStep: sceneStep, heroStep: heroStep, get tlast() { return TLAST; }, /*TEST_HOOK_START*/ obSnap: function (v) { OBSNAP = !!v; }, handPic: function (o, f) { return handPic(o, f).c; }, /*TEST_HOOK_END*/ tbmax: TBMAX, arena: { draw: arenaDraw, ready: function () { return !!ARN && ARN.ok >= ARN.n; } }, fightWarm: fightWarm, boss: boss, bossPic: bossPic, fxs: fxs, crown: crownDraw, setColors: setColors, pal: PAL, journeyTheme: JT, bal: { free: function () { PARTYN = null; BALWN = false; }, draw: balloon, back: balBack, ground: balGround, warm: balWarm, n: BALC.length, cols: BALC }, coin: coin, TK: TK, mg: { free: mgfree, bytes: function () { var n = 0, k; for (k in MGC) if (MGC[k] && MGC[k].c) n += MGC[k].c.width * MGC[k].c.height * 4; if (MGW) n += MGW.c.width * MGW.c.height * 4; if (MGCA) n += MGCA.c.width * MGCA.c.height * 4; return n; }, jungle: function (g, y) { if (!JTL) { g.fillStyle = '#17502a'; g.fillRect(0, 0, W, Math.max(0, y)); return; } for (var yy = y - 160; yy > -160; yy -= 160) put(g, JTL.c, 0, yy); }, draw: mgdraw, water: mgwater, caustic: mgcaustic, glints: mgglints, sea: mgsea, sprite: mgs, warm: mgwarm, done: mgdone }, life: life, warm: warm, pump: pump, spinPic: function (i) { return spinFrame(i).c; }, heroPic: function (e) { return heroPic(e).c; }, ready: function (th) { return !!SET[th]; }, pend: pend, track: track, order: ORDER, init: init, keep: keep, back: back, ground: ground, obstacle: obstacle, rects: rects, banana: banana, friend: friend, chimp: chimp, names: NAMES, groundP: GP, themes: DEF.length, kindsOf: function (th) { return DEF[th].kinds; }, nv: function (th) { return DEF[th].ts[0].nv; } };
})();
