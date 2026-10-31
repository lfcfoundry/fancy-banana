#!/usr/bin/env python3
"""Build Fancy, the Banana: joins head.html + art.js + game.js into one offline HTML file.

Outputs (in dist/):
  bananafly.full.html  readable copy, includes the test hooks (for debugging and checks)
  bananafly.html       player copy: test hooks removed, whitespace trimmed (what the checks run)
  bananafly.readable.html  the player copy WITHOUT minifying (comments and names kept): this is what goes to GitHub
  fancy-the-banana.<stamp>.html  the packed copy for handing out in chat: terser-minified, zopfli-deflated, Ascii85-text,
                         unpacked by a tiny loader with the browser's DecompressionStream (needs a 2023+ browser; no network, no eval)

The build stops loudly on: a stray </script, a <!-- before a <script, size over its ceiling.
Paths come from environment variables so nothing is machine-specific:
  ESBUILD  path to the esbuild program (optional; without it the player copy is only trimmed by a simple pass)
  TERSER   path to terser (optional; default /home/claude/tools/node_modules/.bin/terser; without it the packed copy uses the esbuild output)
  needs the python package zopfli for the packed copy (pip install zopfli); without it zlib level 9 is used
"""
import hashlib, collections, datetime, gzip, json, os, pathlib, re, shutil, subprocess, sys
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent
DIST = ROOT / "dist"
# Size ceilings in bytes. Raising one needs a stated reason (write it in CHANGELOG.md).
CEILINGS = {"full": 900000, "player": 600000}   # Raised to 900,000 and 600,000 on 2026.10.19 (owner rule: size ceilings do not hold back speed-ups while raw performance is the goal; a loose guard that still catches accidents). Before that: Raised to 768,600 and 472,700 on 2026.10.19 (owner chose "Build it" on a card: the triangle filler also runs in WebAssembly, sprite-baker 1.6.0 add-on in wasmbaker.js, plain JavaScript as the fallback; the player copy grows by 15,567 bytes and the full copy by 18,815). Before that: Raised to 749,800 and 457,100 on 2026.10.17 (owner chose "Trim first" on a card: four small pieces, back swipe, screen wake, even frame steps and the quality governor, now come from lean builds of JS-modules back-close 1.2.0, wake-keeper 1.1.0 and frame-kit 1.2.0 in smallparts.js; the player copy grows by 4,011 bytes and the full copy by 8,324, less than the +8.3 KB the card showed for the whole modules). Raised to 741,500 and 453,100 on 2026.10.17 (owner chose "Trim tool first" on a card; with the lean build of sprite-baker 1.5.0 replacing the game's own triangle filler the player copy grows by 5,847 bytes and the full copy by 9,970; pictures identical; player was 447,220 and full 731,520). Raised to 731,520 and 447,220 on 2026.10.17 (owner chose "Update it" on a card: save-kit 1.2.1 instead of 1.2.0, +196 bytes in the player copy and +680 in the full copy). Player raised to 447,020 on 2026.10.17 (owner rule: 'wasm-unsafe-eval' goes into script-src on every page, +19 bytes; the full copy stays at 731,000). Raised to 731,000 and 447,000 on 2026.10.17 (owner approved: the shared save-kit 1.2.1 replaces the game's own save code and save-code reader, a net of about +5.3 KB in the player copy; full was 718,000 and player 443,000). Raised to 718,000 and 443,000 on 2026.10.15 (owner approved: the LFC Foundry header comment, about 1.3 KB; "raise as needed, optimize later"). Full raised to 715,000 on 2026.10.14 (owner approved: group 1 features; the player copy stays under 440,000). Earlier: raised to 700,000 on 2026.10.12 for the code-review fixes and the fuzz-found guards (full was 692,245; the player copy is unchanged at 440,000). Before that: raised to 690,000 / 440,000 on 2026.10.11 (night) for the Chimp Airforce cloud game (about 20 KB). Before that: raised to 660,000 / 420,000 on 2026.10.11 (night) for Fancy's Place, the home base (about 12 KB). Before that: raised to 640,000 / 400,000 on 2026.10.11 (evening) for the ticker facts, the dialog rest and the Lime defense in Chimp's Navy (the full copy was 621,343), with Fancy's home base and the secret areas still to come. Before that: raised to 620,000 / 390,000 on 2026.10.10 (night) for the Gorilla Guard arena (palms, tiered crowd of 4 spectator kinds x 4 moods), the animated gorilla arms and Prince Chimp hands and scepter, and the new rocket flares; the owner asked for the look first and size efficiency later. Before that: raised to 555,000 / 350,000 on 2026.10.10 (evening) for the red submarines and gull, the pay-to-continue option, the redone result cards and Upgrades window, and the moving gates. Earlier notes: set 2026.10.09 round 4: size plus about 5%. Full raised to 300,000 on 2026.10.09 for the QoL round (settings, practice, countdown). Raised to 520,000 / 330,000 on 2026.10.10 for the magnesium-flare launch lights, the run timer and the mini game polish. Raised again (80,700 / 107,000) for animated backgrounds, launch effects, costume picker and upgrade shop.


def fail(msg):
    print("BUILD FAILED:", msg)
    sys.exit(1)


def find_esbuild():
    for c in (os.environ.get("ESBUILD"), shutil.which("esbuild"), "/opt/npm-tools/node_modules/.bin/esbuild"):
        if c and os.path.exists(c):
            return c
    return None


def find_terser():
    for c in (os.environ.get("TERSER"), shutil.which("terser"), "/home/claude/tools/node_modules/.bin/terser", "/tmp/tz/node_modules/.bin/terser"):
        if c and os.path.exists(c):
            return c
    return None


A85 = [chr(c) for c in range(33, 127) if chr(c) not in '"\\<&'][:85]   # 85 printable characters that are safe inside a double-quoted string in a script


def a85(data):
    pad = (-len(data)) % 4
    data += b"\0" * pad
    out = []
    for i in range(0, len(data), 4):
        v = int.from_bytes(data[i:i + 4], "big"); d = []
        for _ in range(5):
            d.append(A85[v % 85]); v //= 85
        out.append("".join(reversed(d)))
    s = "".join(out)
    return s[:len(s) - pad] if pad else s   # the last group is cut by the padding length, like Ascii85


# The cp1252 characters a browser makes of the bytes 0x80 to 0x9F (the WHATWG table, which fills the five gaps with the same-numbered control characters)
CP1252_HI = [8364, 129, 8218, 402, 8222, 8230, 8224, 8225, 710, 8240, 352, 8249, 338, 141, 381, 143, 144, 8216, 8217, 8220, 8221, 8226, 8211, 8212, 732, 8482, 353, 8250, 339, 157, 382, 376]


def lzma_raw(data):
    """Raw LZMA1 (lc=4, lp=0, pb=0 gave the smallest result for this game), without the container header and without the first byte, which is always zero."""
    import lzma
    f = [{"id": lzma.FILTER_LZMA1, "dict_size": 1 << 20, "lc": 4, "lp": 0, "pb": 0, "preset": 9 | lzma.PRESET_EXTREME, "nice_len": 273, "mf": lzma.MF_BT4, "depth": 0}]
    z = lzma.compress(data, format=lzma.FORMAT_RAW, filters=f)
    if z[0] != 0:
        fail("unexpected LZMA stream start")
    return z[1:]


def js_escape(bs):
    """The bytes as the inside of a double-quoted JS string in a page read as windows-1252: only NUL, CR, LF, quote, backslash and a < that could begin </script or <!-- need an escape."""
    out = bytearray()
    for i, b in enumerate(bs):
        if b == 0: out += b"\\x00"
        elif b == 10: out += b"\\n"
        elif b == 13: out += b"\\r"
        elif b == 34: out += b'\\"'
        elif b == 92: out += b"\\\\"
        elif b == 60 and i + 1 < len(bs) and bs[i + 1] in (47, 33): out += b"\\x3c"
        else: out.append(b)
    return bytes(out)


def pack(player_html, head):
    """A tiny page that unpacks the real one: the game is LZMA-compressed, stored as raw bytes (the page is declared windows-1252, so each byte is one character), and
    inflated by a small decoder (lzma-d.js) before document.write. The file must be kept byte for byte: opened and saved as text it stops working (it then says so)."""
    data = player_html.encode("utf-8")
    z = lzma_raw(data)
    # XOR the payload with the key that needs the fewest escapes. The escaped length is counted from how often each byte value (and each "<" followed by "/" or "!") occurs, which gives the same
    # key as escaping all 256 candidates one by one (that took about 8 s of the build; this takes a few milliseconds)
    cnt = collections.Counter(z); pairs = collections.Counter(zip(z, z[1:]))
    def esc_len(k):
        return len(z) + 3 * cnt[k] + cnt[10 ^ k] + cnt[13 ^ k] + cnt[34 ^ k] + cnt[92 ^ k] + 3 * sum(pairs[(60 ^ k, n ^ k)] for n in (47, 33))
    key = min(range(256), key=esc_len)
    body = js_escape(bytes(b ^ key for b in z))
    chk = 0
    for b in data:
        chk = (chk * 31 + b) & 0xFFFFFFFF
    csp = re.search(r'<meta http-equiv="Content-Security-Policy"[^>]*>', head).group(0)
    dec = (ROOT / "lzma-d.js").read_text(encoding="utf-8")
    src = "setTimeout(()=>{" + dec + ("var T=%s,i=0,z=new Uint8Array(s.length),c,o,h=0,t;"
           "for(;i<s.length;i++){c=s.charCodeAt(i);z[i]=(c<256?c:128+T.indexOf(c))^%d}"
           "try{o=lzmaDecode(z,%d);for(i=0;i<o.length;i++)h=(h*31+o[i])>>>0;if(h!=%d)throw 0;t=new TextDecoder().decode(o);document.open();document.write(t);document.close()}"
           "catch(e){document.body.textContent=\"This copy of the game was changed (maybe opened and saved as text, or the download was cut short). Please download it again and open the file itself in a browser.\"}})") % (json.dumps(CP1252_HI, separators=(",", ":")), key, len(data), chk)   # (the % fill is applied to the loader's own text only: the decoder file above has % in its code)
    tz = find_terser()
    if not tz:
        fail("terser is needed to pack the loader")
    r = subprocess.run([tz, "--ecma", "2020", "--compress", "passes=3,toplevel=true", "--mangle", "toplevel=true"], input=src, capture_output=True, text=True)
    if r.returncode != 0:
        fail("terser (loader): " + r.stderr[:300])
    loader = r.stdout.strip().encode("ascii")
    page = (b'<!doctype html><meta charset="windows-1252"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">'
            + csp.encode("ascii") + b'<title>Fancy, the Banana</title><body style="background:#2b2140"><script>var s="' + body + b'"</script><script>' + loader + b'</script>')   # the payload sits in its own script so the minifier cannot fold it (it would see a constant and its length)
    return page, "LZMA, raw bytes"


def check_js(js):
    if re.search(r"</script", js, re.I):
        fail("game.js contains </script (any letter case)")
    if re.search(r"<!--[\s\S]*?<script", js, re.I) and "-->" not in js.split("<script", 1)[0].split("<!--", 1)[-1]:
        fail("game.js contains <!-- followed by <script before any -->")


def minify_css(html):
    def sub(m):
        css = re.sub(r"/\*.*?\*/", "", m.group(2), flags=re.S)
        css = re.sub(r"\s*([{}:;,>])\s*", r"\1", css)
        css = re.sub(r"\s+", " ", css).strip()
        return m.group(1) + css + m.group(3)
    return re.sub(r"(<style>)(.*?)(</style>)", sub, html, flags=re.S)


def stamp():
    """Version stamp: date plus USA Eastern time, YYYY.MM.DD.HHMM (set STAMP to pin one for a repeatable build)."""
    return os.environ.get("STAMP") or datetime.datetime.now(ZoneInfo("America/New_York")).strftime("%Y.%m.%d.%H%M")


def main():
    head = (ROOT / "head.html").read_text(encoding="utf-8")
    art = (ROOT / "art.js").read_text(encoding="utf-8")
    savekit = (ROOT / "savekit.js").read_text(encoding="utf-8")   # save-kit from JS-modules, lean build (see AGENTS.md)
    savekit = "/*! save-kit 1.2.1 (JS-modules, https://github.com/lfcfoundry/JS-modules). Copyright (c) 2026 LFC Foundry. MIT License. */\n" + re.sub(r"^/\*!.*?\*/\s*", "", savekit, count=1, flags=re.S)   # the long header comment stays in savekit.js, not in the page
    game = (ROOT / "game.js").read_text(encoding="utf-8")
    sbk = (ROOT / "spritebaker.js").read_text(encoding="utf-8")
    wsb = (ROOT / "wasmbaker.js").read_text(encoding="utf-8")   # sprite-baker 1.7.0 WebAssembly fill add-on (JS-modules), comments removed; see AGENTS.md
    parts = (ROOT / "smallparts.js").read_text(encoding="utf-8")   # four small pieces from JS-modules, lean builds (see AGENTS.md)
    tgd = (ROOT / "tabguard.js").read_text(encoding="utf-8")   # tab-guard from JS-modules: the second open copy is told at once (see AGENTS.md)
    fxg = (ROOT / "fxgovernor.js").read_text(encoding="utf-8")   # fx-governor 1.1.1 from JS-modules, comments removed: steps the effects down when frames are slow, never back up (see AGENTS.md)
    pck = (ROOT / "piccache.js").read_text(encoding="utf-8")   # keeps the title screen's big pictures in the browser between visits (see AGENTS.md)
    frp = (ROOT / "fieldreport.js").read_text(encoding="utf-8")   # field-report 1.0.2 from JS-modules, comments removed: the hidden speed report and error log (five quick taps in the top-left corner); it comes FIRST so start-up errors are caught
    frp = frp + "\nvar LFCReport = FieldReport.start({ name: 'fancy-banana', version: '__STAMP__' });\n"
    groups = [frp + "\n" + sbk + "\n" + wsb, pck + "\n" + art, savekit + "\n" + parts + "\n" + tgd + "\n" + fxg, game]   # the player copy is shipped as four script blocks, one per group, so the browser compiles them as separate short tasks (no start freeze over 50 ms); top-level names are not renamed, so the blocks share one scope exactly as one block did
    js = "\n".join(groups)
    check_js(js)
    sig = hashlib.sha256(js.encode("utf-8")).hexdigest()[:10]   # names this exact code: saved pictures from any other build are dropped
    if "__PCSIG__" not in js:
        fail("piccache.js has no __PCSIG__ placeholder")
    js = js.replace("__PCSIG__", sig)
    groups = [g.replace("__PCSIG__", sig) for g in groups]
    st = stamp()
    if not re.fullmatch(r"\d{4}\.\d{2}\.\d{2}\.\d{4}", st):
        fail("bad version stamp " + st)
    if "__STAMP__" not in js:
        fail("game.js has no __STAMP__ placeholder")
    js = js.replace("__STAMP__", st)
    groups = [g.replace("__STAMP__", st) for g in groups]
    DIST.mkdir(exist_ok=True)

    full = head + "<script>\n" + js + "\n</script>\n</body>\n</html>\n"
    (DIST / "bananafly.full.html").write_text(full, encoding="utf-8")
    strip_hooks = lambda x: re.sub(r"/\*TEST_HOOK_START\*/.*?/\*TEST_HOOK_END\*/", "", x, flags=re.S)
    player_blocks = [strip_hooks(g) for g in groups]
    player_js = "\n".join(player_blocks)
    if "__bf" in player_js:
        fail("test hooks leaked into the player copy")
    esb = find_esbuild()
    if esb:
        player_blocks = []
        for g in [strip_hooks(g) for g in groups]:
            r = subprocess.run([esb, "--minify", "--target=es2020"], input=g, capture_output=True, text=True)
            if r.returncode != 0:
                fail("esbuild: " + r.stderr[:300])
            player_blocks.append(r.stdout.strip())
        player_js = "\n".join(player_blocks)
        how = "esbuild full minify"
    else:
        how = "NO esbuild found; comments and blank lines only"
        player_js = re.sub(r"^\s*//.*$", "", player_js, flags=re.M)
        player_js = "\n".join(l for l in player_js.splitlines() if l.strip())
    check_js(player_js)
    readable_js = re.sub(r"/\*TEST_HOOK_START\*/.*?/\*TEST_HOOK_END\*/", "", js, flags=re.S)
    (DIST / "bananafly.readable.html").write_text(head + "<script>\n" + readable_js + "\n</script>\n</body>\n</html>\n", encoding="utf-8")
    packed_js = player_js
    nopack = os.environ.get("QA_NOPACK") == "1"   # the checks run on the full and player copies only; qa.py sets this so a check run does not spend ~5 s on a hand-out copy nobody tests. A plain `python3 build.py` makes it.
    tz = None if nopack else find_terser()
    if tz:
        r = subprocess.run([tz, "--ecma", "2020", "--compress", "passes=3", "--mangle"], input=readable_js, capture_output=True, text=True)
        if r.returncode == 0 and len(r.stdout) < len(player_js):
            packed_js = r.stdout
        else:
            print("terser did not help or failed; using the esbuild output for the packed copy", r.stderr[:200])
    check_js(packed_js)
    packed_player = re.sub(r">\s+<", "><", minify_css(head) + "<script>" + packed_js.strip() + "</script></body></html>\n")
    player = minify_css(head) + "".join("<script>" + b + "</script>" for b in player_blocks) + "</body></html>\n"
    player = re.sub(r">\s+<", "><", player)
    (DIST / "bananafly.html").write_text(player, encoding="utf-8")

    # A copy named with its stamp is the file to hand out; older ones are removed so dist/ stays small.
    for old in list(DIST.glob("fancy-the-banana.*.html")) + ([DIST / "bananafly.packedsrc.html"] if nopack else []):
        old.unlink(missing_ok=True)
    if nopack:
        print("packed copy: not made (QA build); run python3 build.py for the copy to hand out")
    else:
        packed, how_p = pack(packed_player, head)
        (DIST / f"fancy-the-banana.{st}.html").write_bytes(packed)
        (DIST / "bananafly.packedsrc.html").write_text(packed_player, encoding="utf-8")   # what the packed copy unpacks to (for the checks)
        print("packed copy:", how_p, ",", len(packed), "bytes")
    print("version stamp:", st)

    # Size table: size, ceiling, change since last build
    prev_file = DIST / "sizes.json"
    prev = json.loads(prev_file.read_text()) if prev_file.exists() else {}
    now, bad = {}, False
    print("Player copy shrunk with:", how)
    print(f"{'output':8} {'bytes':>8} {'gzip':>8} {'ceiling':>8} {'change':>8}")
    for key, name in (("full", "bananafly.full.html"), ("player", "bananafly.html")):
        data = (DIST / name).read_bytes()
        n, gz = len(data), len(gzip.compress(data, 9, mtime=0))
        now[key] = n
        delta = n - prev[key] if key in prev else 0
        flag = ""
        if n > CEILINGS[key]:
            flag, bad = "  OVER CEILING", True
        print(f"{key:8} {n:8} {gz:8} {CEILINGS[key]:8} {delta:+8}{flag}")
    prev_file.write_text(json.dumps(now))
    if bad:
        fail("a build is over its size ceiling")
    print("build ok")


if __name__ == "__main__":
    main()
