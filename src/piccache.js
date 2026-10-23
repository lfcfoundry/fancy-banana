/* PicCache: the title screen's biggest pictures (the scenery behind the title and the banana's first face) are kept in this browser's own storage, one set per build, picture scale and costume colors, so a later visit puts them back
   instead of drawing them again. Nothing leaves the device. It is used only where reading back was measured to be quicker than drawing on this device (the last visit's read-back time against its drawing time), it asks the page
   for nothing but a short wait at start (150 ms at most, then everything is drawn the usual way), and every failure just means "draw it". The pixels come back exactly as they were saved. Copyright (c) 2026 LFC Foundry. MIT licensed. */
var PicCache = (function () {
  var SIG = '__PCSIG__', DBN = 'lfc-fancy-pics', SK = 'fancyPicStat', KEEP = 6, hash = location.hash, test = /[#&]test\b/.test(hash), forced = /[#&]test-cache\b/.test(hash), mem = {}, queue = [], hits = {}, rec = {}, mism = 0, checked = 0,
    stat = null, on = false, boot = true, builtMs = 0, readMs = -1, late = false, started = 0, ran = false, db = null, api, haveIDB = false, doneW = null;
  try { stat = JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) { stat = null; }
  if (!stat || stat.s !== SIG) stat = { s: SIG, b: 0, r: -1, v: 0 };
  stat.v++;
  try { haveIDB = typeof indexedDB === 'object' && !!indexedDB && typeof ImageData === 'function'; } catch (e) { }
  // on: the first visits (nothing to compare yet), then whenever reading back was clearly quicker than drawing; one visit in twelve tries again after a no
  on = haveIDB && (forced || (!test && (stat.r < 0 || stat.b <= 0 || stat.r < stat.b * 0.8 || stat.v % 12 === 0)));
  function store() { try { localStorage.setItem(SK, JSON.stringify(stat)); } catch (e) { } }
  function collect(v) { var h = [], q; (function walk(x) { if (!x || typeof x !== 'object') return; if (x.b instanceof ArrayBuffer) { h.push(fnv(x.b)); return; } for (q in x) walk(x[q]); })(v); return h.join(','); }
  function fnv(b) { var u = new Uint8Array(b), h = 2166136261 >>> 0, i, n = u.length; for (i = 0; i < n; i += 7) h = Math.imul(h ^ u[i], 16777619) >>> 0; return h.toString(16) + ':' + n; }
  api = {
    get on() { return on; }, get boot() { return boot; }, get hits() { return hits; }, flushed: null,
    start: function (go) {   // run go() once: now when this is off; after the saved pictures arrive, or after 150 ms, when it is on
      var done = false, arrived = false, fin = function () { if (done) return; done = true; ran = true; late = !arrived; readMs = performance.now() - started; go(); };
      if (!on) { boot = false; store(); go(); return; }
      started = performance.now(); setTimeout(fin, forced ? 4000 : 150);
      var rq; try { rq = indexedDB.open(DBN, 1); } catch (e) { on = false; boot = false; fin(); return; }
      rq.onupgradeneeded = function () { try { rq.result.createObjectStore('p'); } catch (e) { } };
      rq.onerror = rq.onblocked = function () { on = false; boot = false; fin(); };
      rq.onsuccess = function () {
        db = rq.result; var tx, g;
        try {
          tx = db.transaction('p', 'readwrite'); g = tx.objectStore('p').getAll();
          g.onsuccess = function () {
            var all = (g.result || []).filter(function (e) { return e && e.sig === SIG; }), st = tx.objectStore('p'), i, bad = g.result || [];
            for (i = 0; i < bad.length; i++) if (!bad[i] || bad[i].sig !== SIG) { try { st.delete(bad[i] && bad[i].key); } catch (x) { } }
            all.sort(function (a, b) { return b.at - a.at; });
            for (i = 0; i < all.length; i++) { if (i >= KEEP) { try { st.delete(all[i].key); } catch (x) { } } else if (!done) mem[all[i].key] = all[i]; }
            arrived = !done;
          };
          tx.oncomplete = tx.onerror = tx.onabort = fin;
        } catch (e) { fin(); }
      };
    },
    take: function (name, K) {   // the saved picture set for this name at this picture scale, or null
      var e; if (!on || !boot) return null; e = mem[name + '|' + K]; if (!e) return null; hits[name] = forced ? collect(e.v) : 1; return e.v;
    },
    built: function (ms) { builtMs += ms; },
    save: function (name, K, thunks) { if (on && boot) queue.push([name, K, thunks]); },   // thunks: { layer: function () { return its pixels } }, read only later, one layer at a time, when the page is idle
    canvas: function (p) {
      var c = document.createElement('canvas'), g, a, b, i; c.width = p.pw; c.height = p.ph; g = c.getContext('2d', { willReadFrequently: true }); g.putImageData(new ImageData(new Uint8ClampedArray(p.b), p.pw, p.ph), 0, 0);
      if (forced) { a = g.getImageData(0, 0, p.pw, p.ph).data; b = new Uint8ClampedArray(p.b); for (i = 0; i < a.length; i++) if (a[i] !== b[i]) mism++; checked += a.length; }   // test copy: the picture read back from the canvas must equal the saved bytes
      return c;
    },
    part: function (c) {   // a picture's pixels, read back a band of rows at a time (the returned _f reads the next band and says whether more are left), so no single read holds the page
      var g = c.getContext('2d', { willReadFrequently: true }), w = c.width, h = c.height, b = new ArrayBuffer(w * h * 4), u = new Uint8ClampedArray(b), y = 0, rows = Math.max(1, Math.floor(120000 / Math.max(1, w)));
      return { pw: w, ph: h, b: b, _f: function () { var n = Math.min(rows, h - y); u.set(g.getImageData(0, y, w, n).data, y * w * 4); y += n; return y < h; } };
    },
    end: function () {   // the first frame is on the screen: remember the timings, then write what was drawn, a layer at a time
      var nm = Object.keys(hits).length, items = queue, put = [], ix = 0, keys, ki, cur, doneRes;
      if (!boot) return; boot = false; queue = [];
      if (ran && nm) stat.r = late ? 9999 : Math.round(readMs * 10) / 10;
      else if (ran && on && !nm && stat.r < 0 && late) stat.r = 9999;
      if (builtMs > 0 && !nm) stat.b = Math.round(builtMs * 10) / 10;
      store();
      if (!on || !items.length || !db) return;
      api.flushed = new Promise(function (res) { doneRes = res; });
      (function next() {
        if (!cur) { if (ix >= items.length) { finish(); return; } cur = { it: items[ix++], v: {}, ks: Object.keys(items[ix - 1][2]), i: 0 }; }
        if (cur.pend && cur.pend.length) { try { if (!cur.pend[0]._f()) { delete cur.pend[0]._f; cur.pend.shift(); } } catch (e) { cur.bad = 1; cur.pend = []; } setTimeout(next, test ? 0 : 30); return; }
        if (cur.i < cur.ks.length) { try { cur.v[cur.ks[cur.i]] = cur.it[2][cur.ks[cur.i]](); cur.pend = []; (function walk(x) { if (!x || typeof x !== 'object') return; if (x._f) { cur.pend.push(x); return; } for (var q in x) walk(x[q]); })(cur.v[cur.ks[cur.i]]); } catch (e) { cur.bad = 1; } cur.i++; setTimeout(next, test ? 0 : 30); return; }
        if (!cur.bad) put.push([cur.it[0] + '|' + cur.it[1], cur.v, cur.it[0]]); cur = null; next();
      })();
      function finish() {
        try {
          var tx = db.transaction('p', 'readwrite'), s = tx.objectStore('p'), j;
          for (j = 0; j < put.length; j++) { rec[put[j][2]] = collect(put[j][1]); s.put({ key: put[j][0], sig: SIG, at: Date.now(), v: put[j][1] }, put[j][0]); }
          tx.oncomplete = tx.onerror = tx.onabort = function () { doneRes(); };
          if (!put.length) doneRes();
        } catch (e) { doneRes(); }
      }
    },
    dump: function () {   // test copy: for each picture set, whether it came from the saved copy or was drawn, and a hash of its pixels
      var o = {}, k; for (k in rec) o[k] = { from: 'drawn', hash: rec[k] }; for (k in hits) o[k] = { from: 'saved', hash: hits[k] }; o.restoredValuesChecked = checked; o.restoredValuesDiffering = mism; return o;
    },
    hashOf: collect
  };
  return api;
})();
