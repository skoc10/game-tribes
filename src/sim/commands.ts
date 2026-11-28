import { isFighter } from './combat';
import { BUILDINGS, CFG, KINDS, TECHS, UNITS, canAfford, pay, techCost, trainTime, unitCost } from './data';
import { formation } from './formation';
import { answerOffer, endPact, gift, openHostilities, proposePact } from './diplomacy';
import { addBuilding, buildingById, canPlace, isResource, nearestNode, popCap, popUsed, removeBuilding, unitById } from './state';
import { T_BUSH, T_TREE, type Game, type Order, type ResourceKind, type Unit } from './types';

export type Command =
  | { type: 'move'; units: number[]; x: number; y: number }
  | { type: 'gather'; units: number[]; tile: number }
  | { type: 'farm'; units: number[]; building: number }
  | { type: 'build'; units: number[]; building: string; tx: number; ty: number }
  | { type: 'assist'; units: number[]; building: number }
  | { type: 'train'; building: number; unit: string }
  | { type: 'autoVillager'; building: number; on: boolean }
  | { type: 'rally'; building: number; tile: number }
  | { type: 'cancel'; building: number }
  | { type: 'ageUp'; building: number }
  | { type: 'research'; building: number; tech: string }
  | { type: 'attack'; units: number[]; target: number; building: boolean; confirm?: boolean }
  | { type: 'proposePact'; to: number }
  | { type: 'answerPact'; from: number; accept: boolean }
  | { type: 'endPact'; other: number }
  | { type: 'gift'; to: number; kind: ResourceKind; amount: number }
  | { type: 'attackMove'; units: number[]; x: number; y: number }
  | { type: 'explore'; units: number[] };

export interface Result { ok: boolean; reason?: string; needsConfirm?: boolean }
const OK: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });

export function setOrder(u: Unit, order: Order): void {
  u.order = order;
  u.target = 0;
  u.path = null;
  u.pathKey = '';
}

function own(s: Game, player: number, ids: number[]): Unit[] {
  const out: Unit[] = [];
  for (const id of ids) {
    const u = unitById(s, id);
    if (u && u.owner === player) out.push(u);
  }
  return out;
}

/**
 * Sends a villager to gather food or wood, whichever fewer of its owner's villagers are working on.
 * The help human players get on the easier levels.
 */
export function sendToWork(s: Game, u: Unit): void {
  let food = 0, wood = 0;
  for (const o of s.units) {
    if (o.owner !== u.owner || o.type !== 'villager') continue;
    if (o.order.kind === 'farm' || (o.order.kind === 'gather' && o.order.terrain === T_BUSH)) food++;
    else if (o.order.kind === 'gather' && o.order.terrain === T_TREE) wood++;
  }
  const first = food <= wood ? T_BUSH : T_TREE;
  for (const terrain of [first, first === T_BUSH ? T_TREE : T_BUSH]) {
    const tile = nearestNode(s, terrain, u.x, u.y, CFG.autoSwitchRadius);
    if (tile >= 0) return setOrder(u, { kind: 'gather', tile, terrain });
  }
}

const validPlayer = (s: Game, id: unknown): id is number => Number.isInteger(id) && (id as number) >= 0 && (id as number) < s.players.length;

/** Number of distinct finished Age I building types (besides the Ana Merkez) a player owns. */
export function agePrereqCount(s: Game, player: number): number {
  const types = new Set<string>();
  for (const b of s.buildings)
    if (b.owner === player && b.progress >= 1 && b.type !== 'towncenter' && BUILDINGS[b.type].age === 1) types.add(b.type);
  return types.size;
}

export function issue(s: Game, player: number, cmd: Command): Result {
  const p = s.players[player];
  if (!p || !p.alive) return fail('Oyuncu yok');
  if (s.winner >= 0) return fail('Maç bitti');
  switch (cmd.type) {
    case 'move': {
      const group = own(s, player, cmd.units), slots = formation(s, group, cmd.x, cmd.y);
      for (const u of group) setOrder(u, { kind: 'move', ...slots.get(u.id)! });
      return OK;
    }
    case 'gather': {
      const terrain = s.terrain[cmd.tile];
      if (!isResource(terrain)) return fail('Burada kaynak yok');
      for (const u of own(s, player, cmd.units)) {
        if (u.type !== 'villager') { setOrder(u, { kind: 'move', x: (cmd.tile % s.w) + 0.5, y: Math.floor(cmd.tile / s.w) + 0.5 }); continue; }
        const x = (cmd.tile % s.w) + 0.5, y = Math.floor(cmd.tile / s.w) + 0.5;
        const tile = nearestNode(s, terrain, x, y, CFG.autoSwitchRadius);
        if (tile >= 0) setOrder(u, { kind: 'gather', tile, terrain });
      }
      return OK;
    }
    case 'farm':
    case 'assist': {
      const b = buildingById(s, cmd.building);
      if (!b || b.owner !== player) return fail('Bina yok');
      if (cmd.type === 'farm' && b.type !== 'farm') return fail('Bu bir çiftlik değil');
      for (const u of own(s, player, cmd.units)) {
        if (u.type !== 'villager') continue;
        setOrder(u, b.progress < 1 ? { kind: 'build', building: b.id } : { kind: 'farm', building: b.id });
      }
      return OK;
    }
    case 'build': {
      const def = BUILDINGS[cmd.building];
      if (!def) return fail('Bilinmeyen bina');
      if (def.age > p.age) return fail('Bu bina için çağ atlamalısın');
      const builders = own(s, player, cmd.units).filter((u) => u.type === 'villager');
      if (builders.length === 0) return fail('Önce bir köylü seç');
      if (!canPlace(s, cmd.building, cmd.tx, cmd.ty)) return fail('Buraya kurulamaz');
      if (!canAfford(p, def.cost)) return fail('Yeterli kaynak yok');
      pay(p, def.cost);
      const b = addBuilding(s, player, cmd.building, cmd.tx, cmd.ty, false);
      for (const u of builders) setOrder(u, { kind: 'build', building: b.id });
      return OK;
    }
    case 'train': {
      const b = buildingById(s, cmd.building);
      if (!b || b.owner !== player) return fail('Bina yok');
      if (b.progress < 1) return fail('Bina henüz bitmedi');
      if (!BUILDINGS[b.type].trains.includes(cmd.unit)) return fail('Bu bina o birimi üretemez');
      if (b.queue.length >= CFG.queueMax) return fail('Üretim sırası dolu');
      const cost = unitCost(p, cmd.unit);
      if (!canAfford(p, cost)) return fail('Yeterli kaynak yok');
      if (popUsed(s, player) + UNITS[cmd.unit].pop > popCap(s, player)) return fail('Nüfus sınırı dolu — Ev kur');
      pay(p, cost);
      const t = trainTime(p, cmd.unit);
      b.queue.push({ unit: cmd.unit, remaining: t, total: t });
      return OK;
    }
    case 'autoVillager': {
      const b = buildingById(s, cmd.building);
      if (!b || b.owner !== player || b.type !== 'towncenter') return fail('Ana Merkez seç');
      b.autoVillager = cmd.on;
      return OK;
    }
    case 'attack': {
      const targetOwner = cmd.building ? buildingById(s, cmd.target)?.owner : unitById(s, cmd.target)?.owner;
      if (targetOwner === undefined) return fail('Hedef yok');
      if (targetOwner === player) return fail('Kendi birimine saldıramazsın');
      const fighters = own(s, player, cmd.units).filter(isFighter);
      if (fighters.length === 0) return fail('Saldırabilecek birim seçili değil');
      if (targetOwner >= 0) {
        const allowed = openHostilities(s, player, targetOwner, cmd.confirm === true);
        if (!allowed.ok) return allowed;
      }
      for (const u of fighters) setOrder(u, { kind: 'attack', target: cmd.target, building: cmd.building });
      return OK;
    }
    case 'proposePact': return validPlayer(s, cmd.to) ? proposePact(s, player, cmd.to) : fail('Geçersiz taraf');
    case 'answerPact': return validPlayer(s, cmd.from) ? answerOffer(s, player, cmd.from, cmd.accept) : fail('Geçersiz taraf');
    case 'endPact': return validPlayer(s, cmd.other) ? endPact(s, player, cmd.other) : fail('Geçersiz taraf');
    case 'gift': return validPlayer(s, cmd.to) ? gift(s, player, cmd.to, cmd.kind, cmd.amount) : fail('Geçersiz taraf');
    case 'attackMove': {
      const group = own(s, player, cmd.units), slots = formation(s, group, cmd.x, cmd.y);
      for (const u of group) setOrder(u, { kind: isFighter(u) ? 'attackMove' : 'move', ...slots.get(u.id)! });
      return OK;
    }
    case 'explore': {
      for (const u of own(s, player, cmd.units)) if (u.type === 'scout') setOrder(u, { kind: 'explore', skip: [] });
      return OK;
    }
    case 'rally': {
      const b = buildingById(s, cmd.building);
      if (!b || b.owner !== player) return fail('Bina yok');
      if (!Number.isInteger(cmd.tile) || cmd.tile < 0 || cmd.tile >= s.w * s.h || !isResource(s.terrain[cmd.tile])) return fail('Toplanma noktası bir kaynak olmalı');
      b.rallyTile = cmd.tile;
      return OK;
    }
    case 'ageUp': {
      const b = buildingById(s, cmd.building);
      if (!b || b.owner !== player || b.type !== 'towncenter' || b.progress < 1) return fail('Ana Merkez seç');
      if (p.age >= 2) return fail('Zaten Kale Çağı\'ndasın');
      if (s.buildings.some((o) => o.owner === player && o.research?.id === 'age2')) return fail('Araştırma sürüyor');
      if (b.research) return fail('Araştırma sürüyor');
      if (agePrereqCount(s, player) < CFG.age2.prereq) return fail(`Önce ${CFG.age2.prereq} farklı bina kur (Ev, Çiftlik, Kışla)`);
      if (!canAfford(p, CFG.age2.cost)) return fail('Yeterli kaynak yok');
      pay(p, CFG.age2.cost);
      b.research = { id: 'age2', remaining: CFG.age2.time, total: CFG.age2.time };
      return OK;
    }
    case 'research': {
      const b = buildingById(s, cmd.building);
      const tech = TECHS[cmd.tech];
      if (!b || b.owner !== player || b.type !== 'blacksmith' || b.progress < 1) return fail('Demirci seç');
      if (!tech) return fail('Bilinmeyen teknoloji');
      if (b.research) return fail('Araştırma sürüyor');
      const busy = s.buildings.some((o) => o.owner === player && o.research?.id === cmd.tech);
      if (p.upgrades.includes(cmd.tech) || busy) return fail('Bu zaten araştırıldı');
      const cost = techCost(p, cmd.tech);
      if (!canAfford(p, cost)) return fail('Yeterli kaynak yok');
      pay(p, cost);
      b.research = { id: cmd.tech, remaining: tech.time, total: tech.time };
      return OK;
    }
    case 'cancel': {
      const b = buildingById(s, cmd.building);
      if (!b || b.owner !== player) return fail('Bina yok');
      if (b.progress >= 1) return fail('Biten bina iptal edilemez');
      for (const k of KINDS) p.res[k] += BUILDINGS[b.type].cost[k] ?? 0;
      removeBuilding(s, b);
      return OK;
    }
  }
}
