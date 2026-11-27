import { BUILDINGS, CFG, KINDS, RACES, UNITS, unitCost } from './data';
import { goTo, nearRect, type Travel } from './move';
import { walkable } from './path';
import { hostile } from './relations';
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

/** Highest hero level currently allowed. Later phases cap it during the peace period. */
export function heroLevelCap(_s: Game): number {
  return CFG.hero.maxLevel;
}

function grantXp(s: Game, player: number, x: number, y: number, xp: number): void {
  const hero = s.units.find((u) => u.owner === player && u.type === 'hero');
  if (!hero || (hero.x - x) ** 2 + (hero.y - y) ** 2 > CFG.hero.xpRadius ** 2) return;
  const p = s.players[player];
  p.heroXp += xp;
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

function damageOf(u: Unit): number {
  return UNITS[u.type].damage * u.scale;
}

/**
 * Tile adjacency does not guarantee weapon reach, because units stand anywhere within a tile.
 * Once the path is done, close the remaining gap in a straight line.
 */
function approach(s: Game, u: Unit, state: Travel, x: number, y: number): boolean {
  if (state === 'blocked') return false;
  if (state === 'arrived') {
    const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy) || 1;
    const stepLen = Math.min(d, UNITS[u.type].speed / CFG.tickRate);
    const nx = u.x + (dx / d) * stepLen, ny = u.y + (dy / d) * stepLen;
    if (walkable(s, Math.floor(nx), Math.floor(ny))) { u.x = nx; u.y = ny; }
  }
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
      t.hp -= damageOf(u) * multiplier(clsOf(u), clsOf(t));
      if (t.hp <= 0) killUnit(s, t, u.owner);
      // A fighter with nothing better to do turns on whoever is hitting it, even from beyond its own aggro range.
      else if (!t.target && t.owner >= 0 && isFighter(t) && (t.order.kind === 'idle' || t.order.kind === 'attackMove')) t.target = u.id;
    }
    return true;
  }
  const tx = Math.floor(t.x), ty = Math.floor(t.y);
  const r = Math.max(1, Math.floor(range));
  const goal = (x: number, y: number) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= r;
  return approach(s, u, goTo(s, u, `a${t.id}:${tx},${ty}`, goal, tx, ty), t.x, t.y);
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
      b.hp -= damageOf(u) * (VS_BUILDING[clsOf(u)] ?? 0.5);
      if (b.hp <= 0) destroyBuilding(s, b, u.owner);
    }
    return true;
  }
  const goal = nearRect(b.tx, b.ty, size, Math.max(1, Math.floor(range)));
  return approach(s, u, goTo(s, u, `ab${b.id}`, goal, b.tx + size / 2, b.ty + size / 2), b.tx + size / 2, b.ty + size / 2);
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
