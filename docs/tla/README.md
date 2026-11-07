# Capkeep TLA+ model

`Capkeep.tla` models the sim's wave clock, economy, and phase machine
(prep → combat → victory/defeat), including the Auto/Manual march toggle
and the scene pause that freezes the sim.

Run it (needs a `tla2tools.jar`, not vendored):

```bash
java -cp tla2tools.jar tlc2.TLC -config Capkeep.cfg Capkeep.tla
```

Get the jar from the TLA+ releases page, then run from this directory.

Reading map:

- `Init` encodes the BattleScene contract: Auto marches arm the prep clock.
- `ToggleAuto` encodes the 2026-11-06 fix: re-enabling Auto in prep re-arms it.
- `Invariants` is the safety bundle; `AutoPrepLiveness` / `AutoTerminates`
  are the liveness claims. See `../capkeep-forward-plan.md` for verdicts.
