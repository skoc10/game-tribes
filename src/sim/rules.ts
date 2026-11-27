import { isFighter } from './combat';
import { CFG, DT, TECHS } from './data';
import { addRelation, stepDiplomacy } from './diplomacy';
import { inPeace } from './relations';
import { log, removeBuilding } from './state';
import type { Game } from './types';

const everyone = (s: Game, kind: string, text: string): void => {
  for (const p of s.players) if (p.alive) log(s, p.id, kind, text);
};

function stepPeace(s: Game): void {
  // Compared in whole ticks so each announcement fires exactly once.
  const endTick = Math.ceil(s.peaceEnd * CFG.tickRate - 1e-9);
  const warnTick = endTick - CFG.peaceWarning * CFG.tickRate;
  if (warnTick > 0 && s.tick === warnTick) everyone(s, 'peace', `Barış ${CFG.peaceWarning} saniye sonra bitiyor!`);
  if (endTick > 0 && s.tick === endTick) everyone(s, 'peace', 'Boru çaldı: barış bitti. Kadim Harabe uyandı!');
}

function stepResearch(s: Game): void {
  for (const b of s.buildings) {
    if (!b.research || b.progress < 1) continue;
    b.research.remaining -= DT;
    if (b.research.remaining > 0) continue;
    const p = s.players[b.owner];
    if (b.research.id === 'age2') {
      p.age = 2;
      log(s, p.id, 'age', 'Kale Çağı\'na ulaştın! Okçu, süvari ve Demirci açıldı.');
    } else {
      p.upgrades.push(b.research.id);
      log(s, p.id, 'tech', `${TECHS[b.research.id].name} araştırıldı.`);
    }
    b.research = null;
  }
}

/** The relic is taken by keeping soldiers beside it, alone, for the capture time. */
function stepRelic(s: Game): void {
  const r = s.relic;
  if (inPeace(s)) return;
  const present = new Set<number>();
  for (const u of s.units) {
    if (u.owner < 0 || !isFighter(u)) continue;
    if ((u.x - r.x) ** 2 + (u.y - r.y) ** 2 <= CFG.relic.radius ** 2) present.add(u.owner);
  }
  const sole = present.size === 1 ? [...present][0] : -1;
  if (sole >= 0 && sole !== r.owner) {
    if (r.captor !== sole) { r.captor = sole; r.progress = 0; }
    r.progress += DT;
    if (r.progress >= CFG.relic.captureTime) {
      if (r.owner >= 0) addRelation(s, sole, r.owner, -CFG.diplomacy.relicRelation, `${s.players[sole].name} Kadim Harabe'yi elinden aldı.`);
      r.owner = sole; r.captor = -1; r.progress = 0; r.heldSince = s.time;
      everyone(s, 'relic', `${s.players[sole].name} Kadim Harabe'yi ele geçirdi. ${CFG.relic.holdToWin / 60} dakika tutarsa kazanır!`);
    }
  } else if (present.size === 0 || sole === r.owner) {
    r.captor = -1; r.progress = 0;
  }
  if (r.owner >= 0) {
    s.players[r.owner].res.crystal += (CFG.relic.crystalPerMinute / 60) * DT;
    if (s.time - r.heldSince >= CFG.relic.holdToWin) { s.winner = r.owner; s.winKind = 'relic'; }
  }
}

/** A player without an Ana Merkez has a grace period to rebuild before being eliminated. */
function stepElimination(s: Game): void {
  for (const p of s.players) {
    if (!p.alive) continue;
    const has = (done: boolean) => s.buildings.some((b) => b.owner === p.id && b.type === 'towncenter' && (!done || b.progress >= 1));
    if (has(true)) { p.tcLostAt = -1; continue; }
    if (p.tcLostAt < 0) {
      p.tcLostAt = s.time;
      log(s, p.id, 'danger', `Ana Merkez'in yıkıldı! ${CFG.eliminationGrace} saniye içinde yenisini kurmazsan elenirsin.`);
    }
    // A replacement under construction buys time, but only up to twice the grace period.
    const waited = s.time - p.tcLostAt;
    if (waited < CFG.eliminationGrace || (has(false) && waited < CFG.eliminationGrace * 2)) continue;
    // The last player standing is never removed: they win instead.
    if (s.players.filter((o) => o.alive).length <= 1) continue;
    p.alive = false;
    s.units = s.units.filter((u) => u.owner !== p.id);
    for (const b of s.buildings.filter((o) => o.owner === p.id)) removeBuilding(s, b);
    if (s.relic.owner === p.id) s.relic.owner = -1;
    if (s.relic.captor === p.id) { s.relic.captor = -1; s.relic.progress = 0; }
    everyone(s, 'eliminated', `${p.name} elendi.`);
  }
  const alive = s.players.filter((p) => p.alive);
  if (alive.length === 1 && s.players.length > 1 && s.winner < 0) { s.winner = alive[0].id; s.winKind = 'conquest'; }
}

export function stepRules(s: Game): void {
  stepPeace(s);
  stepResearch(s);
  // Elimination first, so a player removed this tick cannot also win with the relic.
  stepElimination(s);
  if (s.winner < 0) stepRelic(s);
  stepDiplomacy(s);
}

/** Seconds until the relic holder wins, or -1 if nobody holds it. */
export function relicCountdown(s: Game): number {
  return s.relic.owner < 0 ? -1 : Math.max(0, CFG.relic.holdToWin - (s.time - s.relic.heldSince));
}
