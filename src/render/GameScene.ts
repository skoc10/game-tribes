import Phaser from 'phaser';
import { clsOf, isFighter, maxHp, multiplier } from '../sim/combat';
import { issue, type Command } from '../sim/commands';
import { BUILDINGS, CFG, DT, RACES, UNITS } from '../sim/data';
import { pactOf } from '../sim/diplomacy';
import { isExplored, isVisible } from '../sim/fog';
import { buildingById, canPlace, idleVillagers, isResource, unitById } from '../sim/state';
import { inPeace } from '../sim/relations';
import { step } from '../sim/step';
import { T_BUSH, T_CRYSTAL, T_TREE, type Building, type Game, type ResourceKind, type Unit } from '../sim/types';
import { drawBuilding, drawNode, drawUnit as drawUnitArt } from './art';
import { Sound } from './audio';
import { Hud } from './hud';
import { Minimap } from './minimap';

export const TILE = 32;
export const PLAYER_COLORS = [0x4c8dff, 0xe5533d, 0xe3c341, 0xb565e0];
const CSS_COLORS = PLAYER_COLORS.map((c) => '#' + c.toString(16).padStart(6, '0'));
/** How another player's units stand towards the local player: the ring under them shows it. */
type Stance = 'war' | 'pact' | 'neutral';
const STANCE_COLOR: Record<Stance, number> = { war: 0xff4d4d, pact: 0x4ade80, neutral: 0xf2efe4 };
interface Effect { x1: number; y1: number; x2: number; y2: number; kind: 'arrow' | 'slash' | 'puff'; until: number; color: number }

export class GameScene extends Phaser.Scene {
  s!: Game;
  me = 0;
  speed = 1;
  paused = false;
  selUnits: number[] = [];
  selBuilding = 0;
  placing: string | null = null;
  showDiplomacy = true;
  hud!: Hud;
  voice!: Sound;
  private minimap!: Minimap;
  private banner!: HTMLElement;
  private bannerTimer = 0;
  private effects: Effect[] = [];
  private lastCooldown = new Map<number, number>();
  private lastSeen = new Map<number, { x: number; y: number }>();
  private lastBuildingHp = new Map<number, number>();
  private lastAlert = new Map<string, number>();
  private nextWatch = 0;
  /** A command waiting for the player to confirm a betrayal. */
  private pending: Command | null = null;
  private pausedBefore = false;

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
    this.voice = new Sound();
    this.minimap = new Minimap(168, (fx, fy) => cam.centerOn(fx * s.w * TILE, fy * s.h * TILE));
    this.banner = document.createElement('div');
    this.banner.id = 'banner';
    document.body.appendChild(this.banner);

    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-SPACE', () => { if (!this.pending) this.paused = !this.paused; });
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
    if (!r.ok && r.needsConfirm && r.reason) { this.pending = c; this.pausedBefore = this.paused; this.paused = true; this.hud.confirm(r.reason); }
    else if (!r.ok && r.reason) this.hud.toast(r.reason);
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
      case 'sound': this.voice.toggle(); break;
      case 'diplomacy': this.showDiplomacy = !this.showDiplomacy; break;
      case 'pact': this.cmd({ type: 'proposePact', to: Number(arg) }); break;
      case 'endpact': this.cmd({ type: 'endPact', other: Number(arg) }); break;
      case 'accept': this.cmd({ type: 'answerPact', from: Number(arg), accept: true }); break;
      case 'reject': this.cmd({ type: 'answerPact', from: Number(arg), accept: false }); break;
      case 'gift': {
        const [to, kind] = arg.split('-');
        this.cmd({ type: 'gift', to: Number(to), kind: kind as ResourceKind, amount: CFG.diplomacy.giftAmount });
        break;
      }
      case 'confirmYes':
      case 'confirmNo': {
        const c = this.pending;
        this.pending = null;
        this.paused = this.pausedBefore;
        document.getElementById('confirm')?.remove();
        if (action === 'confirmYes' && c && c.type === 'attack') this.cmd({ ...c, confirm: true });
        break;
      }
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

  /** How player `other` stands towards the local player right now. */
  protected stance(other: number): Stance {
    if (pactOf(this.s, this.me, other)) return 'pact';
    return this.s.war[this.me][other] && !inPeace(this.s) ? 'war' : 'neutral';
  }

  /** A large message across the top of the screen, read aloud and marked on the minimap. */
  protected announce(text: string, tone: 'red' | 'green' | 'gold' | 'grey', at?: { x: number; y: number }, key?: string, every = 0): void {
    const now = performance.now();
    if (key) {
      if (now - (this.lastAlert.get(key) ?? -1e9) < every * 1000) return;
      this.lastAlert.set(key, now);
    }
    this.banner.textContent = text;
    this.banner.className = tone;
    this.banner.style.display = 'block';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => (this.banner.style.display = 'none'), 4500);
    this.voice.speak(text);
    if (at) this.minimap.ping(at.x, at.y, { red: '#ff4d4d', green: '#4ade80', gold: '#ffd24a', grey: '#f2efe4' }[tone]);
  }

  /** Turns simulation events into banners, speech, tones and floating text. */
  protected afterStep(): void {
    const events = this.s.events;
    for (; this.seenEvents < events.length; this.seenEvents++) {
      const e = events[this.seenEvents];
      if (e.player !== this.me) continue;
      const at = e.x !== undefined && e.y !== undefined ? { x: e.x, y: e.y } : undefined;
      switch (e.kind) {
        case 'loot': this.floatText(e.text, e.x ?? 0, e.y ?? 0, '#ffd24a'); this.voice.tone('coin'); break;
        case 'level': this.floatText(e.text, e.x ?? 0, e.y ?? 0, '#9be7ff'); this.voice.tone('chime'); break;
        case 'peace': this.announce(e.text, 'gold'); if (e.text.startsWith('Boru')) this.voice.tone('horn'); break;
        case 'war': case 'betrayal': case 'danger': this.announce(e.text, 'red', at); this.voice.tone('alarm'); break;
        case 'offer': this.announce(e.text + ' Diplomasi panelinden yanıtla.', 'green'); this.voice.tone('chime'); break;
        case 'pact': this.announce(e.text, 'green'); this.voice.tone('chime'); break;
        case 'relic': this.announce(e.text, 'gold', { x: this.s.relic.x, y: this.s.relic.y }); break;
        case 'age': this.announce(e.text, 'gold'); this.voice.tone('chime'); break;
        case 'eliminated': this.announce(e.text, 'grey'); break;
        case 'lost': this.hud.toast(e.text); if (at) this.minimap.ping(at.x, at.y, '#ff4d4d'); this.cameras.main.shake(180, 0.004); break;
        // Reasons live in the diplomacy panel; with the panel closed they still have to reach the player.
        case 'why': if (!this.showDiplomacy) this.hud.toast(e.text); break;
        default: this.hud.toast(e.text);
      }
    }
    if (this.s.winner >= 0 && !this.lastAlert.has('end')) { this.lastAlert.set('end', 0); this.voice.tone(this.s.winner === this.me ? 'win' : 'horn'); }
    if (!this.paused && performance.now() >= this.nextWatch) { this.nextWatch = performance.now() + 1000; this.watch(); }
  }

  /**
   * Tells the player what is happening at home: who has soldiers near the base and what that
   * means (an attack, a pact partner passing, a neutral army that could attack), and when
   * buildings are being hit.
   */
  private watch(): void {
    const s = this.s, base = s.bases[this.me];
    if (!s.players[this.me].alive || s.winner >= 0) return;
    for (const o of s.players) {
      if (o.id === this.me || !o.alive) continue;
      const near = s.units.filter((u) => u.owner === o.id && isFighter(u) && Math.hypot(u.x - base.x, u.y - base.y) < 13 && this.visibleAt(u.x, u.y));
      if (near.length < 2) continue;
      const at = { x: near[0].x, y: near[0].y }, st = this.stance(o.id);
      if (st === 'war') { this.announce(`⚔ ${o.name} ordusu üssüne geliyor: ${near.length} asker. Savaştasınız!`, 'red', at, `near-war-${o.id}`, 40); this.voice.tone('alarm'); }
      else if (st === 'pact') this.announce(`🤝 ${o.name} askerleri yakından geçiyor. Aranızda pakt var; saldıramazlar.`, 'green', at, `near-pact-${o.id}`, 90);
      else if (inPeace(s)) this.announce(`🕊 ${o.name} askerleri üssünün yakınında. Barış sürüyor; kimse saldıramaz.`, 'grey', at, `near-peace-${o.id}`, 120);
      else this.announce(`👀 ${o.name} askerleri üssünün yakınında. Aranızda anlaşma yok: saldırabilirler!`, 'gold', at, `near-neutral-${o.id}`, 60);
    }
    for (const b of s.buildings) {
      if (b.owner !== this.me) continue;
      const before = this.lastBuildingHp.get(b.id);
      this.lastBuildingHp.set(b.id, b.hp);
      if (before !== undefined && b.hp < before - 0.5 && b.progress >= 1) {
        const size = BUILDINGS[b.type].size;
        this.announce(`🔥 ${BUILDINGS[b.type].name} saldırı altında!`, 'red', { x: b.tx + size / 2, y: b.ty + size / 2 }, 'under-attack', 20);
      }
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
      const h = (Math.imul(y * s.w + x + 7, 2654435761) >>> 0) % 5;
      g.fillStyle([0x5d9140, 0x588a3c, 0x5a8d3e, 0x619644, 0x568639][h]).fillRect(x * TILE, y * TILE, TILE, TILE);
      if (h === 0) g.fillStyle(0x6ba34c).fillRect(x * TILE + 9, y * TILE + 20, 2, 5).fillRect(x * TILE + 21, y * TILE + 8, 2, 5);
    }
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const t = s.terrain[y * s.w + x];
      if (t === T_TREE || t === T_BUSH || t === T_CRYSTAL) drawNode(g, t, x * TILE, y * TILE, y * s.w + x);
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
    const g = this.entG, s = this.s, t = performance.now() / 1000, now = performance.now();
    g.clear();
    const seen = new Set<number>();
    for (const b of s.buildings) {
      const size = BUILDINGS[b.type].size, px = b.tx * TILE, py = b.ty * TILE, w = size * TILE;
      // Buildings stay on the map once discovered; units need current sight.
      if (b.owner !== this.me && !isExplored(this.s, this.me, b.tx + size / 2, b.ty + size / 2)) continue;
      seen.add(b.id);
      drawBuilding(g, b.type, px, py, w, PLAYER_COLORS[b.owner], s.players[b.owner].race, b.progress >= 1, t);
      if (b.id === this.selBuilding) g.lineStyle(2, 0xffffff).strokeRect(px + 1, py + 1, w - 2, w - 2);
      else if (b.owner !== this.me) g.lineStyle(2, STANCE_COLOR[this.stance(b.owner)], 0.7).strokeRect(px + 1, py + 1, w - 2, w - 2);
      if (b.progress < 1) this.bar(px + 4, py + w - 10, w - 8, b.progress, 0xf0d060);
      else if (b.hp < b.maxHp) this.bar(px + 4, py + 2, w - 8, b.hp / b.maxHp, 0x55dd55);
      if (b.research) this.bar(px + 4, py + w - 16, w - 8, 1 - b.research.remaining / b.research.total, 0xc084fc);
      if (b.queue[0]) this.bar(px + 4, py + w - 10, w - 8, 1 - b.queue[0].remaining / b.queue[0].total, 0x66ccff);
      let label = this.labels.get(b.id);
      if (!label) {
        label = this.add.text(0, 0, BUILDINGS[b.type].name, { fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(3);
        this.labels.set(b.id, label);
      }
      label.setPosition(px + w / 2, py + w - 2);
    }
    for (const [id, label] of this.labels) if (!seen.has(id)) { label.destroy(); this.labels.delete(id); }
    this.drawRelic();
    this.drawCaravans();

    const alive = new Set<number>();
    for (const u of s.units) {
      alive.add(u.id);
      if (!this.visibleAt(u.x, u.y)) { this.lastSeen.delete(u.id); this.lastCooldown.set(u.id, u.cooldown); continue; }
      // Units may share a tile in the simulation; fan them out a little so stacks stay visible.
      const x = u.x * TILE + ((u.id * 37) % 13) - 6, y = u.y * TILE + ((u.id * 53) % 13) - 6;
      this.lastSeen.set(u.id, { x, y });
      // The ring under a unit says whose side it is on: white for a selection, red for an enemy at
      // war, green for a pact partner, pale for a neutral who could still attack.
      if (this.selUnits.includes(u.id)) g.lineStyle(2, 0xffffff).strokeEllipse(x, y + 7, 26, 11);
      else if (u.owner >= 0 && u.owner !== this.me) g.lineStyle(2, STANCE_COLOR[this.stance(u.owner)], 0.85).strokeEllipse(x, y + 7, 24, 10);
      const cls = UNITS[u.type].cls;
      drawUnitArt(g, cls, x, y, this.unitColor(u), { moving: !!u.path && u.pathIdx < u.path.length, t, id: u.id });
      const max = this.maxHp(u);
      if (u.hp < max) this.bar(x - 10, y - (cls === 'hero' ? 26 : 22), 20, u.hp / max, 0x55dd55);
      // A strike shows as an arrow in flight or a flash on the target.
      const before = this.lastCooldown.get(u.id) ?? 0;
      if (u.cooldown > before + 0.5) {
        const target = u.order.kind === 'attack' && u.order.building ? buildingById(s, u.order.target) : undefined;
        const victim = unitById(s, u.order.kind === 'attack' && !u.order.building ? u.order.target : u.target);
        const tx = target ? (target.tx + BUILDINGS[target.type].size / 2) * TILE : victim ? victim.x * TILE : x;
        const ty = target ? (target.ty + BUILDINGS[target.type].size / 2) * TILE : victim ? victim.y * TILE : y;
        this.effects.push({ x1: x, y1: y - 4, x2: tx, y2: ty, kind: UNITS[u.type].range > 0 ? 'arrow' : 'slash', until: now + 220, color: 0xffffff });
      }
      this.lastCooldown.set(u.id, u.cooldown);
    }
    // Anything that was in sight and is gone leaves a puff where it stood.
    for (const [id, pos] of this.lastSeen) if (!alive.has(id)) { this.effects.push({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, kind: 'puff', until: now + 500, color: 0xdddddd }); this.lastSeen.delete(id); }
    for (const id of this.lastCooldown.keys()) if (!alive.has(id)) this.lastCooldown.delete(id);

    this.effects = this.effects.filter((e) => e.until > now);
    for (const e of this.effects) {
      const left = (e.until - now) / (e.kind === 'puff' ? 500 : 220);
      if (e.kind === 'arrow') {
        const k = 1 - left, ax = e.x1 + (e.x2 - e.x1) * k, ay = e.y1 + (e.y2 - e.y1) * k - Math.sin(k * Math.PI) * 10;
        const d = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
        g.lineStyle(2, 0xf5e6c8).lineBetween(ax, ay, ax - ((e.x2 - e.x1) / d) * 9, ay - ((e.y2 - e.y1) / d) * 9);
      } else if (e.kind === 'slash') {
        g.lineStyle(3, 0xffffff, left).beginPath();
        g.arc(e.x2, e.y2, 11, -1 + (1 - left) * 2, 0.6 + (1 - left) * 2).strokePath();
      } else {
        g.fillStyle(e.color, left * 0.7).fillCircle(e.x1, e.y1 - (1 - left) * 10, 5 + (1 - left) * 12);
      }
    }

    const view = this.cameras.main.worldView;
    this.minimap.render(s, this.me, CSS_COLORS, { x: view.x / TILE, y: view.y / TILE, w: view.width / TILE, h: view.height / TILE });
  }

  /** Sancak Kervanı: a wagon shuttling between the two bases for every pact a caravan people holds. */
  private drawCaravans(): void {
    const s = this.s, g = this.entG;
    for (const a of s.players) for (const b of s.players) {
      if (a.id === b.id || !a.alive || !b.alive || !RACES[a.race].caravan || !pactOf(s, a.id, b.id)) continue;
      const from = s.bases[a.id], to = s.bases[b.id];
      const phase = ((s.time + a.id * 7) % 60) / 30, t = phase < 1 ? phase : 2 - phase;
      const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t;
      if (!this.visibleAt(x, y)) continue;
      g.fillStyle(PLAYER_COLORS[a.id]).lineStyle(1.5, 0x111111).fillRect(x * TILE - 9, y * TILE - 6, 18, 11).strokeRect(x * TILE - 9, y * TILE - 6, 18, 11);
      g.fillStyle(0x7fd8ff).fillCircle(x * TILE, y * TILE - 1, 3);
      g.fillStyle(0x2a2a2a).fillCircle(x * TILE - 5, y * TILE + 6, 3).fillCircle(x * TILE + 5, y * TILE + 6, 3);
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
