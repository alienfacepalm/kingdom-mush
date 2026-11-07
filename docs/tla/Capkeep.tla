------------------------------ MODULE Capkeep ------------------------------
(***************************************************************************)
(* Capkeep wave / economy / phase model.                                   *)
(*                                                                         *)
(* Abstracts src/sim/Sim.ts + the BattleScene pause contract:              *)
(*  - enemy internals become queue/alive counters, kills, and leaks,       *)
(*  - towers are (tier, spent) per slot, so duplicate-slot builds are      *)
(*    unrepresentable and refunds are checked against recorded spend,      *)
(*  - time is a discrete clock in seconds; the scene pause is an           *)
(*    environment flag that blocks Tick (BattleScene.update skips step).   *)
(*                                                                         *)
(* No ledger counters: a build/sell loop would grow them forever and       *)
(* make the state space infinite. Economy soundness is instead the         *)
(* per-action refund rule plus the global GoldBounded invariant.           *)
(*                                                                         *)
(* Check with:  java -cp tla2tools.jar tlc2.TLC Capkeep                   *)
(* (tla2tools.jar is not vendored; see docs/tla/README.md)                 *)
(***************************************************************************)
EXTENDS Integers, FiniteSets

CONSTANTS
    Waves, Slots, StartGold, StartLives,
    Prep,         \* prep seconds before wave 1 in Auto (Sim.PREP_SECONDS = 20)
    Gap,          \* seconds between waves (level wave gap)
    SpawnCount, BuildCost, UpgradeCost,
    Bounty,       \* gold per kill (abstract)
    BonusPerSec   \* early-call gold per second left (abstract)

VARIABLES
    phase,        \* "prep" | "combat" | "victory" | "defeat"
    gold, lives,
    waveStarted,  \* 0..Waves, monotone
    countingDown, clock,
    queue, alive,
    tier,         \* Slots -> 0..4   (0 = empty)
    spent,        \* Slots -> Nat
    auto, paused

vars == <<phase, gold, lives, waveStarted, countingDown, clock, queue, alive,
          tier, spent, auto, paused>>

Terminal == phase \in {"victory", "defeat"}
AcceptsOrders == phase \in {"prep", "combat"}
Refund(s) == (spent[s] * (IF waveStarted = 0 THEN 1 ELSE 3))
             \div (IF waveStarted = 0 THEN 1 ELSE 5)   \* 1.0, else 0.6
MaxClock == Prep + Gap

CanCall ==
    /\ ~Terminal /\ queue = 0 /\ waveStarted < Waves
    /\ (waveStarted = 0 \/ countingDown)

Init ==
    /\ auto \in BOOLEAN /\ paused = FALSE
    /\ phase = "prep" /\ gold = StartGold /\ lives = StartLives
    /\ waveStarted = 0
    \* Scene contract (BattleScene.create): Auto marches arm the prep clock.
    /\ countingDown = auto /\ clock = IF auto THEN Prep ELSE 0
    /\ queue = 0 /\ alive = 0
    /\ tier = [s \in Slots |-> 0] /\ spent = [s \in Slots |-> 0]

-----------------------------------------------------------------------------
Build(s) ==
    /\ AcceptsOrders /\ tier[s] = 0 /\ gold >= BuildCost
    /\ gold' = gold - BuildCost
    /\ tier' = [tier EXCEPT ![s] = 1] /\ spent' = [spent EXCEPT ![s] = BuildCost]
    /\ UNCHANGED <<phase, lives, waveStarted, countingDown, clock, queue, alive, auto, paused>>

Upgrade(s) ==
    /\ AcceptsOrders /\ tier[s] \in 1..3 /\ gold >= UpgradeCost
    /\ gold' = gold - UpgradeCost
    /\ tier' = [tier EXCEPT ![s] = tier[s] + 1]
    /\ spent' = [spent EXCEPT ![s] = spent[s] + UpgradeCost]
    /\ UNCHANGED <<phase, lives, waveStarted, countingDown, clock, queue, alive, auto, paused>>

Sell(s) ==
    /\ AcceptsOrders /\ tier[s] > 0
    /\ gold' = gold + Refund(s)          \* Refund(s) <= spent[s] by construction
    /\ tier' = [tier EXCEPT ![s] = 0] /\ spent' = [spent EXCEPT ![s] = 0]
    /\ UNCHANGED <<phase, lives, waveStarted, countingDown, clock, queue, alive, auto, paused>>

StartWave(withBonus) ==
    /\ CanCall
    /\ gold' = gold + (IF withBonus /\ countingDown /\ waveStarted > 0
                       THEN clock * BonusPerSec ELSE 0)
    /\ waveStarted' = waveStarted + 1
    /\ queue' = SpawnCount /\ phase' = "combat"
    /\ countingDown' = FALSE /\ clock' = 0
    /\ UNCHANGED <<lives, alive, tier, spent, auto, paused>>

CallWave == StartWave(TRUE)
AutoCall == StartWave(FALSE)

Tick ==                       \* one sim second; never steps while paused
    /\ ~paused /\ ~Terminal
    /\ \/ /\ queue > 0 /\ queue' = queue - 1 /\ alive' = alive + 1
          /\ UNCHANGED <<gold, lives, waveStarted, countingDown, clock, phase>>
       \/ /\ alive > 0 /\ alive' = alive - 1                \* a kill
          /\ gold' = gold + Bounty
          /\ UNCHANGED <<lives, waveStarted, countingDown, clock, phase, queue>>
    /\ UNCHANGED <<tier, spent, auto, paused>>

Leak ==
    /\ ~paused /\ phase = "combat" /\ alive > 0
    /\ alive' = alive - 1
    /\ lives' = IF lives > 0 THEN lives - 1 ELSE 0
    /\ phase' = IF lives <= 1 THEN "defeat" ELSE phase
    /\ UNCHANGED <<gold, waveStarted, countingDown, clock, queue, tier, spent, auto, paused>>

Countdown ==
    /\ ~paused /\ ~Terminal /\ queue = 0
    /\ \/ /\ phase = "combat" /\ ~countingDown /\ waveStarted < Waves /\ alive = 0
          /\ countingDown' = TRUE /\ clock' = Gap
          /\ UNCHANGED <<phase, gold, lives, waveStarted, queue, alive>>
       \/ /\ countingDown /\ clock > 0 /\ clock' = clock - 1
          /\ UNCHANGED <<phase, gold, lives, waveStarted, queue, alive, countingDown>>
       \/ /\ countingDown /\ clock = 0 /\ auto /\ AutoCall
       \/ /\ countingDown /\ clock = 0 /\ ~auto /\ UNCHANGED vars  \* Manual: never self-call
    /\ UNCHANGED <<tier, spent, auto, paused>>

Victory ==
    /\ phase = "combat" /\ waveStarted = Waves /\ queue = 0 /\ alive = 0
    /\ phase' = "victory"
    /\ UNCHANGED <<gold, lives, waveStarted, countingDown, clock, queue, alive,
                   tier, spent, auto, paused>>

ToggleAuto ==
    \/ /\ auto' = FALSE
       /\ IF countingDown
            THEN IF waveStarted = 0
                   THEN countingDown' = FALSE /\ clock' = 0
                   ELSE countingDown' = TRUE /\ clock' = 0   \* ready idle, still callable
            ELSE UNCHANGED <<countingDown, clock>>
    \/ /\ auto' = TRUE
       \* THE FIX (2026-11-06 refuter): re-enabling Auto in prep re-arms prep.
       /\ IF phase = "prep" /\ waveStarted = 0 /\ ~countingDown
            THEN countingDown' = TRUE /\ clock' = Prep
            ELSE UNCHANGED <<countingDown, clock>>
    /\ UNCHANGED <<phase, gold, lives, waveStarted, queue, alive, tier, spent, paused>>

SetPaused == paused' = ~paused /\
    UNCHANGED <<phase, gold, lives, waveStarted, countingDown, clock, queue, alive,
                tier, spent, auto>>

Next ==
    \/ \E s \in Slots : Build(s) \/ Upgrade(s) \/ Sell(s)
    \/ CallWave \/ Tick \/ Leak \/ Countdown \/ Victory
    \/ ToggleAuto \/ SetPaused
    \/ Terminal /\ UNCHANGED vars

-----------------------------------------------------------------------------
TypeOK ==
    /\ phase \in {"prep", "combat", "victory", "defeat"}
    /\ gold \in Nat /\ lives \in 0..StartLives
    /\ waveStarted \in 0..Waves /\ clock \in Nat
    /\ queue \in Nat /\ alive \in Nat
    /\ tier \in [Slots -> 0..4] /\ spent \in [Slots -> Nat]

\* Every gold source is bounded: bounties from finitely many spawns,
\* bonuses from finitely many waves at a bounded clock.
GoldBounded ==
    gold <= StartGold + Waves * SpawnCount * Bounty + Waves * MaxClock * BonusPerSec
SpentMatchesTower == \A s \in Slots : (tier[s] = 0 => spent[s] = 0)
SpentBounded == \A s \in Slots : spent[s] <= BuildCost + 3 * UpgradeCost
VictoryOnlyWhenClear ==
    phase = "victory" => (waveStarted = Waves /\ queue = 0 /\ alive = 0)
DefeatOnlyAtZero == phase = "defeat" => lives = 0
PrepIsPristine == phase = "prep" => waveStarted = 0
ManualPrepIdle == (~auto /\ phase = "prep") => ~countingDown

Invariants == TypeOK /\ GoldBounded /\ SpentMatchesTower /\ SpentBounded
              /\ VictoryOnlyWhenClear /\ DefeatOnlyAtZero /\ PrepIsPristine
              /\ ManualPrepIdle

-----------------------------------------------------------------------------
\* TLC counterexample (2026-11-06): without a settle assumption, an adversary
\* who toggles Auto / builds+sells forever starves the clock. Liveness is
\* therefore claimed only for players who eventually settle, unpaused, in Auto.
Fairness == WF_vars(Countdown) /\ WF_vars(Tick) /\ WF_vars(Victory)
            /\ <>[](~paused /\ auto)

Spec == Init /\ [][Next]_vars /\ Fairness

AutoPrepLiveness == (auto /\ phase = "prep") ~> (waveStarted >= 1)
AutoTerminates == (auto /\ waveStarted >= 1) ~> Terminal

=============================================================================
