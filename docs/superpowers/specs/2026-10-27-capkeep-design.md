# Capkeep design

Capkeep is an original three-march tower defense. The play pattern comes from a close read of Kingdom Rush (Ironhide, 2011) and the public writing around it. The name, setting, figures, and numbers are ours. No original art, audio, or level geometry is reproduced.

## What the screens are doing

Two public screens were studied directly, plus written screen tours of the campaign map, upgrade room, enemy card, and victory panel.

The title screen (MobyGames browser capture) is a painted backdrop with one dominant wordmark, a single primary Start control, and a smaller secondary control. Capkeep keeps that hierarchy: title, one sentence, Start, Field notes. Publisher marks and store badges are not part of the game.

The battle screen (Wikimedia gameplay still, and the UI notes in Bauer's tower-defense interface writeup and the Grajcownik screen tour) puts almost nothing in the middle of the road:

- Top left: lives, gold, wave. Top right: pause.
- Bottom left: two powers with cooldowns.
- A full-width bottom bar for the selected tower, soldier, or foe.
- Build sites are fixed pads on the grass, not a free grid.
- The exit is a flagged hold. The next wave is a skull at the entrance; one click previews, another sends it.
- Selecting a pad opens a small cluster of tower choices on the pad itself, so the eye never travels to a corner menu.

Capkeep uses that same map. The preview is an explicit Call button rather than a hidden second tap, because the double-tap is easy to miss. A 2x control sits next to pause. Later games in the series were criticized for having no way to skip a solved wave.

## How the fighting works

Sources: the Kingdom Rush Wikipedia gameplay summary, the Wikily damage-and-armor page, the Southport stage page, the tower index, and Ironhide's own loading tips as quoted by guides.

- Lives start at 20. A foe that reaches the hold costs one. At 0 the march is lost. Lives are not for sale.
- Gold comes from bounties. Before the first wave, selling returns the full cost. After that, 60%.
- Towers are built only on pads. Four lines: fast physical that hits fliers, barracks that block, magic that ignores armor and misses fliers, explosive splash that aims at the ground. A blast still hurts fliers. Chain lightning can pick them out of the air.
- Each line upgrades twice, then the fourth purchase is a choice of two specialties. Dewcap stops at the third tier so the first march teaches upgrading before the branch.
- A barracks rallies soldiers onto the road. One soldier holds one ground foe. Extras can still strike that foe, and only the holder takes the hits. Flying foes are not held. Upgrading a barracks refreshes the squad.
- Armor cuts physical damage. Magic resistance cuts magic. Explosive and electric damage use half the armor. True damage and poison ignore both. The amount taken is `floor(roll * (1 - protection))`. Worked examples from the public damage page are unit-tested.
- The next wave can be called while its clock is running. Gold gained is the seconds remaining, and the two powers recharge by that many seconds.
- A hero walks where they are sent, holds one ground foe when they arrive, and has a short-range true-damage burst. Dewcap has no hero. Forkfen introduces Warden Puff.
- Stars persist. Six studies, one star each, improve range, barracks health, mage damage, blast radius, early gold, or reinforcements. Reset refunds the stars.

Southport, the original first stage, is the template for Dewcap: a few sproutlings, then shells, reinforcements partway through, a true-damage rain near the end, about 250 gold, 20 lives, and a short road. Forkfen is the fork-and-flyer lesson. Blackcap is the choke plus a boss who sheds a capped number of sproutlings.

## Adversarial review

**Scope.** A full campaign, challenge modes, a hero roster, a gem shop, and per-tower ability shops would not ship as a playable game in one pass. Those are cut. What stays is the part that makes this kind of defense feel like itself: pads, four lines, a branch, blocking, armor versus magic, fliers, a hero, two powers, early calls, and stars. Three marches are enough to teach, split, and finish.

**Engineering.** The simulation does not import the renderer. Balance tests drive it with a fixed seed and a scripted commander. The renderer only reads state and sends commands. Time steps at 30 Hz. Damage, path distance, and blocking are pure functions with tests. Boss adds are capped so a fight cannot run forever.

**Design.** Gold you cannot spend is dimmed, not hidden. The wave preview says what is coming and what the early call pays. New foes get a card with the tag that matters (armor, magic resist, flying), not only a color. Tower buttons are labeled Bow, Den, Hex, and Bomb so color is not the only signal. Rally has to be on the road and near the barracks. Powers have keys because racing the cursor to a corner button loses lives. The right build on Dewcap should finish with 16 or more lives. The same march without a gloomspire should bleed more. Forkfen's competent line should stay at 14 or above across damage rolls. Blackcap should be winnable at 8 or above, which is two stars, not a perfect hold.

## Liberties

Specialties include their trick. There is no second shop of three paid abilities on top of the branch. Fast-forward exists. The wave call is a labeled button. Nothing is immune: the toughest shell in the content is 62% armor, so a physical hit still does something, and magic is still the right tool. The setting is a mushroom hold, not a copy of Linirea.

## Architecture

Phaser 3 draws scenes and input. `src/sim/Sim.ts` is the rules. `src/content` is towers, foes, marches, and the star save. A scripted commander in `tests/strategy.ts` is not shipped in the client. It exists so a balance change has to keep a competent line alive.

Stars: 3 at 16 lives or more, 2 at 8 or more, 1 for any win. Studies are local to the browser.
