import { isFighter } from './combat';
import { CFG, DT, KINDS, RACES, UNITS } from './data';
import { log } from './state';
import type { Game, Pact, ResourceKind } from './types';

const D = CFG.diplomacy;
const BIAS = D.bias as Record<string, number>;
export interface Answer { ok: boolean; reason?: string; needsConfirm?: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`.replace('-', '−'));
const others = (s: Game, ...skip: number[]) => s.players.filter((p) => p.alive && !skip.includes(p.id));

export function initDiplo(s: Game): void {
  const n = s.players.length;
  const grid = <T>(make: (a: number, b: number) => T): T[][] => s.players.map((_, a) => s.players.map((_, b) => make(a, b)));
  s.diplo = {
    relation: grid((a, b) => (a === b ? 0 : (BIAS[s.players[a].personality] ?? 0) + (BIAS[s.players[b].personality] ?? 0))),
    trust: new Array(n).fill(D.startTrust),
    pacts: grid(() => null),
    traitorUntil: new Array(n).fill(-1),
    coalitionUntil: new Array(n).fill(-1),
    giftWindow: grid(() => ({ start: -999, relation: 0 })),
    giftTrustAt: new Array(n).fill(-999),
    offers: [],
  };
}

export const relation = (s: Game, a: number, b: number): number => s.diplo.relation[a][b];
export const pactOf = (s: Game, a: number, b: number): Pact | null => (a < 0 || b < 0 ? null : s.diplo.pacts[a][b]);
export const isTraitor = (s: Game, p: number): boolean => s.time < s.diplo.traitorUntil[p];
export const coalitionAgainst = (s: Game, p: number): boolean => s.time < s.diplo.coalitionUntil[p];

/** Every change comes with its reason, shown in the "Neden?" log. */
export function addRelation(s: Game, a: number, b: number, delta: number, why: string): void {
  if (a === b || delta === 0) return;
  const v = clamp(s.diplo.relation[a][b] + delta, -100, 100);
  s.diplo.relation[a][b] = s.diplo.relation[b][a] = v;
  log(s, a, 'why', `${s.players[b].name} ile İlişki ${signed(delta)} (şimdi ${v}) — ${why}`);
  log(s, b, 'why', `${s.players[a].name} ile İlişki ${signed(delta)} (şimdi ${v}) — ${why}`);
}

export function addTrust(s: Game, p: number, delta: number, why: string): void {
  const before = s.diplo.trust[p];
  const v = clamp(before + delta, 0, 100);
  if (v === before) return;
  s.diplo.trust[p] = v;
  log(s, p, 'why', `Güvenilirlik ${signed(delta)} (şimdi ${v}) — ${why}`);
}

/** Total cost of a player's soldiers: the yardstick the AI uses to compare armies. */
export function power(s: Game, player: number): number {
  let total = 0;
  for (const u of s.units) {
    if (u.owner !== player || !isFighter(u)) continue;
    const c = UNITS[u.type].cost;
    total += (c.food ?? 0) + (c.wood ?? 0) + (c.crystal ?? 0) + (u.type === 'hero' ? 150 : 0);
  }
  return total;
}

function makePact(s: Game, a: number, b: number): void {
  const existing = s.diplo.pacts[a][b];
  const pact: Pact = { until: Math.max(s.time, existing?.until ?? 0) + D.pactSeconds, endsAt: -1, endedBy: -1 };
  s.diplo.pacts[a][b] = s.diplo.pacts[b][a] = pact;
  s.war[a][b] = s.war[b][a] = false;
  s.diplo.offers = s.diplo.offers.filter((o) => !((o.from === a && o.to === b) || (o.from === b && o.to === a)));
  for (const [x, y] of [[a, b], [b, a]]) log(s, x, 'pact', `${s.players[y].name} ile Saldırmazlık Paktı yürürlükte (${D.pactSeconds / 60} dk).`);
}

function dropPact(s: Game, a: number, b: number): void {
  s.diplo.pacts[a][b] = s.diplo.pacts[b][a] = null;
}

/** Whether the rules allow a pact between two players right now. */
export function pactAllowed(s: Game, from: number, to: number): Answer {
  if (from === to || !s.players[to]?.alive) return { ok: false, reason: 'Geçersiz taraf' };
  const pact = pactOf(s, from, to);
  if (pact && pact.endsAt >= 0) return { ok: false, reason: 'Fesih bildirildi; pakt bitmeden yenisi yapılamaz' };
  if (pact && pact.until - s.time > D.noticeSeconds) return { ok: false, reason: 'Pakt zaten yürürlükte' };
  if (isTraitor(s, from)) return { ok: false, reason: 'Hain damgası taşırken anlaşma yapamazsın' };
  if (isTraitor(s, to)) return { ok: false, reason: `${s.players[to].name} hain damgası taşıyor` };
  if (relation(s, from, to) < D.pactRelation) return { ok: false, reason: `İlişki yeterli değil (${relation(s, from, to)}/${D.pactRelation}). Hediye göndererek yükseltebilirsin.` };
  if (s.diplo.trust[from] < D.pactTrust || s.diplo.trust[to] < D.pactTrust) return { ok: false, reason: `Güvenilirlik en az ${D.pactTrust} olmalı` };
  return { ok: true };
}

/** How an AI answers an offer that the rules allow. Each personality weighs it differently. */
export function aiAccepts(s: Game, ai: number, from: number): Answer {
  const me = s.players[ai];
  if (coalitionAgainst(s, from)) return { ok: false, reason: 'Sözünü tutmayanla anlaşmam' };
  if (s.relic.owner === from) return { ok: false, reason: 'Kadim Harabe elindeyken seninle anlaşamam' };
  if (me.personality === 'trader') {
    if (s.diplo.trust[from] < 50) return { ok: false, reason: `Sana yeterince güvenmiyorum (Güvenilirlik ${s.diplo.trust[from]}/50)` };
    return { ok: true };
  }
  // The expander only wants peace while it is losing.
  if (power(s, ai) < power(s, from) * 0.7) return { ok: true };
  return { ok: false, reason: 'Güçlüyken anlaşmaya ihtiyacım yok' };
}

export function proposePact(s: Game, from: number, to: number): Answer {
  const allowed = pactAllowed(s, from, to);
  if (!allowed.ok) return allowed;
  const target = s.players[to];
  if (!target.isAI) {
    if (!s.diplo.offers.some((o) => o.from === from && o.to === to))
      s.diplo.offers.push({ from, to, expires: s.time + D.offerSeconds });
    log(s, to, 'offer', `${s.players[from].name} Saldırmazlık Paktı teklif ediyor.`);
    return { ok: true };
  }
  const answer = aiAccepts(s, to, from);
  if (!answer.ok) {
    log(s, from, 'why', `${target.name} paktı reddetti — ${answer.reason}`);
    return answer;
  }
  makePact(s, from, to);
  return { ok: true };
}

export function answerOffer(s: Game, to: number, from: number, accept: boolean): Answer {
  const offer = s.diplo.offers.find((o) => o.from === from && o.to === to);
  if (!offer) return { ok: false, reason: 'Teklif artık geçerli değil' };
  s.diplo.offers = s.diplo.offers.filter((o) => o !== offer);
  if (!accept) return { ok: true };
  const allowed = pactAllowed(s, from, to);
  if (!allowed.ok) return allowed;
  makePact(s, from, to);
  return { ok: true };
}

/** The honest way out: announce it, and the pact ends after the notice period. */
export function endPact(s: Game, by: number, other: number): Answer {
  const pact = pactOf(s, by, other);
  if (!pact) return { ok: false, reason: 'Aranızda pakt yok' };
  if (pact.endsAt >= 0) return { ok: false, reason: 'Fesih zaten bildirildi' };
  pact.endsAt = s.time + D.noticeSeconds;
  pact.endedBy = by;
  addTrust(s, by, -D.noticePenalty, `${s.players[other].name} ile paktı önceden bildirerek bitirdin.`);
  log(s, other, 'pact', `${s.players[by].name} paktı ${D.noticeSeconds} saniye sonra bitireceğini bildirdi.`);
  log(s, by, 'pact', `${s.players[other].name} ile pakt ${D.noticeSeconds} saniye sonra bitecek.`);
  return { ok: true };
}

/** Attacking a pact partner without notice: a lasting cost, and everyone hears about it. */
export function betray(s: Game, traitor: number, victim: number): void {
  dropPact(s, traitor, victim);
  const name = s.players[traitor].name;
  addTrust(s, traitor, -D.betrayalTrust, `${s.players[victim].name} ile paktın varken haber vermeden saldırdın.`);
  addRelation(s, traitor, victim, -D.betrayalVictim, `${name} paktı çiğnedi.`);
  for (const o of others(s, traitor, victim)) addRelation(s, traitor, o.id, -D.betrayalOthers, `${name} bir paktı çiğnedi; herkes bunu duydu.`);
  s.diplo.traitorUntil[traitor] = s.time + D.traitorSeconds;
  for (const o of others(s, traitor)) log(s, o.id, 'betrayal', `${name} bir paktı çiğnedi ve hain damgası yedi.`);
  if (s.diplo.trust[traitor] >= D.coalitionTrust) return;
  s.diplo.coalitionUntil[traitor] = s.time + D.coalitionSeconds;
  const rest = others(s, traitor);
  for (const p of s.players) if (p.alive) log(s, p.id, 'why', `${name} artık güvenilmez (Güvenilirlik ${s.diplo.trust[traitor]}): diğer halklar ona karşı birleşiyor.`);
  for (const a of rest) for (const b of rest) {
    if (a.id >= b.id || isTraitor(s, a.id) || isTraitor(s, b.id)) continue;
    if (a.isAI && b.isAI) makePact(s, a.id, b.id);
    else if (!pactOf(s, a.id, b.id)) {
      const [ai, human] = a.isAI ? [a.id, b.id] : [b.id, a.id];
      if (s.players[ai].isAI) s.diplo.offers.push({ from: ai, to: human, expires: s.time + D.offerSeconds });
    }
  }
}

/** Called when a attacks b. Returns whether the attack may go ahead and applies its diplomatic cost. */
export function openHostilities(s: Game, a: number, b: number, confirmed: boolean): Answer {
  if (s.time < s.peaceEnd) return { ok: false, reason: 'Barış süresi bitmeden başka bir halka saldıramazsın' };
  const pact = pactOf(s, a, b);
  if (pact) {
    if (!confirmed) return { ok: false, needsConfirm: true, reason: `${s.players[b].name} ile paktın var. Saldırırsan bu bir ihanet olur ve herkes bunu bilir.` };
    betray(s, a, b);
  } else if (!s.war[a][b]) {
    addRelation(s, a, b, -D.warRelation, `${s.players[a].name} savaş ilan etti.`);
  }
  if (!s.war[a][b]) {
    s.war[a][b] = s.war[b][a] = true;
    log(s, a, 'war', `${s.players[b].name} ile savaştasın.`);
    log(s, b, 'war', `${s.players[a].name} sana savaş ilan etti.`);
  }
  return { ok: true };
}

export function gift(s: Game, from: number, to: number, kind: ResourceKind, amount: number): Answer {
  const p = s.players[from], q = s.players[to];
  if (!q || !q.alive || from === to) return { ok: false, reason: 'Geçersiz taraf' };
  if (!KINDS.includes(kind) || !(amount > 0)) return { ok: false, reason: 'Geçersiz hediye' };
  if (p.res[kind] < amount) return { ok: false, reason: 'Yeterli kaynak yok' };
  p.res[kind] -= amount;
  q.res[kind] += amount;
  const w = s.diplo.giftWindow[from][to];
  if (s.time - w.start >= D.giftWindow) { w.start = s.time; w.relation = 0; }
  const gain = Math.min(Math.floor(amount / D.giftPerRelation), D.giftRelationMax - w.relation);
  w.relation += gain;
  s.diplo.giftWindow[to][from] = w;
  if (gain > 0) addRelation(s, from, to, gain, `${p.name} hediye gönderdi.`);
  else log(s, from, 'why', `Hediye ulaştı ama İlişki değişmedi — ${D.giftWindow / 60} dakikada en çok +${D.giftRelationMax} kazanılır.`);
  if (s.time - s.diplo.giftTrustAt[from] >= D.giftWindow) {
    s.diplo.giftTrustAt[from] = s.time;
    addTrust(s, from, D.giftTrust, 'Hediye gönderdin.');
  }
  return { ok: true };
}

export function stepDiplomacy(s: Game): void {
  const d = s.diplo;
  const minute = Math.abs((s.time % 60) - 0) < DT / 2 && s.time > 0;
  for (const a of s.players) {
    let active = 0;
    for (const b of s.players) {
      const pact = a.id === b.id ? null : d.pacts[a.id][b.id];
      if (!pact) continue;
      if (!a.alive || !b.alive) { dropPact(s, a.id, b.id); continue; }
      active++;
      // Sancak Kervanı: steady crystal for every pact in force.
      if (RACES[a.race].caravan) a.res.crystal += (D.caravanPerMinute / 60) * DT;
      if (a.id > b.id) continue;
      if (pact.endsAt >= 0 && s.time >= pact.endsAt) {
        dropPact(s, a.id, b.id);
        for (const [x, y] of [[a.id, b.id], [b.id, a.id]]) log(s, x, 'pact', `${s.players[y].name} ile pakt sona erdi.`);
      } else if (s.time >= pact.until) {
        dropPact(s, a.id, b.id);
        for (const x of [a.id, b.id]) addTrust(s, x, D.pactKeptTrust, 'Bir paktı süresinin sonuna kadar tuttun.');
      }
    }
    if (minute && active > 0 && a.alive) addTrust(s, a.id, D.trustPerMinute, 'Yürürlükte anlaşman var.');
  }
  d.offers = d.offers.filter((o) => s.time < o.expires && s.players[o.from].alive);
}
