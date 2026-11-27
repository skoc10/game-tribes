import { BUILDINGS, CFG, KINDS, RACES, UNITS, unitCost } from './data';
import { goTo, type Travel } from './move';
import { hostile, inPeace } from './relations';
import { buildingById, log, removeBuilding, unitById } from './state';
import type { Building, Cost, Game, Unit } from './types';

const MULT = CFG.combat.multipliers as Record<string, Record<string, number>>;
const VS_BUILDING = CFG.combat.vsBuilding as Record<string, number>;
const FIGHTERS = new Set(['infantry', 'archer', 'cavalry', 'hero', 'beast']);

export const clsOf = (u: Unit): string => UNITS[u.type].cls;
export const isFighter = (u: Unit): boolean => FIGHTERS.has(clsOf(u));
export const maxHp = (u: Unit): number => Math.round(UNITS[u.type].hp * u.scale);

/** Damage multiplier of the combat triangle: 1.5 when strong, 0.75 when weak. */
export function multiplier(attacker: string, defender: string): number {
  return MULT[attacker]?.[defender] ?? 1;
}

function give(s: Game, player: number, cost: Cost, frac: number, x: number, y: number): void {
  const p = s.players[player];
  const parts: string[] = [];
  for (const k of KINDS) {
    const v = Math.round((cost[k] ?? 0) * frac);
    if (v > 0) { p.res[k] += v; parts.push(`+${v} ${k === 'food' ? 'yiyecek' : k === 'wood' ? 'odun' : 'kristal'}`); }
  }
  if (parts.length) log(s, player, 'loot', `Ganimet: ${parts.join(', ')}`, x, y);
}

export function xpForLevel(level: number): number {
  return CFG.hero.xpPerLevel * level;
}

/** Highest hero level currently allowed: capped while the peace period lasts. */
export function heroLevelCap(s: Game): number {
  return inPeace(s) ? CFG.peaceHeroCap : CFG.hero.maxLevel;
}

function grantXp(s: Game, player: number, x: number, y: number, xp: number): void {
  const hero = s.units.find((u) => u.owner === player && u.type === 'hero');
  if (!hero || (hero.x - x) ** 2 + (hero.y - y) ** 2 > CFG.hero.xpRadius ** 2) return;
  const p = s.players[player];
  p.heroXp += xp * (s.relic.owner === player ? CFG.relic.xpBonus : 1);
  while (p.heroLevel < heroLevelCap(s) && p.heroXp >= xpForLevel(p.heroLevel)) {
    p.heroXp -= xpForLevel(p.heroLevel);
    p.heroLevel++;
    const before = maxHp(hero);
    hero.scale = 1 + CFG.hero.levelBonus * (p.heroLevel - 1);
    hero.hp += maxHp(hero) - before;
    log(s, player, 'level', `Kahraman ${p.heroLevel}. seviyeye çıktı!`, hero.x, hero.y);
  }
}

export function killUnit(s: Game, victim: Unit, killer: number): void {
  s.units = s.units.filter((u) => u !== victim);
  const looter = killer >= 0 && RACES[s.players[killer].race].loot;
  if (victim.owner < 0) {
    const camp = s.camps[victim.camp];
    if (killer >= 0) grantXp(s, killer, victim.x, victim.y, CFG.hero.xpBeast * (camp ? camp.tier : 1));
    if (camp && --camp.alive <= 0) {
      camp.alive = 0;
      camp.respawnAt = s.time + CFG.camp.respawn;
      if (looter) give(s, killer, CFG.camp.loot[camp.tier - 1], 1, camp.x, camp.y);
    }
    return;
  }
  const owner = s.players[victim.owner];
  if (victim.type === 'hero') {
    owner.heroRespawn = s.time + CFG.hero.respawnBase + CFG.hero.respawnPerLevel * owner.heroLevel;
    log(s, victim.owner, 'hero', 'Kahramanın yenildi; Ana Merkez\'de yeniden doğacak.');
  }
  if (killer >= 0) {
    grantXp(s, killer, victim.x, victim.y, victim.type === 'hero' ? CFG.hero.xpHero : CFG.hero.xpUnit);
    if (looter) give(s, killer, unitCost(owner, victim.type), CFG.loot.unit, victim.x, victim.y);
  }
}

export function destroyBuilding(s: Game, b: Building, killer: number): void {
  const size = BUILDINGS[b.type].size;
  removeBuilding(s, b);
  log(s, b.owner, 'lost', `${BUILDINGS[b.type].name} yıkıldı.`, b.tx + size / 2, b.ty + size / 2);
  if (killer >= 0 && RACES[s.players[killer].race].loot)
    give(s, killer, BUILDINGS[b.type].cost, CFG.loot.building, b.tx + size / 2, b.ty + size / 2);
}

const soldier = (u: Unit): boolean => u.owner >= 0 && isFighter(u);

function damageOf(s: Game, u: Unit): number {
  const bonus = soldier(u) && s.players[u.owner].upgrades.includes('weapon1') ? 1 : 0;
  return UNITS[u.type].damage * u.scale + bonus;
}

/** Damage after the defender's armour; a hit always does at least 1. */
function afterArmor(s: Game, t: Unit, damage: number): number {
  const armor = soldier(t) && s.players[t.owner].upgrades.includes('armor1') ? 1 : 0;
  return Math.max(1, damage - armor);
}

/** Slack between the pathing goal and true weapon reach, so a unit that arrives can always strike. */
const REACH_MARGIN = 0.2;

/** After walking: if the target is still out of reach (it moved), plan again next tick. */
function settle(u: Unit, state: Travel): boolean {
  if (state === 'blocked') return false;
  if (state === 'arrived') { u.path = null; u.pathKey = ''; }
  return true;
}

/** Moves into range of a unit and strikes when ready. Returns false if the target cannot be reached. */
export function engageUnit(s: Game, u: Unit, t: Unit): boolean {
  const range = UNITS[u.type].range;
  const reach = range > 0 ? range + 0.5 : 1.5;
  if ((t.x - u.x) ** 2 + (t.y - u.y) ** 2 <= reach * reach) {
    u.path = null; u.pathKey = '';
    if (u.cooldown <= 0) {
      u.cooldown = CFG.combat.cooldown;
      t.hp -= afterArmor(s, t, damageOf(s, u) * multiplier(clsOf(u), clsOf(t)));
      if (t.hp <= 0) killUnit(s, t, u.owner);
      // A fighter with nothing better to do turns on whoever is hitting it, even from beyond its own aggro range.
      // Beasts do the same, so a camp cannot be shot down from outside its aggro circle.
      else if (!t.target && isFighter(t) && (t.owner < 0 || t.order.kind === 'idle' || t.order.kind === 'attackMove')) t.target = u.id;
    }
    return true;
  }
  // The goal is the real reach test from the tile centre, so arriving means being able to hit.
  const tx = Math.floor(t.x), ty = Math.floor(t.y), px = t.x, py = t.y, near = (reach - REACH_MARGIN) ** 2;
  const goal = (x: number, y: number) => (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 <= near;
  return settle(u, goTo(s, u, `a${t.id}:${tx},${ty}`, goal, tx, ty));
}

export function engageBuilding(s: Game, u: Unit, b: Building): boolean {
  const size = BUILDINGS[b.type].size;
  const range = UNITS[u.type].range;
  const dx = Math.max(b.tx - u.x, 0, u.x - (b.tx + size)), dy = Math.max(b.ty - u.y, 0, u.y - (b.ty + size));
  const reach = range > 0 ? range + 0.5 : 1.2;
  if (dx * dx + dy * dy <= reach * reach) {
    u.path = null; u.pathKey = '';
    if (u.cooldown <= 0) {
      u.cooldown = CFG.combat.cooldown;
      b.hp -= damageOf(s, u) * (VS_BUILDING[clsOf(u)] ?? 0.5);
      if (b.hp <= 0) destroyBuilding(s, b, u.owner);
    }
    return true;
  }
  const near = (reach - REACH_MARGIN) ** 2;
  const goal = (x: number, y: number) => {
    const gx = Math.max(b.tx - (x + 0.5), 0, x + 0.5 - (b.tx + size)), gy = Math.max(b.ty - (y + 0.5), 0, y + 0.5 - (b.ty + size));
    return gx * gx + gy * gy <= near;
  };
  return settle(u, goTo(s, u, `ab${b.id}`, goal, b.tx + size / 2, b.ty + size / 2));
}

function nearestHostile(s: Game, u: Unit, radius: number): Unit | undefined {
  let best: Unit | undefined, bestD = radius * radius;
  for (const o of s.units) {
    if (!hostile(s, u.owner, o.owner)) continue;
    const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2;
    if (d < bestD) { best = o; bestD = d; }
  }
  return best;
}

/** Lets an idle or attack-moving fighter pick and fight nearby enemies. Returns true while fighting. */
export function autoFight(s: Game, u: Unit): boolean {
  if (u.target) {
    const t = unitById(s, u.target);
    if (!t || !hostile(s, u.owner, t.owner) || (t.x - u.x) ** 2 + (t.y - u.y) ** 2 > CFG.combat.chase ** 2) u.target = 0;
  }
  if (!u.target && (s.tick + u.id) % 5 === 0) u.target = nearestHostile(s, u, Math.max(CFG.combat.aggro, UNITS[u.type].range + 0.5))?.id ?? 0;
  const t = u.target ? unitById(s, u.target) : undefined;
  if (!t) return false;
  if (!engageUnit(s, u, t)) u.target = 0;
  return true;
}

/** Neutral creatures guard their camp: they attack intruders, never scouts, and return home. */
export function stepBeast(s: Game, u: Unit): void {
  const camp = s.camps[u.camp];
  if (!camp) return;
  let t = u.target ? unitById(s, u.target) : undefined;
  if (t && (t.x - camp.x) ** 2 + (t.y - camp.y) ** 2 > CFG.camp.leash ** 2) t = undefined;
  if (!t && (s.tick + u.id) % 5 === 0) {
    let bestD = CFG.camp.aggro ** 2;
    for (const o of s.units) {
      if (o.owner < 0 || o.type === 'scout') continue;
      const d = (o.x - camp.x) ** 2 + (o.y - camp.y) ** 2;
      if (d < bestD) { t = o; bestD = d; }
    }
  }
  u.target = t ? t.id : 0;
  if (t && engageUnit(s, u, t)) return;
  u.target = 0;
  const hx = Math.floor(camp.x), hy = Math.floor(camp.y);
  if (Math.abs(u.x - camp.x) > 1.6 || Math.abs(u.y - camp.y) > 1.6)
    goTo(s, u, `home${u.camp}`, (x, y) => Math.abs(x - hx) <= 1 && Math.abs(y - hy) <= 1, hx, hy);
  else u.hp = Math.min(maxHp(u), u.hp + 4 * (1 / CFG.tickRate));
}

export function attackTarget(s: Game, u: Unit, id: number, building: boolean): boolean {
  if (building) {
    const b = buildingById(s, id);
    return !!b && hostile(s, u.owner, b.owner) && engageBuilding(s, u, b);
  }
  const t = unitById(s, id);
  return !!t && hostile(s, u.owner, t.owner) && engageUnit(s, u, t);
}
