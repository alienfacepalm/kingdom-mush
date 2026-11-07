# Capkeep: TLA+ / refuter / gap & optimization report (2026-11-06)

Purpose: plan forward from evidence, not vibes. Three lenses were used:

1. **TLA+ model** — `docs/tla/Capkeep.tla` (+ `Capkeep.cfg`), checked with TLC.
2. **Adversarial refuter** — an independent Wonder-model review tasked with
   refuting five claimed invariants, plus a seeded random-adversary fuzz
   (`tests/refute.test.ts`) that asserts the TLA safety bundle after every action.
3. **Gap & optimization scan** — sim/scene boundary, CI, art pipeline, perf.

## Verdicts

| # | Claim | Verdict |
|---|---|---|
| 1 | Gold ≥ 0; refund ≤ spent per tower; no duplicate tower per slot | **Confirmed** (code review + fuzz; refund asserted exact, not just bounded) |
| 2 | Lives ∈ [0, level.lives]; defeat only at 0; victory only when final wave started, queue empty, no living foes | **Confirmed** |
| 3 | `waveStarted` monotone, ≤ waves; each wave called at most once; early bonus only from a live countdown | **Confirmed** |
| 4 | Auto eventually starts wave 1; Manual never self-starts; toggling cannot double-call or lose a wave | **Refuted, then fixed** (see F1) |
| 5 | Phase machine is prep → combat → {victory, defeat}; terminal phases take no orders | **Confirmed** |

### F1 — Auto toggle in prep lost the march (fixed)

Counterexample found by the refuter:

```ts
const sim = new Sim(LEVELS[0], NEUTRAL_BONUSES, rng);
sim.armPrep();
sim.setAutoWaves(false);   // disarmed the prep clock
sim.setAutoWaves(true);    // did NOT re-arm it
stepMany(sim, 60);         // waveStarted stays 0 forever
```

Fix: `Sim.setAutoWaves(true)` in prep with no clock running now re-arms the
prep countdown (prep pays no early bonus, so there is no gold exploit).
Covered by `tests/rules.test.ts` ("re-arms prep when Auto is switched back
on before wave 1") and by the toggle-sequence fuzz in `tests/refute.test.ts`.

### TLA+ / TLC

- **Final verdict: TLC clean.** "Model checking completed. No error has
  been found" — all safety invariants plus both liveness properties,
  25,192 distinct states, depth 32, ~3s at the `Capkeep.cfg` constants.
  (Two modeling lessons en route: ledger counters made the state space
  infinite and were replaced by the `GoldBounded`/`SpentBounded`
  invariants; refund ≤ spend is enforced by the `Sell` action itself.)
- First temporal run **refuted** `AutoPrepLiveness`: an adversary who
  builds/sells or toggles Auto forever starves the discrete clock. This is
  partly a modeling artifact (real time passes during player actions) and
  partly real (toggle-spam restarts prep). Liveness therefore holds under
  the stated fairness assumption: the player eventually settles, unpaused,
  in Auto (`Fairness == … /\ <>[](~paused /\ auto)`).
- See `docs/tla/README.md` for how to re-run. The jar is not vendored.

## Gaps

| ID | Gap | Risk | Where |
|---|---|---|---|
| G1 | Pause exists only in the scene (`update` skips `sim.step`); the sim itself accepts orders while "paused" | Low in play, real for any future replay/test harness | `BattleScene.ts:189` vs `Sim.ts` |
| G2 | Sim state is publicly mutable (`gold`, `lives`, `phase`, `towers[].spent`, …); invariants hold only via the API. Tests even use `sim.gold += 500` | Medium: future code can silently break every proof above | `Sim.ts:25,137-149` |
| G3 | A bare `new Sim()` has `autoWaves=true` but no armed prep; arming is a scene contract (`armPrep()` in `create`) | Low; undocumented contracts rot | `BattleScene.ts:157-158`, model `Init` |
| G4 | Toggle-spam restarts the 20s prep clock from full | Low; annoying, arguably player-caused. Decide: resume remaining time instead | `Sim.setAutoWaves/disarmAutoClock` |
| G5 | CI (Pages workflow) runs `pnpm build` only — no `pnpm test`, no TLC | Medium: regressions ship silently | `.github/workflows/pages.yml` |
| G6 | Painted backgrounds contain props (bushes/rocks) with no clearance data; pads/call markers were placed by eye and overlapped art (fixed for Glass Cut 2026-11-06) | Medium: recurs on any regenerated background | `tools/art/*`, `levels.ts` slots/callSpot |
| G7 | Creatures are single frames with procedural hop/squash; no walk/attack cycles | Visual only; biggest remaining distance to the reference look | `BattleScene.syncBodies` |
| G8 | Save has no schema version/migration beyond field defaults (`autoWaves` default true) | Low now, grows with each new setting | `src/content/save.ts` |
| G9 | HEAD as found did not type-check (`nearestEnemy` dead method, TS6133), so `pnpm build` failed despite tests passing | High if pushed: Pages build would break. Dead method removed in this pass | `Sim.ts` (was :1092) |

## Optimization opportunities

| ID | Item | Evidence | Expected gain |
|---|---|---|---|
| O1 | HP bars call `getBounds()` per foe/actor per frame | `BattleScene.ts:632,642` | Fewer layout computations per frame; bars can reuse the sprite's known origin/height |
| O2 | `[...actors, hero]` array allocated every frame in the HP-bar pass | `BattleScene.ts:640` | Less GC churn; iterate actors then hero separately |
| O3 | Wave-preview recomputed per frame while open (`upcomingGroups` allocates) | `BattleScene.ts:759` | Cache until `waveStarted`/queue changes |
| O4 | Main bundle ≈ 1.56 MB (gzip ≈ 364 kB), Vite warns > 500 kB; no code-split | `pnpm build` output | Lazy-load Phaser scenes or set `manualChunks`; faster first paint on Pages |
| O5 | Atlas is 2048×512, 76 frames — healthy; backgrounds are 5 × 1280×720 JPG | `public/art/` | Leave; revisit only if more levels land (consider WebP) |
| O6 | Strategy/balance sims exist in tests but produce no report artifact | `tests/strategy.ts` | A `pnpm balance` script printing win-rate/lives-left per level would make tuning auditable |

## Forward plan (proposed order)

**Phase 1 — lock the proofs in (small)**
1. CI: add `pnpm test` (and the fuzz) to the Pages workflow; optionally a
   nightly TLC job with the jar downloaded in CI. [G5]
2. Decide G4 (resume vs restart prep on toggle) and encode the choice in
   the TLA `ToggleAuto` action + a test.
3. Add an art-clearance lint: extend `tools/art/backgrounds.py` checks to
   fail when a pad/callSpot sits on a painted prop (reuse the road-distance
   machinery with a prop mask). [G6]

**Phase 2 — harden the sim boundary (medium)**
4. Give `Sim` a real pause: `sim.paused` gates `step` and orders; the scene
   just flips it. Update the TLA `paused` handling to match (it already
   models pause as step-blocking). [G1]
5. Encapsulate mutable state behind getters (or `readonly` views) so the
   invariant surface is the API the refuter actually checked. [G2]

**Phase 3 — feel & reach (larger, optional)**
6. Cheap perf pass O1–O3, then bundle split O4.
7. Two-frame walk cycles from the existing sheets (slice a second pose per
   creature) to close the G7 animation gap.
8. `pnpm balance` report (O6) before any new level work.

## Status — 2026-11-06 product pass

Repo renamed on GitHub to `CapKeep` (base `/CapKeep/`, Pages path updated).
Shipped from the phases above: sim pause gate [G1], prep resume across the
Auto toggle [G4], perf O1–O3 (no per-frame `getBounds`/spread, cached wave
preview), Phaser chunk split O4 (game code 82 KB, Phaser 1.48 MB cached
separately). Variants added as a real product layer (`src/content/variants.ts`):
Campaign/Heroic/Iron/Endless modes, Casual/Normal/Veteran difficulties, and
three heroes (Warden Puff, Bramble the Broad, Sable the Swift), picked in the
map brief and preserved across retry/next. Still open: art-clearance lint
[G6], state encapsulation [G2], walk cycles [G7], `pnpm balance` [O6].

## Method note

Claims above were checked three ways where possible: manual code citation
(refuter), randomized execution (fuzz, 30/30 tests green at time of writing),
and exhaustive small-state exploration (TLC safety bundle). Liveness claims
are the weakest link: they depend on the fairness assumption stated in the
spec, which is a product decision, not a theorem about an adversarial player.
