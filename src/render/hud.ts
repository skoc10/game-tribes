import { agePrereqCount } from '../sim/commands';
import { BUILDINGS, CFG, RACES, TECHS, UNITS, canAfford, techCost, unitCost } from '../sim/data';
import { isTraitor, pactOf } from '../sim/diplomacy';
import { inPeace } from '../sim/relations';
import { relicCountdown } from '../sim/rules';
import { buildingById, idleVillagers, popCap, popUsed, unitById } from '../sim/state';
import type { Cost, Game } from '../sim/types';

export interface HudView {
  s: Game; me: number; speed: number; paused: boolean;
  selUnits: number[]; selBuilding: number; placing: string | null;
  showDiplomacy: boolean;
  voice: { enabled: boolean };
}

const COLORS = ['#4c8dff', '#e5533d', '#e3c341', '#b565e0'];

/** A face for the number, so the mood of a rival can be read at a glance. */
function mood(relation: number, atWar: boolean): string {
  if (atWar) return '😠 Düşman';
  if (relation >= 40) return '🙂 Dostane';
  if (relation >= 0) return '😐 Nötr';
  return '🤨 Şüpheli';
}

const ICON = { food: '🍖', wood: '🪵', crystal: '💎' } as const;

export function costText(cost: Cost): string {
  return (Object.keys(ICON) as (keyof typeof ICON)[])
    .filter((k) => cost[k]).map((k) => `${ICON[k]}${cost[k]}`).join(' ') || 'ücretsiz';
}

function clock(t: number): string {
  const m = Math.floor(t / 60), sec = Math.floor(t % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** DOM overlay. Re-renders a region only when its HTML actually changes, so buttons stay clickable. */
export class Hud {
  private top = document.getElementById('topbar')!;
  private panel = document.getElementById('panel')!;
  private toastEl = document.getElementById('toast')!;
  private lastTop = '';
  private lastPanel = '';
  private side = document.getElementById('side')!;
  private lastSide = '';
  private toastTimer = 0;

  constructor(onAction: (action: string, arg: string) => void) {
    // pointerdown, not click: a region may be re-rendered between press and release, which would swallow a click.
    document.body.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!el) return;
      const [action, arg = ''] = el.dataset.act!.split(':');
      onAction(action, arg);
    });
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.style.display = 'block';
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.style.display = 'none'), 2500);
  }

  render(v: HudView): void {
    const top = this.topHtml(v);
    if (top !== this.lastTop) { this.top.innerHTML = top; this.lastTop = top; }
    const panel = this.panelHtml(v);
    if (panel !== this.lastPanel) { this.panel.innerHTML = panel; this.lastPanel = panel; }
    const side = v.showDiplomacy ? this.sideHtml(v) : '';
    if (side !== this.lastSide) { this.side.innerHTML = side; this.side.style.display = side ? 'block' : 'none'; this.lastSide = side; }
  }

  private topHtml(v: HudView): string {
    const p = v.s.players[v.me];
    const idle = idleVillagers(v.s, v.me).length;
    const speedBtn = (n: number) => `<button data-act="speed:${n}" class="${!v.paused && v.speed === n ? 'on' : ''}">${n}x</button>`;
    return [
      `<b>${p.name}</b>`,
      `<span class="stat">${ICON.food} ${Math.floor(p.res.food)}</span>`,
      `<span class="stat">${ICON.wood} ${Math.floor(p.res.wood)}</span>`,
      `<span class="stat">${ICON.crystal} ${Math.floor(p.res.crystal)}</span>`,
      `<span class="stat">👥 ${popUsed(v.s, v.me)}/${popCap(v.s, v.me)}</span>`,
      `<span class="stat">Çağ ${p.age}</span>`,
      this.ageTop(v),
      this.extraTop(v),
      `<span class="grow"></span>`,
      `<button data-act="diplomacy" class="${v.showDiplomacy ? 'on' : ''}">🤝 Diplomasi${v.s.diplo.offers.some((o) => o.to === v.me) ? ' ❗' : ''}</button>`,
      `<button data-act="hero">⭐ Kahraman ${p.heroRespawn >= 0 ? `(${Math.max(0, Math.ceil(p.heroRespawn - v.s.time))} sn)` : `Sv. ${p.heroLevel}`}</button>`,
      `<button data-act="army">⚔ Tüm askerler</button>`,
      idle > 0 ? `<button data-act="idle" class="warn">💤 Boşta köylü: ${idle}</button>` : '',
      `<span class="stat">⏱ ${clock(v.s.time)}</span>`,
      `<button data-act="sound" title="Sesli ikazlar">${v.voice.enabled ? '🔊' : '🔇'}</button>`,
      `<button data-act="pause" class="${v.paused ? 'on' : ''}">${v.paused ? '▶ Devam' : '⏸ Duraklat'}</button>`,
      speedBtn(0.5), speedBtn(1), speedBtn(1.5),
    ].join('');
  }

  /** The road to the Kale Çağı, always in view: archers, riders and the Demirci all wait behind it. */
  private ageTop(v: HudView): string {
    const s = v.s, p = s.players[v.me];
    if (p.age >= 2) return '';
    const busy = s.buildings.find((b) => b.owner === v.me && b.research?.id === 'age2');
    if (busy) return `<span class="stat">⬆ Kale Çağı %${Math.floor((1 - busy.research!.remaining / busy.research!.total) * 100)}</span>`;
    const have = agePrereqCount(s, v.me);
    if (have < CFG.age2.prereq) return `<button data-act="ageTop" title="Okçu, süvari ve Demirci Kale Çağı'nda açılır">⬆ Kale Çağı: önce Ev, Çiftlik, Kışla'dan ${CFG.age2.prereq} farklısını kur (${have}/${CFG.age2.prereq})</button>`;
    if (!canAfford(p, CFG.age2.cost)) return `<button data-act="ageTop" title="Okçu, süvari ve Demirci Kale Çağı'nda açılır">⬆ Kale Çağı: ${costText(CFG.age2.cost)} biriktir</button>`;
    return `<button data-act="ageTop" class="on">⬆ Kale Çağı'na geç! <small>okçu, süvari, Demirci</small></button>`;
  }

  /** Peace timer and relic status: the two clocks every player must be able to see. */
  protected extraTop(v: HudView): string {
    const s = v.s, r = s.relic;
    const peace = inPeace(s)
      ? `<span class="stat" title="Bu süre bitene kadar kimse kimseye saldıramaz">🕊 Barış: ${clock(s.peaceEnd - s.time)}</span>`
      : `<span class="stat">⚔ Barış bitti</span>`;
    let relic = '🏛 Harabe: uykuda';
    if (!inPeace(s)) {
      if (r.owner >= 0) relic = `🏛 Harabe: <b>${s.players[r.owner].name}</b> — zafere ${clock(relicCountdown(s))}${r.counting ? '' : ' ⏸ (başında asker yok ya da düşman var)'}`;
      else if (r.captor >= 0) relic = `🏛 Harabe: ${s.players[r.captor].name} ele geçiriyor %${Math.floor((r.progress / CFG.relic.captureTime) * 100)}`;
      else relic = '🏛 Harabe: sahipsiz';
    }
    return `${peace}<span class="stat">${relic}</span>`;
  }

  private panelHtml(v: HudView): string {
    const { s, me } = v;
    const p = s.players[me];
    if (v.placing) return `<span>📍 <b>${BUILDINGS[v.placing].name}</b> için yer seç. Sol tık: kur, Esc: vazgeç.</span>`;
    const b = v.selBuilding ? buildingById(s, v.selBuilding) : undefined;
    if (b) {
      const def = BUILDINGS[b.type];
      const parts = [`<span><b>${def.name}</b><br>❤ ${Math.ceil(b.hp)}/${b.maxHp}</span>`];
      if (b.owner !== me) return parts.join('');
      if (b.progress < 1) parts.push(`<span>İnşa ediliyor: %${Math.floor(b.progress * 100)}</span><button data-act="cancel">İptal<small>kaynak geri gelir</small></button>`);
      else {
        for (const u of def.trains)
          parts.push(`<button data-act="train:${u}">${UNITS[u].name}<small>${costText(unitCost(p, u))}</small></button>`);
        if (b.type === 'towncenter')
          parts.push(`<button data-act="auto" class="${b.autoVillager ? 'on' : ''}">Köylü üretimini sürdür<small>${b.autoVillager ? 'açık' : 'kapalı'}</small></button>`);
        parts.push(this.extraBuilding(v, b.id));
        if (b.queue.length)
          parts.push(`<span>Sıra: ${b.queue.map((q, i) => UNITS[q.unit].name + (i === 0 ? ` %${Math.floor((1 - q.remaining / q.total) * 100)}` : '')).join(', ')}</span>`);
      }
      return parts.join('');
    }
    const units = v.selUnits.map((id) => unitById(s, id)).filter((u) => !!u);
    if (units.length === 0)
      return `<span class="help">Sol tık / sürükle: seç · Sağ tık: git, topla, kur, saldır · Shift+sağ tık: saldırarak ilerle · Q: ordu · H: kahraman · Yabancı birliklerin altındaki halka: <b style="color:#ff4d4d">kırmızı</b> savaştasınız, <b style="color:#4ade80">yeşil</b> paktınız var, <b>beyaz</b> anlaşma yok · Ok tuşları veya WASD: kamera · Tekerlek: yakınlaş · Boşluk: duraklat</span>`;
    const counts = new Map<string, number>();
    for (const u of units) counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
    const parts = [`<span><b>${[...counts].map(([t, n]) => `${n} ${UNITS[t].name}`).join(', ')}</b><br>${RACES[p.race].name}</span>`];
    if (counts.has('scout')) parts.push(`<button data-act="explore">🧭 Otomatik keşfet<small>kamplara girmez</small></button>`);
    if (counts.has('villager')) {
      for (const [id, def] of Object.entries(BUILDINGS)) {
        // Locked buildings stay visible, so it is clear they exist and what unlocks them.
        if (def.age > p.age) { parts.push(`<button data-act="locked" class="locked">🔒 ${def.name}<small>Kale Çağı gerekir</small></button>`); continue; }
        parts.push(`<button data-act="build:${id}">${def.name}<small>${costText(def.cost)}</small></button>`);
      }
    }
    return parts.join('');
  }

  protected extraBuilding(v: HudView, building: number): string {
    const s = v.s, p = s.players[v.me], b = buildingById(s, building)!;
    const parts: string[] = [];
    if (b.research) {
      const name = b.research.id === 'age2' ? 'Kale Çağı' : TECHS[b.research.id].name;
      parts.push(`<span>🔬 ${name}: %${Math.floor((1 - b.research.remaining / b.research.total) * 100)}</span>`);
    } else if (b.type === 'towncenter' && p.age < 2) {
      const have = agePrereqCount(s, v.me);
      const need = have < CFG.age2.prereq ? `önce Ev, Çiftlik, Kışla'dan ${CFG.age2.prereq} farklısı (${have}/${CFG.age2.prereq})` : costText(CFG.age2.cost);
      parts.push(`<button data-act="ageUp">⬆ Kale Çağı'na geç<small>${need}</small></button>`);
    } else if (b.type === 'blacksmith') {
      for (const id of Object.keys(TECHS)) {
        if (p.upgrades.includes(id)) parts.push(`<span>✔ ${TECHS[id].name}</span>`);
        else parts.push(`<button data-act="research:${id}" title="${TECHS[id].text}">${TECHS[id].name}<small>${costText(techCost(p, id))}</small></button>`);
      }
    }
    return parts.join('');
  }

  /** Diplomacy panel: every rival's mood and numbers, what can be done, and the reasons behind each change. */
  private sideHtml(v: HudView): string {
    const s = v.s, me = v.me, d = s.diplo, D = CFG.diplomacy;
    const out = [`<b>Güvenilirliğin: ${d.trust[me]}</b>${isTraitor(s, me) ? ` — 🚫 Hain damgası (${clock(d.traitorUntil[me] - s.time)})` : ''}`];
    for (const o of d.offers.filter((x) => x.to === me))
      out.push(`<div class="rival">📜 <b>${s.players[o.from].name}</b> pakt teklif ediyor.<br><button data-act="accept:${o.from}">Kabul et</button><button data-act="reject:${o.from}">Reddet</button></div>`);
    for (const p of s.players) {
      if (p.id === me) continue;
      if (!p.alive) { out.push(`<div class="rival"><span class="dot" style="background:${COLORS[p.id]}"></span><s>${p.name}</s> — elendi</div>`); continue; }
      const pact = pactOf(s, me, p.id), war = s.war[me][p.id] && !pact;
      let state = war ? '⚔ Savaştasınız' : 'Anlaşma yok';
      if (pact) state = pact.endsAt >= 0 ? `📜 Pakt bitiyor: ${clock(pact.endsAt - s.time)}` : `📜 Pakt: ${clock(pact.until - s.time)}`;
      const buttons: string[] = [];
      if (!pact || pact.until - s.time <= D.noticeSeconds) buttons.push(`<button data-act="pact:${p.id}" title="İlişki en az ${D.pactRelation}, Güvenilirlik en az ${D.pactTrust} olmalı">${pact ? 'Paktı yenile' : 'Pakt teklif et'}</button>`);
      if (pact && pact.endsAt < 0) buttons.push(`<button data-act="endpact:${p.id}" title="${D.noticeSeconds} sn önceden haber verirsin; Güvenilirlik −${D.noticePenalty}">Paktı bitir</button>`);
      buttons.push(`<button data-act="gift:${p.id}-food" title="İlişkiyi yükseltir">🎁 ${D.giftAmount} 🍖</button><button data-act="gift:${p.id}-wood" title="İlişkiyi yükseltir">🎁 ${D.giftAmount} 🪵</button>`);
      out.push(`<div class="rival"><span class="dot" style="background:${COLORS[p.id]}"></span><b>${p.name}</b><br>${mood(d.relation[me][p.id], war)} · İlişki ${d.relation[me][p.id]} · Güvenilirlik ${d.trust[p.id]}<br>${state}<br>${buttons.join('')}</div>`);
    }
    const why = s.events.filter((e) => e.player === me && e.kind === 'why').slice(-6).reverse();
    out.push('<h3>Neden?</h3>' + (why.length ? why.map((e) => `<div class="why">${clock(e.time)} · ${e.text}</div>`).join('') : '<div class="why">Henüz bir değişiklik yok.</div>'));
    return out.join('');
  }

  /** Asks before an irreversible choice such as breaking a pact. */
  confirm(text: string): void {
    document.getElementById('confirm')?.remove();
    const el = document.createElement('div');
    el.id = 'confirm';
    el.innerHTML = `<div>⚠️ ${text}<br><b>Emin misin?</b><br><button data-act="confirmYes" class="warn">Evet, saldır</button><button data-act="confirmNo">Vazgeç</button></div>`;
    document.body.appendChild(el);
  }

  /** Full-screen result once the match is decided. */
  renderResult(v: HudView): void {
    const s = v.s;
    const out = !s.players[v.me].alive;
    if ((s.winner < 0 && !out) || document.getElementById('result')) return;
    const won = s.winner === v.me;
    const how = s.winKind === 'relic' ? `Kadim Harabe'yi ${CFG.relic.holdToWin / 60} dakika elinde tuttu` : 'ayakta kalan son halk oldu';
    const line = s.winner >= 0 ? `<b>${s.players[s.winner].name}</b> ${how}.` : 'Ana Merkez\'in yıkıldı ve zamanında yenisini kuramadın.';
    const el = document.createElement('div');
    el.id = 'result';
    el.innerHTML = `<h1>${won ? '🏆 Zafer!' : out ? 'Elendin' : 'Maç bitti'}</h1><div>${line}</div><div>Süre: ${clock(s.time)}</div><button data-act="restart">Yeniden oyna</button>`;
    document.body.appendChild(el);
  }
}
