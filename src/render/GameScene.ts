import Phaser from 'phaser';
import { clsOf, isFighter, maxHp, multiplier } from '../sim/combat';
import { issue, type Command } from '../sim/commands';
import { BUILDINGS, CFG, DT, UNITS } from '../sim/data';
import { isExplored, isVisible } from '../sim/fog';
import { buildingById, canPlace, idleVillagers, isResource, unitById } from '../sim/state';
import { inPeace } from '../sim/relations';
import { step } from '../sim/step';
import { T_BUSH, T_CRYSTAL, T_TREE, type Building, type Game, type Unit } from '../sim/types';
import { Hud } from './hud';

export const TILE = 32;
export const PLAYER_COLORS = [0x4c8dff, 0xe5533d, 0xe3c341, 0xb565e0];
const TERRAIN_COLOR: Record<number, number> = { [T_TREE]: 0x1f5a2a, [T_BUSH]: 0xb8324a, [T_CRYSTAL]: 0x7fd8ff };

export class GameScene extends Phaser.Scene {
  s!: Game;
  me = 0;
  speed = 1;
  paused = false;
  selUnits: number[] = [];
  selBuilding = 0;
  placing: string | null = null;
  hud!: Hud;

  private acc = 0;
  private drawnMap = -1;
  private drawnFog = -1;
  private seenEvents = 0;
  private fogG!: Phaser.GameObjects.Graphics;
  private terrainG!: Phaser.GameObjects.Graphics;
  protected entG!: Phaser.GameObjects.Graphics;
  protected overG!: Phaser.GameObjects.Graphics;
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private dragStart: Phaser.Math.Vector2 | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() { super('game'); }

  init(data: { game: Game; me: number }): void {
    this.s = data.game;
    this.me = data.me;
  }

  create(): void {
    const s = this.s;
    this.terrainG = this.add.graphics();
    this.entG = this.add.graphics().setDepth(2);
    this.fogG = this.add.graphics().setDepth(3.5);
    this.overG = this.add.graphics().setDepth(4);
    const cam = this.cameras.main;
    cam.setBounds(-TILE * 2, -TILE * 4, (s.w + 4) * TILE, (s.h + 8) * TILE);
    cam.centerOn(s.bases[this.me].x * TILE, s.bases[this.me].y * TILE);
    this.hud = this.createHud();

    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-SPACE', () => (this.paused = !this.paused));
    this.input.keyboard!.on('keydown-ESC', () => { this.placing = null; this.selUnits = []; this.selBuilding = 0; });
    this.input.keyboard!.on('keydown-PERIOD', () => this.selectIdle());
    this.input.keyboard!.on('keydown-Q', () => this.selectArmy());
    this.input.keyboard!.on('keydown-H', () => this.selectHero());
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.4, 2));
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
  }

  protected createHud(): Hud {
    return new Hud((action, arg) => this.onHud(action, arg));
  }

  /** Sends a command for the local player and shows the reason if it is refused. */
  protected cmd(c: Command): boolean {
    const r = issue(this.s, this.me, c);
    if (!r.ok && r.reason) this.hud.toast(r.reason);
    return r.ok;
  }

  protected onHud(action: string, arg: string): void {
    switch (action) {
      case 'speed': this.speed = Number(arg); this.paused = false; break;
      case 'pause': this.paused = !this.paused; break;
      case 'idle': this.selectIdle(); break;
      case 'train': this.cmd({ type: 'train', building: this.selBuilding, unit: arg }); break;
      case 'build': this.placing = arg; break;
      case 'cancel': this.cmd({ type: 'cancel', building: this.selBuilding }); break;
      case 'ageUp': this.cmd({ type: 'ageUp', building: this.selBuilding }); break;
      case 'research': this.cmd({ type: 'research', building: this.selBuilding, tech: arg }); break;
      case 'restart': location.reload(); break;
      case 'explore': this.cmd({ type: 'explore', units: this.selUnits }); break;
      case 'army': this.selectArmy(); break;
      case 'hero': this.selectHero(); break;
      case 'auto': {
        const b = buildingById(this.s, this.selBuilding);
        if (b) this.cmd({ type: 'autoVillager', building: b.id, on: !b.autoVillager });
        break;
      }
    }
  }

  private selectIdle(): void {
    const idle = idleVillagers(this.s, this.me);
    if (idle.length === 0) return;
    const current = idle.findIndex((u) => u.id === this.selUnits[0]);
    const u = idle[(current + 1) % idle.length];
    this.selUnits = [u.id];
    this.selBuilding = 0;
    this.cameras.main.centerOn(u.x * TILE, u.y * TILE);
  }

  private selectArmy(): void {
    this.selUnits = this.s.units.filter((u) => u.owner === this.me && isFighter(u)).map((u) => u.id);
    this.selBuilding = 0;
  }

  private selectHero(): void {
    const hero = this.s.units.find((u) => u.owner === this.me && u.type === 'hero');
    if (!hero) return this.hud.toast('Kahramanın şu an yeniden doğmayı bekliyor');
    this.selUnits = [hero.id];
    this.selBuilding = 0;
    this.cameras.main.centerOn(hero.x * TILE, hero.y * TILE);
  }

  private world(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const w = this.world(p);
    if (p.rightButtonDown()) {
      if (this.placing) { this.placing = null; return; }
      this.rightClick(w.x / TILE, w.y / TILE, p.event.shiftKey);
      return;
    }
    if (this.placing) {
      const size = BUILDINGS[this.placing].size;
      const tx = Math.floor(w.x / TILE - size / 2 + 0.5), ty = Math.floor(w.y / TILE - size / 2 + 0.5);
      if (this.cmd({ type: 'build', units: this.selUnits, building: this.placing, tx, ty }) && !p.event.shiftKey) this.placing = null;
      return;
    }
    this.dragStart = w.clone();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.dragStart) return;
    const a = this.dragStart, b = this.world(p);
    this.dragStart = null;
    const x0 = Math.min(a.x, b.x) / TILE, x1 = Math.max(a.x, b.x) / TILE;
    const y0 = Math.min(a.y, b.y) / TILE, y1 = Math.max(a.y, b.y) / TILE;
    if (x1 - x0 < 0.3 && y1 - y0 < 0.3) return this.clickSelect(b.x / TILE, b.y / TILE);
    const mine = this.s.units.filter((u) => u.owner === this.me && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
    // A box that catches soldiers should not also drag villagers off their work.
    const army = mine.filter((u) => u.type !== 'villager');
    this.selUnits = (army.length ? army : mine).map((u) => u.id);
    this.selBuilding = 0;
  }

  protected unitAt(x: number, y: number, pred: (u: Unit) => boolean): Unit | undefined {
    let best: Unit | undefined, bestD = 0.6 * 0.6;
    for (const u of this.s.units) {
      const d = (u.x - x) ** 2 + (u.y - y) ** 2;
      if (d < bestD && pred(u)) { best = u; bestD = d; }
    }
    return best;
  }

  protected buildingAt(x: number, y: number): Building | undefined {
    if (x < 0 || y < 0 || x >= this.s.w || y >= this.s.h) return undefined;
    const id = this.s.occ[Math.floor(y) * this.s.w + Math.floor(x)];
    return id ? buildingById(this.s, id) : undefined;
  }

  private clickSelect(x: number, y: number): void {
    const u = this.unitAt(x, y, (o) => o.owner === this.me);
    const b = u ? undefined : this.buildingAt(x, y);
    this.selUnits = u ? [u.id] : [];
    this.selBuilding = b && this.canInspect(b) ? b.id : 0;
  }

  protected canInspect(b: Building): boolean {
    const half = BUILDINGS[b.type].size / 2;
    return b.owner === this.me || isExplored(this.s, this.me, b.tx + half, b.ty + half);
  }

  /** Context command for the current selection at a world position (in tiles). */
  protected rightClick(x: number, y: number, attackMove = false): void {
    const s = this.s;
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    const tile = Math.floor(y) * s.w + Math.floor(x);
    if (this.selBuilding && isResource(s.terrain[tile])) {
      if (this.cmd({ type: 'rally', building: this.selBuilding, tile })) this.hud.toast('Toplanma noktası ayarlandı');
      return;
    }
    if (this.selUnits.length === 0) return;
    const enemy = this.unitAt(x, y, (o) => o.owner !== this.me && this.visibleAt(o.x, o.y));
    const b = this.buildingAt(x, y);
    const canFight = this.selUnits.some((id) => { const u = unitById(s, id); return !!u && isFighter(u); });
    if (!canFight && (enemy || (b && b.owner !== this.me))) {
      this.cmd({ type: 'move', units: this.selUnits, x, y });
    } else if (enemy) {
      this.cmd({ type: 'attack', units: this.selUnits, target: enemy.id, building: false });
    } else if (b && b.owner !== this.me && this.canInspect(b)) {
      this.cmd({ type: 'attack', units: this.selUnits, target: b.id, building: true });
    } else if (b && b.owner === this.me && (b.progress < 1 || b.type === 'farm')) {
      this.cmd({ type: 'assist', units: this.selUnits, building: b.id });
    } else if (isResource(s.terrain[tile])) {
      this.cmd({ type: 'gather', units: this.selUnits, tile });
    } else {
      this.cmd({ type: attackMove ? 'attackMove' : 'move', units: this.selUnits, x, y });
    }
  }

  update(_time: number, delta: number): void {
    const cam = this.cameras.main;
    const pan = (600 * delta) / 1000 / cam.zoom;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) cam.scrollX -= pan;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) cam.scrollX += pan;
    if (this.keys.W.isDown || this.keys.UP.isDown) cam.scrollY -= pan;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) cam.scrollY += pan;

    if (!this.paused) {
      this.acc += Math.min(delta, 250) / 1000 * this.speed;
      while (this.acc >= DT) { step(this.s); this.acc -= DT; }
    }
    this.selUnits = this.selUnits.filter((id) => unitById(this.s, id));
    if (this.selBuilding && !buildingById(this.s, this.selBuilding)) this.selBuilding = 0;
    this.afterStep();

    if (this.drawnMap !== this.s.mapVersion) this.drawTerrain();
    if (this.drawnFog !== this.s.fogVersion) this.drawFog();
    this.drawEntities();
    this.drawOverlay();
    this.hud.render(this);
    this.hud.renderResult(this);
  }

  /** Shows floating text for events that happened where the player can see them. */
  protected afterStep(): void {
    const events = this.s.events;
    for (; this.seenEvents < events.length; this.seenEvents++) {
      const e = events[this.seenEvents];
      if (e.player !== this.me) continue;
      if (e.kind === 'loot' || e.kind === 'level') this.floatText(e.text, e.x ?? 0, e.y ?? 0, e.kind === 'loot' ? '#ffd24a' : '#9be7ff');
      else this.hud.toast(e.text);
    }
  }

  protected floatText(text: string, x: number, y: number, color: string): void {
    const t = this.add.text(x * TILE, y * TILE, text, { fontSize: '16px', fontStyle: 'bold', color, stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: t, y: t.y - 60, alpha: 0, duration: 2200, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
    // A burst of coins makes loot impossible to miss.
    if (color === '#ffd24a') for (let i = 0; i < 10; i++) {
      const c = this.add.circle(x * TILE, y * TILE, 4, 0xffd24a).setDepth(5);
      const a = (i / 10) * Math.PI * 2;
      this.tweens.add({ targets: c, x: c.x + Math.cos(a) * 50, y: c.y + Math.sin(a) * 50, alpha: 0, duration: 900, onComplete: () => c.destroy() });
    }
  }

  private drawTerrain(): void {
    const s = this.s, g = this.terrainG;
    g.clear();
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const t = s.terrain[y * s.w + x];
      g.fillStyle((x + y) % 2 ? 0x5d9140 : 0x588a3c).fillRect(x * TILE, y * TILE, TILE, TILE);
      if (t === T_TREE) g.fillStyle(TERRAIN_COLOR[t]).fillCircle(x * TILE + 16, y * TILE + 16, 14);
      else if (t === T_BUSH) { g.fillStyle(0x2f6b2f).fillCircle(x * TILE + 16, y * TILE + 16, 12); g.fillStyle(TERRAIN_COLOR[t]).fillCircle(x * TILE + 12, y * TILE + 13, 4).fillCircle(x * TILE + 20, y * TILE + 19, 4); }
      else if (t === T_CRYSTAL) g.fillStyle(TERRAIN_COLOR[t]).fillTriangle(x * TILE + 16, y * TILE + 3, x * TILE + 28, y * TILE + 28, x * TILE + 4, y * TILE + 28);
    }
    this.drawnMap = s.mapVersion;
  }

  private drawFog(): void {
    const s = this.s, g = this.fogG, fog = s.fog[this.me];
    g.clear();
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      if (fog.visible[i]) continue;
      g.fillStyle(0x05070a, fog.explored[i] ? 0.5 : 1).fillRect(x * TILE, y * TILE, TILE, TILE);
    }
    this.drawnFog = s.fogVersion;
  }

  /** Whether the local player currently sees this position. */
  protected visibleAt(x: number, y: number): boolean { return isVisible(this.s, this.me, x, y); }

  protected drawEntities(): void {
    const g = this.entG, s = this.s;
    g.clear();
    const seen = new Set<number>();
    for (const b of s.buildings) {
      const size = BUILDINGS[b.type].size, px = b.tx * TILE, py = b.ty * TILE, w = size * TILE;
      // Buildings stay on the map once discovered; units need current sight.
      if (b.owner !== this.me && !isExplored(this.s, this.me, b.tx + size / 2, b.ty + size / 2)) continue;
      seen.add(b.id);
      g.fillStyle(PLAYER_COLORS[b.owner], b.progress < 1 ? 0.4 : 0.95).fillRect(px + 2, py + 2, w - 4, w - 4);
      g.lineStyle(2, b.id === this.selBuilding ? 0xffffff : 0x1b1b1b).strokeRect(px + 2, py + 2, w - 4, w - 4);
      if (b.progress < 1) this.bar(px + 4, py + w - 10, w - 8, b.progress, 0xf0d060);
      else if (b.hp < b.maxHp) this.bar(px + 4, py + 4, w - 8, b.hp / b.maxHp, 0x55dd55);
      if (b.research) this.bar(px + 4, py + w - 16, w - 8, 1 - b.research.remaining / b.research.total, 0xc084fc);
      if (b.queue[0]) this.bar(px + 4, py + w - 10, w - 8, 1 - b.queue[0].remaining / b.queue[0].total, 0x66ccff);
      let label = this.labels.get(b.id);
      if (!label) {
        label = this.add.text(0, 0, BUILDINGS[b.type].name, { fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(3);
        this.labels.set(b.id, label);
      }
      label.setPosition(px + w / 2, py + w / 2);
    }
    for (const [id, label] of this.labels) if (!seen.has(id)) { label.destroy(); this.labels.delete(id); }
    this.drawRelic();

    for (const u of s.units) {
      if (!this.visibleAt(u.x, u.y)) continue;
      // Units may share a tile in the simulation; fan them out a little so stacks stay visible.
      const x = u.x * TILE + ((u.id * 37) % 9) - 4, y = u.y * TILE + ((u.id * 53) % 9) - 4;
      if (this.selUnits.includes(u.id)) g.lineStyle(2, 0xffffff).strokeCircle(x, y, 13);
      this.drawUnit(u, x, y);
      const max = this.maxHp(u);
      if (u.hp < max) this.bar(x - 10, y - 16, 20, u.hp / max, 0x55dd55);
    }
  }

  /** The Kadim Harabe: a stone ring in its owner's colour, with a capture arc while someone is taking it. */
  private drawRelic(): void {
    const s = this.s, r = s.relic, g = this.entG;
    if (!isExplored(s, this.me, r.x, r.y)) return;
    const x = r.x * TILE, y = r.y * TILE, radius = CFG.relic.radius * TILE;
    g.lineStyle(3, r.owner >= 0 ? PLAYER_COLORS[r.owner] : 0xcfc7b0, inPeace(s) ? 0.35 : 0.9).strokeCircle(x, y, radius);
    g.fillStyle(0xcfc7b0, inPeace(s) ? 0.5 : 1);
    for (let i = 0; i < 6; i++) g.fillRect(x + Math.cos((i * Math.PI) / 3) * 26 - 5, y + Math.sin((i * Math.PI) / 3) * 26 - 9, 10, 18);
    if (r.captor >= 0) {
      g.lineStyle(6, PLAYER_COLORS[r.captor]).beginPath();
      g.arc(x, y, radius - 6, -Math.PI / 2, -Math.PI / 2 + (r.progress / CFG.relic.captureTime) * Math.PI * 2).strokePath();
    }
  }

  protected maxHp(u: Unit): number { return maxHp(u); }
  protected unitColor(u: Unit): number { return PLAYER_COLORS[u.owner] ?? 0x8a5fb0; }

  /** One shape per unit class so armies are readable without colour alone. */
  protected drawUnit(u: Unit, x: number, y: number): void {
    const g = this.entG;
    g.fillStyle(this.unitColor(u)).lineStyle(1.5, 0x111111);
    switch (UNITS[u.type].cls) {
      case 'villager': g.fillCircle(x, y, 6).strokeCircle(x, y, 6); break;
      case 'scout': g.fillTriangle(x, y - 8, x + 6, y + 6, x - 6, y + 6).strokeTriangle(x, y - 8, x + 6, y + 6, x - 6, y + 6); break;
      case 'beast': g.fillTriangle(x - 8, y + 6, x + 8, y + 6, x, y - 9).strokeTriangle(x - 8, y + 6, x + 8, y + 6, x, y - 9); g.fillStyle(0xffffff).fillCircle(x - 3, y, 1.5).fillCircle(x + 3, y, 1.5); break;
      case 'infantry': g.fillRect(x - 7, y - 7, 14, 14).strokeRect(x - 7, y - 7, 14, 14); break;
      case 'archer': g.fillTriangle(x - 8, y - 7, x + 8, y - 7, x, y + 9).strokeTriangle(x - 8, y - 7, x + 8, y - 7, x, y + 9); break;
      case 'cavalry': {
        const pts = [new Phaser.Geom.Point(x, y - 10), new Phaser.Geom.Point(x + 10, y), new Phaser.Geom.Point(x, y + 10), new Phaser.Geom.Point(x - 10, y)];
        g.fillPoints(pts, true).strokePoints(pts, true);
        break;
      }
      default: g.fillCircle(x, y, 10).strokeCircle(x, y, 10); g.fillStyle(0xffe066).fillCircle(x, y, 4);
    }
  }

  protected bar(x: number, y: number, w: number, frac: number, color: number): void {
    this.entG.fillStyle(0x000000, 0.7).fillRect(x, y, w, 5);
    this.entG.fillStyle(color).fillRect(x + 1, y + 1, (w - 2) * Phaser.Math.Clamp(frac, 0, 1), 3);
  }

  protected drawOverlay(): void {
    const g = this.overG, p = this.input.activePointer, w = this.world(p);
    g.clear();
    if (this.placing) {
      const size = BUILDINGS[this.placing].size;
      const tx = Math.floor(w.x / TILE - size / 2 + 0.5), ty = Math.floor(w.y / TILE - size / 2 + 0.5);
      g.fillStyle(canPlace(this.s, this.placing, tx, ty) ? 0x66ff66 : 0xff5555, 0.45).fillRect(tx * TILE, ty * TILE, size * TILE, size * TILE);
    } else if (this.dragStart && p.isDown) {
      g.lineStyle(1.5, 0xffffff).strokeRect(this.dragStart.x, this.dragStart.y, w.x - this.dragStart.x, w.y - this.dragStart.y);
    } else this.drawMatchup(w.x, w.y);
  }

  /** Hovering an enemy shows whether the selection is strong (green up), even (grey bar) or weak (red down) against it. */
  private drawMatchup(wx: number, wy: number): void {
    const target = this.unitAt(wx / TILE, wy / TILE, (o) => o.owner !== this.me && this.visibleAt(o.x, o.y));
    if (!target) return;
    const mine = this.selUnits.map((id) => unitById(this.s, id)).filter((u): u is Unit => !!u && isFighter(u));
    if (mine.length === 0) return;
    const avg = mine.reduce((n, u) => n + multiplier(clsOf(u), clsOf(target)), 0) / mine.length;
    const g = this.overG, x = target.x * TILE, y = target.y * TILE - 26;
    g.lineStyle(2, 0x000000);
    if (avg > 1.1) g.fillStyle(0x4ade80).fillTriangle(x - 9, y + 7, x + 9, y + 7, x, y - 8).strokeTriangle(x - 9, y + 7, x + 9, y + 7, x, y - 8);
    else if (avg < 0.9) g.fillStyle(0xf87171).fillTriangle(x - 9, y - 7, x + 9, y - 7, x, y + 8).strokeTriangle(x - 9, y - 7, x + 9, y - 7, x, y + 8);
    else g.fillStyle(0xbbbbbb).fillRect(x - 9, y - 3, 18, 6).strokeRect(x - 9, y - 3, 18, 6);
  }
}
