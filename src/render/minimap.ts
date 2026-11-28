import { BUILDINGS } from '../sim/data';
import type { Game } from '../sim/types';

const TERRAIN = ['#4f8236', '#1f5a2a', '#b8324a', '#7fd8ff'];

export interface Ping { x: number; y: number; color: string; until: number }

/** A small overview of the whole map: what has been explored, who is where, and where to look now. */
export class Minimap {
  readonly canvas = document.createElement('canvas');
  private pings: Ping[] = [];
  private last = 0;

  constructor(private size: number, onJump: (x: number, y: number) => void) {
    this.canvas.id = 'minimap';
    this.canvas.width = this.canvas.height = size;
    document.body.appendChild(this.canvas);
    const jump = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      onJump((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    this.canvas.addEventListener('pointerdown', (e) => { jump(e); e.stopPropagation(); });
    this.canvas.addEventListener('pointermove', (e) => { if (e.buttons & 1) jump(e); });
  }

  ping(x: number, y: number, color: string): void {
    this.pings.push({ x, y, color, until: performance.now() + 6000 });
  }

  render(s: Game, me: number, colors: string[], view: { x: number; y: number; w: number; h: number }): void {
    const now = performance.now();
    if (now - this.last < 150) return;
    this.last = now;
    const c = this.canvas.getContext('2d')!;
    const k = this.size / s.w, fog = s.fog[me];
    c.fillStyle = '#05070a';
    c.fillRect(0, 0, this.size, this.size);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      if (!fog.explored[i]) continue;
      c.fillStyle = TERRAIN[s.terrain[i]] ?? TERRAIN[0];
      c.globalAlpha = fog.visible[i] ? 1 : 0.5;
      c.fillRect(x * k, y * k, k + 0.5, k + 0.5);
    }
    c.globalAlpha = 1;
    for (const b of s.buildings) {
      const size = BUILDINGS[b.type].size;
      if (b.owner !== me && !fog.explored[Math.floor(b.ty + size / 2) * s.w + Math.floor(b.tx + size / 2)]) continue;
      c.fillStyle = colors[b.owner] ?? '#888';
      c.fillRect(b.tx * k, b.ty * k, size * k, size * k);
    }
    for (const u of s.units) {
      if (!fog.visible[Math.floor(u.y) * s.w + Math.floor(u.x)]) continue;
      c.fillStyle = u.owner < 0 ? '#b08ad0' : colors[u.owner] ?? '#888';
      c.fillRect(u.x * k - 1.5, u.y * k - 1.5, 3, 3);
    }
    // The relic, always marked once found.
    if (fog.explored[Math.floor(s.relic.y) * s.w + Math.floor(s.relic.x)]) {
      c.strokeStyle = s.relic.owner >= 0 ? colors[s.relic.owner] : '#f2efe4';
      c.lineWidth = 2;
      c.strokeRect(s.relic.x * k - 4, s.relic.y * k - 4, 8, 8);
    }
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1;
    c.strokeRect(view.x * k, view.y * k, view.w * k, view.h * k);
    this.pings = this.pings.filter((p) => p.until > now);
    for (const p of this.pings) {
      const phase = ((now / 700) % 1);
      c.strokeStyle = p.color;
      c.lineWidth = 2;
      c.globalAlpha = 1 - phase;
      c.beginPath();
      c.arc(p.x * k, p.y * k, 3 + phase * 12, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }
  }
}
