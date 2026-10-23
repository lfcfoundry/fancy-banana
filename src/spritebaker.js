/* sprite-baker 1.7.0 (API 1), LEAN BUILD without: baking, mesh, ramps, rotation, shapes, sheets. Made by modules/sprite-baker/lean.py; the cut parts are missing on purpose. MIT License, Copyright (c) 2026 LFC Foundry. https://github.com/lfcfoundry/JS-modules */
var SpriteBaker = (function () {
  'use strict';
  var PI2 = Math.PI * 2;
  var NO_DEPTH = -1e9;
  var DEFAULT_CULL = -0.75;
  var DEFAULT_LIGHT = [-0.42, -0.62, 0.66];
  function norm3(x, y, z) {
    var l = Math.sqrt(x * x + y * y + z * z) || 1;
    return [x / l, y / l, z / l];
  }
  function Rast(w, h) {
    if (!(this instanceof Rast)) return new Rast(w, h);
    this.w = w | 0;
    this.h = h | 0;
    this.z = new Float32Array(this.w * this.h).fill(NO_DEPTH);
    this.px = new Uint8ClampedArray(this.w * this.h * 4);
    this.setLight(DEFAULT_LIGHT);
  }
  Rast.prototype.setLight = function (x, y, z) {
    if (Array.isArray(x)) { z = x[2]; y = x[1]; x = x[0]; }
    var l = norm3(x, y, z), h = norm3(l[0], l[1], l[2] + 1);
    this.L = l;
    this.H = h;
    return this;
  };
  Rast.prototype.clear = function () {
    this.z.fill(NO_DEPTH);
    this.px.fill(0);
    return this;
  };
  Rast.prototype.toImageData = function () {
    return makeImage(this.w, this.h, this.px);
  };
  function makeImage(w, h, data) {
    if (typeof ImageData !== 'undefined') {
      try { return new ImageData(data, w, h); } catch (e) {  }
    }
    return { width: w, height: h, data: data };
  }
  function pick(v, d) { return v === undefined ? d : v; }
  function checkTexture(T) {
    var w = T && T.w, h = T && T.h, d = T && T.data;
    if (!(w >= 1 && h >= 1 && w === Math.floor(w) && h === Math.floor(h)) || !d || !(d.length >= w * h * 4)) throw new Error('a texture is { w, h, data } with whole-number w and h and w * h * 4 RGBA bytes in data');
  }
  function asMaterial(m) {
    if (m && m.lut) return m;
    throw new Error('material must be an object with a lut');
  }
  function tri(rast, a, b, c, mat, opts) {
    var cull = opts && opts.cull !== undefined ? opts.cull : DEFAULT_CULL;
    if (cull !== false && a[5] + b[5] + c[5] < cull) return;
    if (!isFinite(a[0] + a[1] + a[2] + a[3] + a[4] + a[5] + b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + c[0] + c[1] + c[2] + c[3] + c[4] + c[5])) return;
    mat = asMaterial(mat);
    if ((mat.texture || mat.ridge) && a.length > 7 && b.length > 7 && c.length > 7) return triUV(rast, a, b, c, mat);
    var w = rast.w, h = rast.h, zbuf = rast.z, out = rast.px, lut = mat.lut;
    var x0 = a[0], y0 = a[1], x1 = b[0], y1 = b[1], x2 = c[0], y2 = c[1];
    var area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0 || !isFinite(area)) return;
    var minx = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    var miny = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxy = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    var inv = 1 / area;
    var lx = rast.L[0], ly = rast.L[1], lz = rast.L[2], hx = rast.H[0], hy = rast.H[1], hz = rast.H[2];
    var kSpec = mat.specular, kBounce = mat.bounce * 0.16, kPool = mat.pool * 0.3, kRim = mat.rimLight * 0.4, kEdge = mat.edge;
    var x, y, px, py, w0, w1, w2, z, idx, nx, ny, nz, l, wrap, t, rim, sp, ed, i3, o, r, g, bl;
    var dy0, dy1, dy2, hot, sq, p2, p4, p8, p16, p32, p64, p128, v0, v1, v2;
    for (y = miny; y <= maxy; y++) {
      py = y + 0.5; dy0 = y0 - py; dy1 = y1 - py; dy2 = y2 - py;
      for (x = minx; x <= maxx; x++) {
        px = x + 0.5;
        w0 = ((x1 - px) * dy2 - (x2 - px) * dy1) * inv;
        w1 = ((x2 - px) * dy0 - (x0 - px) * dy2) * inv;
        w2 = 1 - w0 - w1;
        if (w0 < -1e-5 || w1 < -1e-5 || w2 < -1e-5) continue;
        z = w0 * a[2] + w1 * b[2] + w2 * c[2];
        if (!isFinite(z)) continue;
        idx = y * w + x;
        if (z <= zbuf[idx]) continue;
        zbuf[idx] = z;
        nx = w0 * a[3] + w1 * b[3] + w2 * c[3];
        ny = w0 * a[4] + w1 * b[4] + w2 * c[4];
        nz = w0 * a[5] + w1 * b[5] + w2 * c[5];
        l = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + 1e-9);
        nx *= l; ny *= l; nz *= l;
        wrap = (nx * lx + ny * ly + nz * lz) * 0.5 + 0.5;
        t = wrap * wrap * 0.35 + wrap * 0.65;
        rim = nx * 0.5 + ny * 0.72 + nz * 0.2;
        t = t * 0.9 + (rim > 0 ? rim * kBounce : 0);
        sp = nx * 0.55 + ny * 0.8;
        if (sp > 0.25) t -= (sp - 0.25) * kPool;
        sp = nx * hx + ny * hy + nz * hz;
        hot = sp > 0;
        if (hot) {
          sq = sp; p2 = sq * sq; p4 = p2 * p2; p8 = p4 * p4; p16 = p8 * p8; p32 = p16 * p16; p64 = p32 * p32; p128 = p64 * p64;
          sq = (p16 * 0.55 + p64 * p32 * p8 * p4 * p2 * 0.55 + p128 * p128 * p64 * p32 * p16 * p8 * p4 * 0.5) * kSpec;
        } else sq = 0;
        if (nz < 0.34) t *= kEdge + (1 - kEdge) * Math.max(0, nz) / 0.34;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        i3 = ((t * 255) | 0) * 3;
        r = lut[i3]; g = lut[i3 + 1]; bl = lut[i3 + 2];
        ed = nx > 0 && nz < 0.8 ? nx * Math.pow(1 - (nz > 0 ? nz : 0), 2.2) * kRim : 0;
        o = idx * 4;
        v0 = r + sq * 255 + ed * 255; v1 = g + sq * 255 + ed * 255; v2 = bl + sq * 235 + ed * 255;
        if (hot && (Math.abs(v0 - Math.floor(v0) - 0.5) < 1e-8 || Math.abs(v1 - Math.floor(v1) - 0.5) < 1e-8 || Math.abs(v2 - Math.floor(v2) - 0.5) < 1e-8)) {
          sq = (Math.pow(sp, 16) * 0.55 + Math.pow(sp, 110) * 0.55 + Math.pow(sp, 380) * 0.5) * kSpec;
          v0 = r + sq * 255 + ed * 255; v1 = g + sq * 255 + ed * 255; v2 = bl + sq * 235 + ed * 255;
        }
        out[o] = v0;
        out[o + 1] = v1;
        out[o + 2] = v2;
        out[o + 3] = 255;
      }
    }
  }
  function triUV(rast, a, b, c, mat) {
    if (!isFinite(a[6] + a[7] + b[6] + b[7] + c[6] + c[7])) return;
    var T = mat.texture, Rg = mat.ridge, tw = 0, th = 0, td = null, uClamp = true, vWrap = PI2, sBase = 0.66, sWrap = 0.5;
    if (T) {
      checkTexture(T);
      tw = T.w; th = T.h; td = T.data; uClamp = pick(T.uClamp, true); vWrap = pick(T.vWrap, PI2); sBase = pick(T.shadeBase, 0.66); sWrap = pick(T.shadeWrap, 0.5); }
    var rF = 0, rDark = 0, rScale = 1, rLit = 0, rAdd = 0, hasLit = false;
    if (Rg) { rF = pick(Rg.freq, 5); rDark = pick(Rg.dark, -0.86); rScale = pick(Rg.darkScale, 0.93); hasLit = Rg.lit !== undefined; rLit = hasLit ? Rg.lit : 0; rAdd = pick(Rg.litAdd, 0.06); }
    var w = rast.w, h = rast.h, zbuf = rast.z, out = rast.px, lut = mat.lut;
    var x0 = a[0], y0 = a[1], x1 = b[0], y1 = b[1], x2 = c[0], y2 = c[1];
    var area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0 || !isFinite(area)) return;
    var minx = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    var miny = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxy = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    var inv = 1 / area;
    var lx = rast.L[0], ly = rast.L[1], lz = rast.L[2], hx = rast.H[0], hy = rast.H[1], hz = rast.H[2];
    var kSpec = mat.specular, kBounce = mat.bounce * 0.16, kPool = mat.pool * 0.3, kRim = mat.rimLight * 0.4, kEdge = mat.edge;
    var x, y, px, py, w0, w1, w2, z, idx, nx, ny, nz, l, wrap, t, rim, sp, ed, i3, o, r, g, bl, tu, tv, rd, hot, sq, p2, p4, p8, p16, p32, p64, p128;
    var tx, ty, x0i, y0i, y1i, fx, fy, i00, i10, i01, i11, w00, w10, w01, w11, al, aa, shade, tr, tg, tb, dmp;
    for (y = miny; y <= maxy; y++) {
      for (x = minx; x <= maxx; x++) {
        px = x + 0.5; py = y + 0.5;
        w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv;
        w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv;
        w2 = 1 - w0 - w1;
        if (w0 < -1e-5 || w1 < -1e-5 || w2 < -1e-5) continue;
        z = w0 * a[2] + w1 * b[2] + w2 * c[2];
        if (!isFinite(z)) continue;
        idx = y * w + x;
        if (z <= zbuf[idx]) continue;
        zbuf[idx] = z;
        nx = w0 * a[3] + w1 * b[3] + w2 * c[3];
        ny = w0 * a[4] + w1 * b[4] + w2 * c[4];
        nz = w0 * a[5] + w1 * b[5] + w2 * c[5];
        l = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + 1e-9);
        nx *= l; ny *= l; nz *= l;
        wrap = (nx * lx + ny * ly + nz * lz) * 0.5 + 0.5;
        t = wrap * wrap * 0.35 + wrap * 0.65;
        rim = nx * 0.5 + ny * 0.72 + nz * 0.2;
        t = t * 0.9 + (rim > 0 ? rim * kBounce : 0);
        sp = nx * 0.55 + ny * 0.8;
        if (sp > 0.25) t -= (sp - 0.25) * kPool;
        sp = nx * hx + ny * hy + nz * hz;
        hot = sp > 0;
        if (hot) {
          sq = sp; p2 = sq * sq; p4 = p2 * p2; p8 = p4 * p4; p16 = p8 * p8; p32 = p16 * p16; p64 = p32 * p32; p128 = p64 * p64;
          sq = (p16 * 0.55 + p64 * p32 * p8 * p4 * p2 * 0.55 + p128 * p128 * p64 * p32 * p16 * p8 * p4 * 0.5) * kSpec;
        } else sq = 0;
        tv = w0 * a[7] + w1 * b[7] + w2 * c[7];
        if (Rg) { rd = Math.cos(rF * tv); if (rd < rDark) t *= rScale; else if (hasLit && rd > rLit) t += rAdd; }
        if (nz < 0.34) t *= kEdge + (1 - kEdge) * Math.max(0, nz) / 0.34;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        i3 = ((t * 255) | 0) * 3;
        r = lut[i3]; g = lut[i3 + 1]; bl = lut[i3 + 2];
        dmp = 1;
        if (T) {
          tu = w0 * a[6] + w1 * b[6] + w2 * c[6];
          tx = uClamp ? Math.min(tw - 1.001, Math.max(0, tu * tw - 0.5)) : ((tu * tw - 0.5) % tw + tw) % tw;
          ty = (((tv / vWrap) * th - 0.5) % th + th) % th;
          x0i = tx | 0; y0i = ty | 0; fx = tx - x0i; fy = ty - y0i; y1i = (y0i + 1) % th;
          i00 = (y0i * tw + x0i) * 4; i10 = uClamp ? i00 + 4 : (y0i * tw + (x0i + 1) % tw) * 4; i01 = (y1i * tw + x0i) * 4; i11 = uClamp ? i01 + 4 : (y1i * tw + (x0i + 1) % tw) * 4;
          w00 = (1 - fx) * (1 - fy); w10 = fx * (1 - fy); w01 = (1 - fx) * fy; w11 = fx * fy;
          aa = td[i00 + 3] * w00 + td[i10 + 3] * w10 + td[i01 + 3] * w01 + td[i11 + 3] * w11;
          al = aa / 255;
          if (al > 0) {
            if (aa < 1) { tr = tg = tb = 0; }
            else {
              tr = (td[i00] * td[i00 + 3] * w00 + td[i10] * td[i10 + 3] * w10 + td[i01] * td[i01 + 3] * w01 + td[i11] * td[i11 + 3] * w11) / aa;
              tg = (td[i00 + 1] * td[i00 + 3] * w00 + td[i10 + 1] * td[i10 + 3] * w10 + td[i01 + 1] * td[i01 + 3] * w01 + td[i11 + 1] * td[i11 + 3] * w11) / aa;
              tb = (td[i00 + 2] * td[i00 + 3] * w00 + td[i10 + 2] * td[i10 + 3] * w10 + td[i01 + 2] * td[i01 + 3] * w01 + td[i11 + 2] * td[i11 + 3] * w11) / aa;
            }
            shade = sBase + sWrap * wrap;
            r = r * (1 - al) + tr * shade * al; g = g * (1 - al) + tg * shade * al; bl = bl * (1 - al) + tb * shade * al;
            dmp = tr > 200 && tg < 90 ? 0.55 : 1 - al * 0.8;
          }
        }
        ed = nx > 0 && nz < 0.8 ? nx * Math.pow(1 - (nz > 0 ? nz : 0), 2.2) * kRim : 0;
        o = idx * 4;
        sq *= dmp;
        out[o] = r + (sq * 255 + ed * 255);
        out[o + 1] = g + (sq * 255 + ed * 255);
        out[o + 2] = bl + (sq * 235 + ed * 255);
        if (hot && (Math.abs(r + (sq * 255 + ed * 255) - Math.floor(r + (sq * 255 + ed * 255)) - 0.5) < 1e-8 || Math.abs(g + (sq * 255 + ed * 255) - Math.floor(g + (sq * 255 + ed * 255)) - 0.5) < 1e-8 || Math.abs(bl + (sq * 235 + ed * 255) - Math.floor(bl + (sq * 235 + ed * 255)) - 0.5) < 1e-8)) {
          sq = (Math.pow(sp, 16) * 0.55 + Math.pow(sp, 110) * 0.55 + Math.pow(sp, 380) * 0.5) * kSpec * dmp;
          out[o] = r + (sq * 255 + ed * 255); out[o + 1] = g + (sq * 255 + ed * 255); out[o + 2] = bl + (sq * 235 + ed * 255);
        }
        out[o + 3] = 255;
      }
    }
  }
  function drawMesh(rast, m, mat, view, opts) {
    view = view || {};
    var s = view.scale === undefined ? 1 : view.scale, ox = view.ox || 0, oy = view.oy || 0, rot = view.rot || null, cen = view.center || [0, 0, 0];
    var cols = m.nv + 1, n = cols * (m.nu + 1), verts = new Array(n), k, i, j, x, y, z, nx, ny, nz, a, b, c, d;
    mat = asMaterial(mat);
    var pose = opts && typeof opts.pose === 'function' ? opts.pose : null, withUV = !!(mat.texture || mat.ridge), uvs = m.uv;
    for (k = 0; k < n; k++) {
      x = m.pos[k * 3]; y = m.pos[k * 3 + 1]; z = m.pos[k * 3 + 2];
      nx = m.nrm[k * 3]; ny = m.nrm[k * 3 + 1]; nz = m.nrm[k * 3 + 2];
      if (rot) {
        x -= cen[0]; y -= cen[1]; z -= cen[2];
        var rx = rot[0] * x + rot[1] * y + rot[2] * z + cen[0], ry = rot[3] * x + rot[4] * y + rot[5] * z + cen[1], rz = rot[6] * x + rot[7] * y + rot[8] * z + cen[2];
        var qx = rot[0] * nx + rot[1] * ny + rot[2] * nz, qy = rot[3] * nx + rot[4] * ny + rot[5] * nz, qz = rot[6] * nx + rot[7] * ny + rot[8] * nz;
        x = rx; y = ry; z = rz; nx = qx; ny = qy; nz = qz;
      }
      if (pose) {
        var P = { x: x, y: y, z: z, nx: nx, ny: ny, nz: nz }, Q = pose(P) || P;
        x = Q.x; y = Q.y; z = Q.z; nx = Q.nx; ny = Q.ny; nz = Q.nz;
      }
      if (withUV) verts[k] = [ox + x * s, oy + y * s, z * s, nx, ny, nz, uvs ? uvs[k * 2] : ((k / cols) | 0) / m.nu, uvs ? uvs[k * 2 + 1] : ((k % cols) / m.nv) * PI2];
      else verts[k] = [ox + x * s, oy + y * s, z * s, nx, ny, nz];
    }
    for (i = 0; i < m.nu; i++) {
      for (j = 0; j < m.nv; j++) {
        a = verts[i * cols + j]; b = verts[(i + 1) * cols + j]; c = verts[(i + 1) * cols + j + 1]; d = verts[i * cols + j + 1];
        tri(rast, a, b, c, mat, opts);
        tri(rast, a, c, d, mat, opts);
      }
    }
  }
  return {
    version: '1.7.0',
    Rast: Rast,
    tri: tri,
    drawMesh: drawMesh,
    DEFAULT_LIGHT: DEFAULT_LIGHT.slice()
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SpriteBaker; else (typeof globalThis !== 'undefined' ? globalThis : this).SpriteBaker = SpriteBaker;
