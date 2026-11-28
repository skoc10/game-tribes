import { clsOf, isFighter } from './combat';
import { agePrereqCount, issue } from './commands';
import { BUILDINGS, CFG, TECHS, canAfford, techCost, unitCost } from './data';
import { aiAccepts, coalitionAgainst, endPact, openHostilities, pactAllowed, pactOf, power, proposePact } from './diplomacy';
import { isVisible } from './fog';
import { walkable } from './path';
import { inPeace } from './relations';
import { relicCountdown } from './rules';
import { canPlace, nearestNode, popCap, popUsed } from './state';
import { T_BUSH, T_CRYSTAL, T_TREE, type Building, type Game, type ResourceKind, type Unit } from './types';

const A = CFG.ai;
const TERRAIN: Record<ResourceKind, number> = { food: T_BUSH, wood: T_TREE, crystal: T_CRYSTAL };
const KIND_OF_TERRAIN: Record<number, ResourceKind> = { [T_BUSH]: 'food', [T_TREE]: 'wood', [T_CRYSTAL]: 'crystal' };
/** What to train against each enemy class. */
const COUNTER: Record<string, string> = { cavalry: 'infantry', archer: 'cavalry', infantry: 'archer' };
const TRAINED_AT: Record<string, string> = { infantry: 'barracks', archer: 'archery', cavalry: 'stable' };

interface View {
  s: Game; me: number; base: { x: number; y: number };
  villagers: Unit[]; soldiers: Unit[]; army: Unit[];
  mine: Building[];
}

const has = (v: View, type: string, done = false): Building | undefined =>
  v.mine.find((b) => b.type === type && (!done || b.progress >= 1));

function look(s: Game, me: number): View {
  const units = s.units.filter((u) => u.owner === me);
  return {
    s, me, base: s.bases[me],
    villagers: units.filter((u) => u.type === 'villager'),
    soldiers: units.filter((u) => isFighter(u) && u.type !== 'hero'),
    army: units.filter(isFighter),
    mine: s.buildings.filter((b) => b.owner === me),
  };
}

/** A free site near the base with a clear ring around it, so buildings never seal anything in. */
function findSite(v: View, type: string): { tx: number; ty: number } | null {
  const { s, base } = v, size = BUILDINGS[type].size;
  // Sites are ranked only by quantities that turn with the base (distance from the map centre, from
  // camps, and position relative to the base's own facing), never by scan order. Otherwise mirrored
  // bases build differently: one seat once put its barracks beside a camp and built farms more slowly.
  const campDistance = (x: number, y: number) => Math.min(...s.camps.map((c) => Math.hypot(c.x - x, c.y - y)));
  const bcx = base.x + 0.5, bcy = base.y + 0.5;
  const fx = s.center.x - bcx, fy = s.center.y - bcy, flen = Math.hypot(fx, fy) || 1;
  {
    let best: { tx: number; ty: number } | null = null, bestKey: number[] = [];
    for (let dy = -18; dy <= 18; dy++) for (let dx = -18; dx <= 18; dx++) {
      const tx = base.x + dx, ty = base.y + dy;
      if (!canPlace(s, type, tx, ty)) continue;
      let clear = true;
      for (let y = ty - 1; y <= ty + size && clear; y++) for (let x = tx - 1; x <= tx + size; x++) if (!walkable(s, x, y)) { clear = false; break; }
      const sx = tx + size / 2, sy = ty + size / 2;
      const camp = campDistance(sx, sy);
      // Stay out of reach of camps altogether.
      if (!clear || camp < CFG.camp.leash) continue;
      // Sideways offset from the base's facing line: positive on one hand, negative on the other.
      const side = ((sx - bcx) * fy - (sy - bcy) * fx) / flen;
      // Nearest ring first, measured from the site's centre so that mirrored sites share a ring
      // (measuring from a corner does not mirror).
      const ring = Math.ceil(Math.max(Math.abs(sx - bcx), Math.abs(sy - bcy)));
      if (ring < 3 + size / 2 || ring > 17) continue;
      const key = [-ring, Math.round(Math.hypot(sx - s.center.x, sy - s.center.y) * 2), Math.round(camp * 2), -Math.round(Math.abs(side) * 2), Math.sign(Math.round(side * 2))];
      let better = !best;
      for (let k = 0; k < key.length && !better; k++) { if (key[k] > bestKey[k]) better = true; else if (key[k] < bestKey[k]) break; }
      if (better) { best = { tx, ty }; bestKey = key; }
    }
    if (best) return best;
  }
  return null;
}

function build(v: View, type: string): boolean {
  const p = v.s.players[v.me];
  if (!canAfford(p, BUILDINGS[type].cost)) return false;
  const builder = v.villagers.find((u) => u.order.kind === 'idle')
    ?? v.villagers.find((u) => u.order.kind === 'gather' && u.order.terrain === T_TREE)
    ?? v.villagers.find((u) => u.order.kind !== 'build');
  const site = builder && findSite(v, type);
  return !!site && issue(v.s, v.me, { type: 'build', units: [builder!.id], building: type, tx: site.tx, ty: site.ty }).ok;
}

const jobOf = (u: Unit): ResourceKind | null =>
  u.order.kind === 'gather' ? KIND_OF_TERRAIN[u.order.terrain] : u.order.kind === 'farm' ? 'food' : null;

function assign(v: View, u: Unit, kind: ResourceKind): boolean {
  const { s, me, base } = v;
  if (kind === 'food') {
    const farm = v.mine.find((b) => b.type === 'farm' && b.progress >= 1 && b.worker === 0);
    if (farm) return issue(s, me, { type: 'farm', units: [u.id], building: farm.id }).ok;
  }
  // Measured from the centre of the base tile: measuring from its corner is not the same for mirrored bases.
  const tile = nearestNode(s, TERRAIN[kind], base.x + 0.5, base.y + 0.5, kind === 'food' ? 14 : 24);
  if (tile >= 0) return issue(s, me, { type: 'gather', units: [u.id], tile }).ok;
  if (kind === 'food' && !v.mine.some((b) => b.type === 'farm' && b.progress < 1)) {
    const site = findSite(v, 'farm');
    if (site && issue(s, me, { type: 'build', units: [u.id], building: 'farm', tx: site.tx, ty: site.ty }).ok) return true;
  }
  return false;
}

function economy(v: View): void {
  const { s, me } = v, p = s.players[me];
  const tc = has(v, 'towncenter', true);
  if (!has(v, 'towncenter')) { build(v, 'towncenter'); return; }
  if (tc && tc.queue.length === 0 && v.villagers.length < A.villagers) issue(s, me, { type: 'train', building: tc.id, unit: 'villager' });

  const share: Record<ResourceKind, number> = p.age >= 2 ? { food: 0.5, wood: 0.32, crystal: 0.18 } : { food: 0.55, wood: 0.45, crystal: 0 };
  // Do not keep mining what is already piling up (Sancaklılar also get crystal from caravans).
  if (p.res.crystal >= A.crystalEnough) { share.food += share.crystal * 0.6; share.wood += share.crystal * 0.4; share.crystal = 0; }
  if (p.res.wood > A.woodEnough && p.res.food < p.res.wood / 2) { share.food += share.wood * 0.5; share.wood *= 0.5; }
  const count: Record<ResourceKind, number> = { food: 0, wood: 0, crystal: 0 };
  for (const u of v.villagers) { const j = jobOf(u); if (j) count[j]++; }
  const need = (k: ResourceKind) => share[k] * v.villagers.length - count[k];
  const kinds: ResourceKind[] = ['food', 'wood', 'crystal'];
  const byNeed = () => kinds.slice().sort((a, b) => need(b) - need(a));
  for (const u of v.villagers) {
    if (u.order.kind !== 'idle') continue;
    for (const k of byNeed()) if (assign(v, u, k)) { count[k]++; break; }
  }
  // Shift one worker at a time from the most over-staffed job to the most under-staffed one.
  const order = byNeed(), want = order[0], spare = order[order.length - 1];
  if (need(want) >= 1.5 && need(spare) <= -1) {
    const mover = v.villagers.find((u) => jobOf(u) === spare);
    if (mover) assign(v, mover, want);
  }

  // Pick up any construction left without a builder, or it would block everything that waits on it.
  for (const b of v.mine) {
    if (b.progress >= 1 || v.villagers.some((u) => u.order.kind === 'build' && u.order.building === b.id)) continue;
    const helper = v.villagers.find((u) => u.order.kind !== 'build' && jobOf(u) !== 'crystal') ?? v.villagers[0];
    if (helper) issue(s, me, { type: 'assist', units: [helper.id], building: b.id });
  }

  const cap = popCap(s, me);
  if (cap < CFG.popMax && cap - popUsed(s, me) <= 3 && !v.mine.some((b) => b.type === 'house' && b.progress < 1)) build(v, 'house');
  if (!has(v, 'barracks') && v.villagers.length >= 7) build(v, 'barracks');
  if (p.age === 1 && tc && !tc.research && v.villagers.length >= 12 && agePrereqCount(s, me) >= CFG.age2.prereq) issue(s, me, { type: 'ageUp', building: tc.id });
  if (p.age >= 2) {
    for (const type of ['archery', 'stable', 'blacksmith']) if (!has(v, type)) { build(v, type); break; }
    const smith = has(v, 'blacksmith', true);
    if (smith && !smith.research)
      for (const tech of Object.keys(TECHS))
        if (!p.upgrades.includes(tech) && canAfford(p, techCost(p, tech)) && issue(s, me, { type: 'research', building: smith.id, tech }).ok) break;
  }
}

/** Trains whatever counters the enemy soldiers this AI can currently see. */
function recruit(v: View): void {
  const { s, me } = v, p = s.players[me];
  const queued = v.mine.reduce((n, b) => n + b.queue.filter((q) => q.unit !== 'villager').length, 0);
  if (v.soldiers.length + queued >= (inPeace(s) ? A.armyPeace : A.armyWar)) return;
  // While saving for the next age, keep enough aside to pay for it.
  const saving = p.age === 1 && v.villagers.length >= 12;
  const seen: Record<string, number> = {};
  for (const u of s.units)
    if (u.owner >= 0 && u.owner !== me && isFighter(u) && isVisible(s, me, u.x, u.y)) seen[clsOf(u)] = (seen[clsOf(u)] ?? 0) + 1;
  const top = Object.keys(COUNTER).sort((a, b) => (seen[b] ?? 0) - (seen[a] ?? 0))[0];
  const rotation = ['infantry', 'archer', 'cavalry'][(v.soldiers.length + queued) % 3];
  // Spare crystal is best spent on cavalry.
  const rich = p.res.crystal >= A.crystalEnough ? ['cavalry'] : [];
  for (const type of [(seen[top] ?? 0) > 0 ? COUNTER[top] : rotation, ...rich, 'infantry']) {
    const b = has(v, TRAINED_AT[type], true);
    if (!b || b.queue.length >= 2) continue;
    const cost = unitCost(p, type);
    if (saving && (p.res.food - (cost.food ?? 0) < CFG.age2.cost.food || p.res.wood - (cost.wood ?? 0) < CFG.age2.cost.wood)) continue;
    if (issue(s, me, { type: 'train', building: b.id, unit: type }).ok) return;
  }
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const free = (u: Unit) => u.order.kind === 'idle' && u.target === 0;

function sendArmy(v: View, x: number, y: number, onlyFree = true): void {
  const ids = v.army.filter((u) => (!onlyFree || free(u)) && dist(u.x, u.y, x, y) > 3).map((u) => u.id);
  if (ids.length) issue(v.s, v.me, { type: 'attackMove', units: ids, x, y });
}

/**
 * Moves the army to a target in groups. Recruits sent one at a time just feed the enemy (and, on the
 * relic, keep interrupting its timer without ever threatening it), so fresh units wait at the rally
 * point until enough have gathered; fewer are needed to reinforce a fight already under way.
 */
function marchTogether(v: View, x: number, y: number, first: number, reach: number): void {
  const { s, me, base } = v;
  const dx = Math.sign(Math.round(s.center.x - base.x)), dy = Math.sign(Math.round(s.center.y - base.y));
  const rallyX = base.x + dx * 5 + 0.5, rallyY = base.y + dy * 5 + 0.5;
  const there = v.army.filter((u) => dist(u.x, u.y, x, y) < reach).length;
  const waiting = v.army.filter((u) => free(u) && dist(u.x, u.y, rallyX, rallyY) <= 4);
  if (waiting.length >= (there > 0 ? A.campReinforce : first)) issue(s, me, { type: 'attackMove', units: waiting.map((u) => u.id), x, y });
  // Units already out in the field rejoin the fight rather than walk home through the enemy;
  // only those still near home gather at the rally point.
  const loose = v.army.filter((u) => free(u) && dist(u.x, u.y, rallyX, rallyY) > 4 && dist(u.x, u.y, x, y) >= reach);
  const forward = loose.filter((u) => dist(u.x, u.y, x, y) < dist(u.x, u.y, rallyX, rallyY)).map((u) => u.id);
  const home = loose.filter((u) => dist(u.x, u.y, x, y) >= dist(u.x, u.y, rallyX, rallyY)).map((u) => u.id);
  if (forward.length && there > 0) issue(s, me, { type: 'attackMove', units: forward, x, y });
  else if (forward.length) home.push(...forward);
  if (home.length) issue(s, me, { type: 'attackMove', units: home, x: rallyX, y: rallyY });
}

function command(v: View): void {
  const { s, me, base } = v, st = s.ai[me];
  const scout = s.units.find((u) => u.owner === me && u.type === 'scout');
  if (scout && scout.order.kind === 'idle' && s.time < 5) issue(s, me, { type: 'explore', units: [scout.id] });

  // Defend the base first.
  const raider = s.units.find((u) => u.owner >= 0 && u.owner !== me && s.war[me][u.owner] && isFighter(u)
    && dist(u.x, u.y, base.x + 0.5, base.y + 0.5) < A.defendRadius && isVisible(s, me, u.x, u.y));
  if (raider) return sendArmy(v, raider.x, raider.y, false);

  // War is only ever declared in strategy(); marching orders follow it.
  if (st.goal === 'attack' && st.enemy >= 0 && s.players[st.enemy].alive && s.war[me][st.enemy] && !pactOf(s, me, st.enemy)) {
    if (v.soldiers.length < A.retreatArmy) {
      st.goal = 'none';
      const hx = Math.sign(Math.round(s.center.x - base.x)), hy = Math.sign(Math.round(s.center.y - base.y));
      return sendArmy(v, base.x + hx * 5 + 0.5, base.y + hy * 5 + 0.5, false);
    }
    const targets = s.buildings.filter((b) => b.owner === st.enemy);
    const tc = targets.find((b) => b.type === 'towncenter') ?? targets[0];
    if (!tc) return;
    marchTogether(v, tc.tx + 1.5, tc.ty + 1.5, A.campReinforce, 9);
    for (const u of v.army) {
      if (!free(u)) continue;
      if (dist(u.x, u.y, tc.tx + 1.5, tc.ty + 1.5) > 9) continue;
      {
        let best = tc, bestD = Infinity;
        for (const b of targets) { const d = dist(u.x, u.y, b.tx, b.ty); if (d < bestD) { best = b; bestD = d; } }
        issue(s, me, { type: 'attack', units: [u.id], target: best.id, building: true });
      }
    }
    return;
  }
  if (st.goal === 'relic') return marchTogether(v, s.relic.x, s.relic.y, A.campReinforce, CFG.relic.radius + 2);

  // Otherwise hunt the nearest camp the army can handle, or wait in front of the base.
  let camp = -1, campD = Infinity;
  s.camps.forEach((c, i) => {
    const d = dist(c.x, c.y, base.x + 0.5, base.y + 0.5);
    if (c.alive > 0 && v.army.length >= A.campArmy[c.tier - 1] && d < campD) { camp = i; campD = d; }
  });
  if (camp >= 0) return marchTogether(v, s.camps[camp].x, s.camps[camp].y, A.campArmy[s.camps[camp].tier - 1], CFG.camp.leash);
  const dx = Math.sign(Math.round(s.center.x - base.x)), dy = Math.sign(Math.round(s.center.y - base.y));
  sendArmy(v, base.x + dx * 5 + 0.5, base.y + dy * 5 + 0.5);
}

/** Opens hostilities the honest way: a pact partner first gets the notice period. */
function declare(s: Game, me: number, target: number): boolean {
  if (s.war[me][target] && !pactOf(s, me, target)) return true;
  const r = openHostilities(s, me, target, false);
  if (r.ok) return true;
  const pact = pactOf(s, me, target);
  if (r.needsConfirm && pact && pact.endsAt < 0) endPact(s, me, target);
  return false;
}

function offer(s: Game, me: number, to: number): void {
  const st = s.ai[me];
  // No offers to the player it is marching against, or to whoever holds the relic.
  if (to === st.enemy && st.goal !== 'none') return;
  if (s.relic.owner === to) return;
  if (s.time - st.lastOffer[to] < 60 || !pactAllowed(s, me, to).ok) return;
  // Never offer what it would itself refuse if asked.
  if (!aiAccepts(s, me, to).ok) return;
  st.lastOffer[to] = s.time;
  proposePact(s, me, to);
}

/**
 * Armies of two players standing on a relic neither owns block each other forever. End it openly:
 * turn on whoever has the most soldiers there (a pact partner first gets the notice period).
 */
function breakStandOff(v: View): void {
  const { s, me } = v, st = s.ai[me];
  const seenBefore = st.blocker;
  st.blocker = -1;
  // Applies whoever owns the relic: an absent owner's relic can be deadlocked by two visiting armies too.
  if (s.relic.owner === me) return;
  const near = (u: Unit) => isFighter(u) && dist(u.x, u.y, s.relic.x, s.relic.y) <= CFG.relic.radius;
  if (!v.army.some(near)) return;
  const count = new Map<number, number>();
  for (const u of s.units) if (u.owner >= 0 && u.owner !== me && near(u)) count.set(u.owner, (count.get(u.owner) ?? 0) + 1);
  // Ties go to the lower player id so the choice does not depend on unit order.
  const rival = [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  if (!rival || rival[1] < 2) return;
  // Someone merely passing through is not a stand-off: act only if they are still there a tick later.
  st.blocker = rival[0];
  if (seenBefore !== rival[0]) return;
  st.enemy = rival[0];
  declare(s, me, rival[0]);
}

function strategy(v: View): void {
  const { s, me } = v, st = s.ai[me], p = s.players[me];
  const rivals = s.players.filter((o) => o.alive && o.id !== me);
  if (st.enemy >= 0 && !s.players[st.enemy].alive) { st.enemy = -1; st.goal = 'none'; }
  // A pact with the current target calls the march off.
  const truce = st.enemy >= 0 ? pactOf(s, me, st.enemy) : null;
  if (truce && truce.endsAt < 0) { st.enemy = -1; st.goal = 'none'; }

  if (p.personality === 'trader') for (const o of rivals) offer(s, me, o.id);
  if (inPeace(s)) return;

  // Everyone turns on a proven traitor, and on whoever is about to win with the relic.
  const traitor = rivals.find((o) => coalitionAgainst(s, o.id));
  const holder = s.relic.owner;
  if (traitor) {
    st.enemy = traitor.id;
    if (declare(s, me, traitor.id) && v.soldiers.length >= A.retreatArmy + 2) st.goal = 'attack';
    return;
  }
  if (holder >= 0 && holder !== me && relicCountdown(s) < A.relicAlarm) {
    st.enemy = holder;
    declare(s, me, holder);
    st.goal = 'relic';
    // Others who came for the same relic stand in the way just as much as its owner does.
    breakStandOff(v);
    return;
  }

  if (p.personality === 'trader') {
    // The trader wants the relic, and fights only those already at war with it.
    st.enemy = -1;
    st.goal = v.soldiers.length >= A.relicArmy * st.nerve || holder === me ? 'relic' : 'none';
    if (st.goal === 'relic') breakStandOff(v);
    return;
  }

  // The expander marches on the weakest neighbour once its army is ready, and sues for peace when losing.
  const strength = (id: number) => power(s, id) + s.buildings.filter((b) => b.owner === id).length * 50;
  if (st.enemy < 0) st.enemy = rivals.slice().sort((a, b) => strength(a.id) - strength(b.id))[0]?.id ?? -1;
  if (st.enemy < 0) return;
  if (s.war[me][st.enemy] && power(s, me) < power(s, st.enemy) * 0.6) { offer(s, me, st.enemy); st.goal = 'none'; return; }
  // Marching on a base favours the defender, so attack only with a clear edge; otherwise go for the relic.
  const edge = power(s, me) >= power(s, st.enemy) * A.attackEdge;
  if (v.soldiers.length >= A.attackArmy * st.nerve && edge) {
    if (declare(s, me, st.enemy)) st.goal = 'attack';
  } else if (st.goal !== 'attack' && v.soldiers.length >= A.relicArmy * st.nerve) {
    st.goal = 'relic';
    breakStandOff(v);
  } else if (st.goal === 'relic' && s.relic.owner !== me && v.soldiers.length < A.retreatArmy) {
    // Too few left to hold anything: fall back and rebuild.
    st.goal = 'none';
  }
}

export function stepAI(s: Game): void {
  for (const p of s.players) {
    if (!p.isAI || !p.alive) continue;
    const st = s.ai[p.id];
    const think = s.time >= st.nextThink, plan = s.time >= st.nextStrategy;
    if (!think && !plan) continue;
    const v = look(s, p.id);
    if (plan) { st.nextStrategy = s.time + A.strategySeconds; strategy(v); }
    if (think) {
      st.nextThink = s.time + A.thinkSeconds;
      economy(v);
      recruit(v);
      command(v);
    }
  }
}
