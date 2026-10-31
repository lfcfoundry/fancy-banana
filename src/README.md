# Source and rebuild

`play/index.html` (the game) is the minified build of the files in this folder, shipped as four script blocks (one per group in build.py). They are the readable source, with all comments, and they are what to edit.

Rebuild (needs Python 3.9 or newer and esbuild 0.28.2):

```
cd src
ESBUILD=/path/to/esbuild STAMP=2026.10.23.2236 QA_NOPACK=1 python3 build.py
cmp dist/bananafly.html ../play/index.html     # no output means the same file, byte for byte
```

`dist/bananafly.full.html` is the same game with its test hooks and readable code (for debugging); `dist/bananafly.html` is the shipped build. Leave `STAMP` out to stamp the build with the current US Eastern time (YYYY.MM.DD.HHMM). The checks that run on these files (picture gate, smoke runs, fuzzer) live outside this repository.

Pieces taken from the JS-modules repository (lean builds, comments removed): save-kit, sprite-baker with its WebAssembly add-on, fx-governor, field-report, tab-guard. The WebAssembly is built from the sprite-baker source in JS-modules.
