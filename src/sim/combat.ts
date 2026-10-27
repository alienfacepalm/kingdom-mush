import type { DamageType } from "../content/types";

export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** Armor, magic resist, half-armor explosives, and true/poison. Matches the public Kingdom Rush damage model. */
export function protection(type: DamageType, armor: number, magicResist: number): number {
  switch (type) {
    case "physical":
      return clamp01(armor);
    case "magic":
      return clamp01(magicResist);
    case "explosive":
    case "electric":
      return clamp01(armor) * 0.5;
    default:
      return 0;
  }
}

export function applyDamage(amount: number, type: DamageType, armor: number, magicResist: number): number {
  if (amount <= 0) return 0;
  const taken = amount * (1 - protection(type, armor, magicResist));
  return Math.floor(taken);
}

/** 1 at the center of a blast, 0.5 at the edge, 0 outside. */
export function splashMultiplier(distance: number, radius: number): number {
  if (radius <= 0 || distance > radius) return 0;
  return 1 - 0.5 * (distance / radius);
}

export function rollInt(min: number, max: number, rng: () => number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

export function starsFor(lives: number, victory: boolean): number {
  if (!victory) return 0;
  if (lives >= 16) return 3;
  if (lives >= 8) return 2;
  return 1;
}
