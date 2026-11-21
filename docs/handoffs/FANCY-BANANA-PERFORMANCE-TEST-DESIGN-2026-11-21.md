<!-- Copyright (c) 2026 LFC Foundry. MIT License. -->
# Fancy Banana fixed-step play and startup test design

**Baseline:** public main `3c5dc08` (2026-11-08). Read `AGENTS.md`, `src/README.md`, the public README, and the current owner QA handoff before changing anything.

## Scope

The game is a single offline page with generated canvas art and fixed 120-step physics. The repository documents that QA scripts and earlier handoffs live outside this public checkout. Use the supplied owner QA workspace for browser runs; do not invent missing scripts or treat `window.__bf` test hooks as shipped API. This document is a test plan only.

## Correctness and timing matrix

Use identical seeds, save states, and inputs for paired runs. Cover the public title/play/pause/game-over flows and publicly documented stages without naming or exposing hidden unlocks.

| Dimension | Permutations |
|---|---|
| Display cadence | 30, 60, 90, 120 Hz; irregular 20/50/100 ms frame gaps; background/foreground; one long stall followed by resume. Physics must advance by fixed simulation steps, not display frames. |
| Speed and comfort | Default and each documented slower-speed choice; calm/reduced-motion on/off; left/right-handed control layout. Keep each setting’s expected timing and input mapping separate. |
| Input | Touch, mouse, Space, repeated taps, long press, pointer cancellation, focus loss, and two simultaneous touch points. Do not extrapolate synthetic touch to physical Android input. |
| Workload | Clean start, returning save, high but valid public progress, busy public gameplay scene, pause/resume, stage transition, and repeated restart. |
| Browser state | Fresh and warm page; offline; storage available/blocked; one open tab and competing tab. Preserve current save and tab-guard semantics. |
| Device | 320–412 CSS-pixel phone, tablet, desktop; DPR 1/2/3; software-rendered and hardware-backed contexts when available. Record engine, OS, refresh rate, viewport and power state. |

Measure page load, art preparation, first interactive frame, input-to-next simulation step, draw cost, frame-gap distribution, and resume delay separately. Compare full/minified outputs and packed output only through the project’s own build and QA pipeline. Do not include browser startup or fixture creation in steady-state timings.

## Required invariants

For the same seed and input trace, gate positions, score, save fields, and end state must match across display cadences. A long frame may cause catch-up work but must not change the fixed-step result or create an unbounded catch-up spiral. Cancellation, pause, hidden-tab, and native-dialog paths must stop game-owned timers and resume once. Calm mode, accessibility controls, offline operation, and public wording are regression controls.

Use the owner’s approved browsers one at a time. Record the test versions and raw paired samples. Any change to game feel, physics, scoring, save format, size ceiling, permissions, or hidden content requires the owner’s explicit decision; a timing result alone is not that decision.
