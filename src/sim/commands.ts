import { BUILDINGS, CFG, UNITS, canAfford, pay, trainTime, unitCost } from './data';
import { addBuilding, buildingById, canPlace, isResource, nearestNode, popCap, popUsed, unitById } from './state';
import type { Game, Order, Unit } from './types';

export type Command =
  | { type: 'move'; units: number[]; x: number; y: number }
  | { type: 'gather'; units: number[]; tile: number }
  | { type: 'farm'; units: number[]; building: number }
  | { type: 'build'; units: number[]; building: string; tx: number; ty: number }
  | { type: 'assist'; units: number[]; building: number }
  | { type: 'train'; building: number; unit: string }
  | { type: 'autoVillager'; building: number; on: boolean }
  | { type: 'rally'; building: number; tile: number };

export interface Result { ok: boolean; reason?: string }
const OK: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });

export function setOrder(u: Unit, order: Order): void {
  u.order = order;
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

export function issue(s: Game, player: number, cmd: Command): Result {
  const p = s.players[player];
  if (!p || !p.alive) return fail('Oyuncu yok');
  switch (cmd.type) {
    case 'move': {
      for (const u of own(s, player, cmd.units)) setOrder(u, { kind: 'move', x: cmd.x, y: cmd.y });
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
    case 'rally': {
      const b = buildingById(s, cmd.building);
      if (!b || b.owner !== player) return fail('Bina yok');
      b.rallyTile = cmd.tile;
      return OK;
    }
  }
}
