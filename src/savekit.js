/*!
 * save-kit.js: safe localStorage saves, a rolling backup slot, and checksummed copy-paste save codes.
 * Part of JS-modules, https://github.com/lfcfoundry/JS-modules
 * Copyright (c) 2026 LFC Foundry. MIT License (see LICENSE at the repository root).
 * Version 1.4.0 (API 1)
 * LEAN BUILD without: autosave, compact, large, migrate, nativeBase64, persist, raw, skipUnchanged, stageImport, twoTap. Made by modules/save-kit/lean.py; the cut parts are missing on purpose.
 *
 * What it gives you
 *  - validate(): rebuilds a state object from untrusted data using a field schema. Every field falls back on its own, so one
 *    damaged number never costs the rest of the save. Prototype-pollution keys are dropped. Counts are capped.
 *  - save(): refuses to write when a number is NaN/Infinity/negative (a bug must never overwrite good progress),
 *    stamps `seen`, and copies the last good save to a backup slot at most once a minute. Never throws.
 *  - load(): reads the main slot and the backup slot and rebuilds the state from the better one, field by field with
 *    validate(), so one bad number costs only that number. Returns null only when neither slot holds an object.
 *  - exportCode()/importCode(): 'AB1z.<base64url>.<7-char check>' codes (deflate-raw squeezed where the browser can, and
 *    only when that is actually shorter). The check catches a code that was cut off while copying. Pasted text is refused
 *    when it is too long, and unpacking stops when the result passes a limit (see create() below).
 *  - autosave(): timer + pagehide + visibilitychange, because phones close hidden pages without warning.
 *  - twoTap(): "tap again to confirm" helper for destructive buttons (pop-up confirm() is often unavailable).
 *  - onOtherTab(cb): tells you when another tab of the same game wrote a save (so an old tab can stop overwriting a newer one).
 *  - persist(): asks the browser not to delete this site's storage when space runs low. Resolves true/false, never rejects.
 *  - Options added in 1.2.0 (all off unless given; they let a game that already has saves in the wild move to save-kit without breaking them):
 *    codeCheck ('hex8' = 8 hex characters, 'plain36' = base 36 without leading zeros, for codes written before save-kit), backupKey (name of the backup slot),
 *    damagedKey (keeps main-slot text that could not be used), readBackupWithoutMain:false (an empty main slot never brings back a leftover backup),
 *    afterValidate(clean, raw) (the game's own checks after the schema), stamp (name of the timestamp field, default 'seen').
 *    modules/save-kit/lean.py makes a smaller file without the parts a game does not use.
 *  - Options added in 1.1.0 (all off unless given): version + migrate (upgrade old saves), skipUnchangedMs (fewer storage writes),
 *    compactCodes (shorter codes: leaves out `seen` and fields equal to their default).
 *
 * Notes
 *  - `seen` (a timestamp) is stamped on every save and export, and removed again by load()/validate() unless your schema lists it.
 *  - 'counts' and 'raw' results: counts objects have NO prototype (Object.create(null)), so use SaveKit.has(obj, key) instead of
 *    obj.hasOwnProperty(key). 'raw' results are plain objects with __proto__/constructor/prototype keys removed.
 *
 * Schema types (strings): 'num' finite >= 0 | 'int' whole >= 0 | 'flag' 0 or 1 (a missing or broken value uses the default, so a
 *   new on-by-default setting stays on for returning players) | 'str:N' string up to N chars |
 *   'int:N' whole 0..N | 'counts' map of name -> whole number (>0, capped at 1e6) |
 *   { type:'counts', max:20, maxKeys:500 } (max = biggest value, maxKeys = most names kept, default 1000) |
 *   { type:'int', max:99 } | { type:'str', max:20 } | { type:'raw' } (kept as-is if JSON-plain, use sparingly)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SaveKit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var trusted = false;
  var BAD_KEYS = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };
  var DEFAULT_MAX_KEYS = 1000;
  var DEFAULT_MAX_BYTES = 262144;
  var TOO_BIG = 'That code is too big to open. Copy only the code and try again.';
  var DAMAGED = 'That code is damaged.';
  var INCOMPLETE = 'That code is not complete. Copy the whole code and try again.';

  function bag() { return Object.create(null); }
  function isNum(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }
  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  function norm(spec) {
    if (spec && typeof spec === 'object') return spec;
    var m = /^(\w+)(?::(\d+))?$/.exec(String(spec)) || [];
    return { type: m[1] || 'raw', max: m[2] ? +m[2] : undefined };
  }

  function cleanField(spec, v, d) {
    spec = norm(spec);
    switch (spec.type) {
      case 'num': return isNum(v) ? v : d;
      case 'int': return isNum(v) ? Math.min(Math.floor(v), spec.max == null ? Number.MAX_SAFE_INTEGER : spec.max) : d;
      case 'flag': return v === 1 ? 1 : v === 0 ? 0 : (d === 1 ? 1 : 0);
      case 'str': return typeof v === 'string' && v.length <= (spec.max === 0 ? 0 : spec.max || 200) ? v : (d == null ? '' : d);
      case 'counts':
        var out = bag(), kept = 0, maxKeys = spec.maxKeys === 0 ? 0 : spec.maxKeys > 0 ? spec.maxKeys : DEFAULT_MAX_KEYS;
        if (!isObj(v)) v = d;
        if (!isObj(v)) return out;
        var ks = Object.keys(v), cap = spec.max === 0 ? 0 : spec.max || 1e6, i, k, n;
        for (i = 0; i < ks.length; i++) {
          k = ks[i];
          if (BAD_KEYS[k] || k.length > 200 || kept >= maxKeys) continue;
          n = v[k];
          if (cap > 0 && typeof n === 'number' && isFinite(n) && n > 0) { out[k] = Math.min(Math.floor(n), cap); kept++; }
        }
        return out;
      default: return d;
    }
  }

  function validate(schema, defaults, input) { return validateWith(fieldsOf(schema), defaults, input); }

  function fieldsOf(schema) {
    var ks = Object.keys(schema), f = [], i;
    for (i = 0; i < ks.length; i++) f.push([ks[i], norm(schema[ks[i]])]);
    return f;
  }
  function validateWith(fields, defaults, input) {
    var out = {}, i, k;
    input = isObj(input) ? input : {};
    for (i = 0; i < fields.length; i++) {
      k = fields[i][0];
      out[k] = cleanField(fields[i][1], has(input, k) ? input[k] : undefined, defaults ? defaults[k] : undefined);
    }
    return out;
  }

  function isSound(state, keys) {
    for (var i = 0; i < keys.length; i++) { var v = state[keys[i]]; if (v !== undefined && !isNum(v)) return false; }
    return true;
  }

  function countsSound(v) {
    if (!isObj(v)) return true;
    var ks = Object.keys(v);
    for (var i = 0; i < ks.length; i++) if (!isNum(v[ks[i]])) return false;
    return true;
  }

  function checksum(t, style) {
    var h = 0x811c9dc5;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return style === 'hex8' ? ('00000000' + h.toString(16)).slice(-8) : style === 'plain36' ? h.toString(36) : ('0000000' + h.toString(36)).slice(-7);
  }

  function toB64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64(t) {
    var bin = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  var squeezes = null;
  function canSqueeze() {
    if (squeezes === null) { try { new CompressionStream('deflate-raw'); new DecompressionStream('deflate-raw'); squeezes = true; } catch (e) { squeezes = false; } }
    return squeezes;
  }
  function deflate(bytes) {
    var out = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Response(out).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function inflate(bytes, limit) {
    return new Promise(function (resolve, reject) {
      var reader, chunks = [], total = 0;
      try { reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(); } catch (e) { reject(DAMAGED); return; }
      function pump() {
        reader.read().then(function (r) {
          if (r.done) {
            var out = new Uint8Array(total), at = 0;
            chunks.forEach(function (c) { out.set(c, at); at += c.length; });
            resolve(out); return;
          }
          total += r.value.length;
          if (total > limit) { try { reader.cancel().then(null, function () {}); } catch (e) {} reject(TOO_BIG); return; }
          chunks.push(r.value);
          pump();
        }, function () { reject(DAMAGED); });
      }
      pump();
    });
  }
  function escapeRe(t) { return t.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&'); }

  function durableMirror(name, given) {
    var idb = given !== undefined ? given : typeof indexedDB !== 'undefined' ? indexedDB : null, dbp = null, busy = false, pend = null, waiters = [], boot;
    function db() {
      if (!dbp) dbp = new Promise(function (ok) {
        if (!idb) { ok(null); return; }
        try {
          var rq = idb.open(name, 1);
          rq.onupgradeneeded = function () { rq.result.createObjectStore('slots'); };
          rq.onsuccess = function () { var d = rq.result; d.onversionchange = d.onclose = function () { try { d.close(); } catch (e) {} dbp = null; }; ok(d); };
          rq.onerror = rq.onblocked = function () { dbp = null; ok(null); };
        } catch (e) { dbp = null; ok(null); }
      });
      return dbp;
    }
    function read() {
      return db().then(function (d) {
        return new Promise(function (ok) {
          if (!d) { ok(null); return; }
          try { var rq = d.transaction('slots', 'readonly').objectStore('slots').get('main'); rq.onsuccess = function () { ok(rq.result || null); }; rq.onerror = function () { ok(null); }; } catch (e) { ok(null); }
        });
      });
    }
    function done(r) { var w = waiters; waiters = []; for (var i = 0; i < w.length; i++) w[i](r); }
    function run() {
      if (busy || !pend) return;
      busy = true;
      var job = pend; pend = null;
      boot.then(db).then(function (d) {
        return new Promise(function (ok) {
          if (!d) { ok(false); return; }
          try {
            var t = d.transaction('slots', 'readwrite', { durability: 'strict' });
            t.objectStore('slots').put(job, 'main');
            t.oncomplete = function () { ok(true); }; t.onerror = t.onabort = function () { ok(false); };
          } catch (e) { ok(false); }
        });
      }).then(function (r) { busy = false; if (pend) run(); else done(r); });
    }
    boot = read();
    return {
      boot: boot,
      write: function (t, at) { pend = { t: t, n: t.length, at: at }; run(); },
      flushed: function () { return !busy && !pend ? Promise.resolve(true) : new Promise(function (ok) { waiters.push(ok); }); }
    };
  }

  function durableCopy(name, o) {
    var m = durableMirror(String(name || 'save-kit-durable'), o && 'indexedDB' in o ? o.indexedDB : undefined);
    return {
      write: function (text, seq) { if (typeof text === 'string' && isNum(seq)) m.write(text, seq); },
      newer: function (seq) {
        return m.boot.then(function (r) { return r && typeof r.t === 'string' && r.t.length === r.n && isNum(r.at) && r.at > (isNum(seq) ? seq : -Infinity) ? { text: r.t, seq: r.at } : null; }, function () { return null; });
      },
      flushed: m.flushed
    };
  }

  function create(o) {
    o = o || {};
    var key = o.key, schema = o.schema || {}, defaults = o.defaults || {}, prefix = o.prefix || 'SK1';
    var storage = o.storage || null;
    if (!storage) { try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { storage = null; } }
    var maxBytes = o.maxCodeBytes > 0 ? o.maxCodeBytes : DEFAULT_MAX_BYTES;
    var maxChars = o.maxCodeChars > 0 ? o.maxCodeChars : Math.ceil(maxBytes * 4 / 3) + 1024;
    var fields = fieldsOf(schema);
    var kinds = function (t) { return fields.filter(function (f) { return f[1].type === t; }).map(function (f) { return f[0]; }); };
    var soundKeys = o.soundKeys || kinds('num').concat(kinds('int'));
    var countKeys = kinds('counts');
    var re = new RegExp(escapeRe(prefix) + '([zp])\\.([A-Za-z0-9_-]+)\\.');
    var style = o.codeCheck;
    var off = false, backupAt = 0, backupEvery = o.backupEveryMs == null ? 60000 : o.backupEveryMs;
    var stamp = o.stamp || 'seen', bak = o.backupKey || key + '-backup', damaged = o.damagedKey || '', after = typeof o.afterValidate === 'function' ? o.afterValidate : null;
    var orphan = o.readBackupWithoutMain !== false;

    var mirror = o.durable ? durableMirror(o.durable === true ? 'save-kit-durable:' + key : String(o.durable), o.indexedDB) : null, loadedAt = null;

    function upgrade(raw) { return raw; }

    function badFields(x) {
      var n = 0, i, v;
      for (i = 0; i < soundKeys.length; i++) { v = x[soundKeys[i]]; if (v !== undefined && !isNum(v)) n++; }
      for (i = 0; i < countKeys.length; i++) if (!countsSound(x[countKeys[i]])) n++;
      return n;
    }
    function soundState(x) { return isObj(x) && badFields(x) === 0; }
    function textOf(slot) { try { return storage.getItem(slot); } catch (e) { return undefined; } }
    var plainText = new WeakSet(), hasRaw = kinds('raw').length > 0;
    function parseSlot(t) {
      try {
        var x = JSON.parse(t || 'null');
        if (isObj(x)) { if (hasRaw && t.indexOf('__proto__') < 0 && t.indexOf('constructor') < 0 && t.indexOf('prototype') < 0) plainText.add(x); return x; }
      } catch (e) {}
      return null;
    }
    function readSlot(slot) { return parseSlot(textOf(slot)); }

    function finish(raw) {
      var c, r, was = trusted;
      trusted = plainText.has(raw) && !(typeof migrate !== 'undefined' && migrate && version && isNum(raw.v) && raw.v < version);
      try { c = validateWith(fields, defaults, upgrade(raw)); } finally { trusted = was; }
      if (!after) return c;
      try { r = after(c, raw); } catch (e) { return c; }
      return r === false || r === null ? null : isObj(r) ? r : c;
    }
    var api = {
      validate: function (input) { return validateWith(fields, defaults, input); },

      load: function () {
        try {
          var mt = textOf(key), a = parseSlot(mt), b = null, first, second, out = null, used = null;
          if (mt === null && !orphan) return null;
          if (!a || badFields(a) > 0) b = readSlot(bak);
          if (a || b) {
            first = !b ? a : !a ? b : (badFields(b) < badFields(a) ? b : a);
            out = finish(first); used = first;
            if (!out) {
              second = first === a ? (b || readSlot(bak)) : a;
              out = second ? finish(second) : null; used = second;
            }
          }
          if (damaged && mt && (!a || used !== a)) { try { storage.setItem(damaged, mt); } catch (e) {} }
          loadedAt = used && isNum(used[stamp]) ? used[stamp] : 0;
          return out;
        } catch (e) { return null; }
      },

      save: function (state, force) {
        try {
          if (off || !storage || !soundState(state)) return false;
          var now = Date.now(), probe = null;
          state[stamp] = now;
          var txt = JSON.stringify(state);
          storage.setItem(key, txt);
          if (mirror) mirror.write(txt, now);
          if (Date.now() - backupAt > backupEvery) {
            try { storage.setItem(bak, txt); backupAt = Date.now(); } catch (e) {  }
          }
          return true;
        } catch (e) {
          return false;
        }
      },
      forceBackupNext: function () { backupAt = 0; },

      recover: function () {
        if (!mirror) return Promise.resolve(null);
        return mirror.boot.then(function (rec) {
          try {
            if (off || !rec || typeof rec.t !== 'string' || rec.t.length !== rec.n) return null;
            var base = loadedAt;
            if (base === null) { var l = readSlot(key); base = l && isNum(l[stamp]) ? l[stamp] : 0; }
            if (isNum(rec.at) && rec.at <= base) return null;
            var x = parseSlot(rec.t);
            if (!x || badFields(x) > 0 || !isNum(x[stamp]) || x[stamp] <= base) return null;
            var out = finish(x);
            if (out) { try { storage.setItem(key, rec.t); } catch (e) {} }
            return out;
          } catch (e) { return null; }
        });
      },

      flushed: function () { return mirror ? mirror.flushed() : Promise.resolve(false); },

      pause: function (v) { off = v !== false; },

      exportCode: function (state) {
        try {
          if (!isObj(state)) return Promise.reject('There is nothing to make a code from yet.');
          if (!soundState(state)) return Promise.reject('A number in the game is broken, so no code was made. Reload the page and try again.');
          try { state[stamp] = Date.now(); } catch (e) {}
          var body = state;
          var raw = new TextEncoder().encode(JSON.stringify(body));
          if (raw.length > maxBytes) return Promise.reject('This save is too big to turn into a code.');
          var plain = toB64(raw);
          var done = function (flag, d) { return prefix + flag + '.' + d + '.' + checksum(d, style); };
          if (!canSqueeze()) return Promise.resolve(done('p', plain));
          return deflate(raw).then(function (b) { var z = toB64(b); return z.length < plain.length ? done('z', z) : done('p', plain); }, function () { return done('p', plain); });
        } catch (e) { return Promise.reject('This save could not be turned into a code.'); }
      },

      importCode: function (text) {
        try {
          var t = String(text == null ? '' : text);
          if (t.length > maxChars) return Promise.reject(TOO_BIG);
          var flat = t.replace(/\s+/g, '');
          var m = re.exec(flat);
          if (!m) return Promise.reject(flat.indexOf(prefix) >= 0 ? INCOMPLETE : 'That is not a save code for this game.');
          var want = checksum(m[2], style);
          if (flat.substr(m.index + m[0].length, want.length) !== want) return Promise.reject(INCOMPLETE);
          var bytes;
          try { bytes = fromB64(m[2]); } catch (e) { return Promise.reject(DAMAGED); }
          var get;
          if (m[1] === 'z') get = canSqueeze() ? inflate(bytes, maxBytes) : Promise.reject('This browser cannot open that code. Try a newer browser.');
          else get = bytes.length > maxBytes ? Promise.reject(TOO_BIG) : Promise.resolve(bytes);
          return get.then(function (b) {
            var x = JSON.parse(new TextDecoder().decode(b));
            if (!soundState(x)) throw 0;
            x = finish(x);
            if (!x) throw 0;
            return x;
          }).catch(function (e) { throw typeof e === 'string' ? e : DAMAGED; });
        } catch (e) { return Promise.reject(DAMAGED); }
      },

      onOtherTab: function (cb) {
        if (typeof window === 'undefined' || !window.addEventListener || typeof cb !== 'function') return function () {};
        function on(e) {
          if (e.key !== null && e.key !== key) return;
          if (e.storageArea && storage && e.storageArea !== storage) return;
          var x = null, clean = null;
          try { x = e.newValue == null ? null : JSON.parse(e.newValue); } catch (err) {}
          try { if (isObj(x)) clean = finish(x); } catch (err) {}
          try { cb(clean, e); } catch (err) {}
        }
        window.addEventListener('storage', on);
        return function () { window.removeEventListener('storage', on); };
      },
    };
    return api;
  }

  return {
    create: create,
    durableCopy: durableCopy,
    validate: validate, isSound: isSound,
    checksum: checksum, toBase64Url: toB64, fromBase64Url: fromB64,
    bag: bag, has: has
  };
});
