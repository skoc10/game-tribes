import { BUILDINGS, RACES, UNITS, unitCost } from '../sim/data';
import { buildingById, idleVillagers, popCap, popUsed, unitById } from '../sim/state';
import type { Cost, Game } from '../sim/types';

export interface HudView {
  s: Game; me: number; speed: number; paused: boolean;
  selUnits: number[]; selBuilding: number; placing: string | null;
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
      this.extraTop(v),
      `<span class="grow"></span>`,
      `<button data-act="hero">⭐ Kahraman ${p.heroRespawn >= 0 ? `(${Math.max(0, Math.ceil(p.heroRespawn - v.s.time))} sn)` : `Sv. ${p.heroLevel}`}</button>`,
      `<button data-act="army">⚔ Tüm askerler</button>`,
      idle > 0 ? `<button data-act="idle" class="warn">💤 Boşta köylü: ${idle}</button>` : '',
      `<span class="stat">⏱ ${clock(v.s.time)}</span>`,
      `<button data-act="pause" class="${v.paused ? 'on' : ''}">${v.paused ? '▶ Devam' : '⏸ Duraklat'}</button>`,
      speedBtn(0.5), speedBtn(1), speedBtn(1.5),
    ].join('');
  }

  /** Hook for later phases (peace timer, relic countdown). */
  protected extraTop(_v: HudView): string { return ''; }

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
      return `<span class="help">Sol tık / sürükle: seç · Sağ tık: git, topla, kur, saldır · Shift+sağ tık: saldırarak ilerle · Q: ordu · H: kahraman · Ok tuşları veya WASD: kamera · Tekerlek: yakınlaş · Boşluk: duraklat</span>`;
    const counts = new Map<string, number>();
    for (const u of units) counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
    const parts = [`<span><b>${[...counts].map(([t, n]) => `${n} ${UNITS[t].name}`).join(', ')}</b><br>${RACES[p.race].name}</span>`];
    if (counts.has('scout')) parts.push(`<button data-act="explore">🧭 Otomatik keşfet<small>kamplara girmez</small></button>`);
    if (counts.has('villager')) {
      for (const [id, def] of Object.entries(BUILDINGS)) {
        if (def.age > p.age) continue;
        parts.push(`<button data-act="build:${id}">${def.name}<small>${costText(def.cost)}</small></button>`);
      }
    }
    return parts.join('');
  }

  /** Hook for later phases (age up, research). */
  protected extraBuilding(_v: HudView, _building: number): string { return ''; }
}
