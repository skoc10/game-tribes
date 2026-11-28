import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** How each people builds: wall and roof colours, and whether homes are tents. */
export interface Style { wall: number; roof: number; trim: number; tent: boolean }
export const STYLES: Record<string, Style> = {
  sancak: { wall: 0xd9c8a3, roof: 0xa8452f, trim: 0x6b4a2b, tent: false },
  kul: { wall: 0xc9a66b, roof: 0x8a5a33, trim: 0x4a3320, tent: true },
  yaprak: { wall: 0xb9a57a, roof: 0x3f7d3a, trim: 0x4b3a22, tent: false },
  tasocak: { wall: 0x9a9da3, roof: 0x5c6470, trim: 0x3a3f47, tent: false },
};

const OUT = 0x1a1a1a;
const shade = (c: number, f: number): number => {
  const r = Math.min(255, ((c >> 16) & 255) * f), g = Math.min(255, ((c >> 8) & 255) * f), b = Math.min(255, (c & 255) * f);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};

function flag(g: G, x: number, y: number, h: number, color: number, t: number): void {
  g.lineStyle(2, 0x3a2a1a).lineBetween(x, y, x, y - h);
  const wave = Math.sin(t * 4 + x) * 2;
  g.fillStyle(color).fillTriangle(x, y - h, x + 13, y - h + 4 + wave, x, y - h + 9);
  g.lineStyle(1, OUT).strokeTriangle(x, y - h, x + 13, y - h + 4 + wave, x, y - h + 9);
}

function gableHouse(g: G, x: number, y: number, w: number, h: number, st: Style): void {
  const wallH = h * 0.5;
  g.fillStyle(st.wall).fillRect(x, y + h - wallH, w, wallH);
  g.lineStyle(1.5, OUT).strokeRect(x, y + h - wallH, w, wallH);
  g.fillStyle(st.roof).fillTriangle(x - 4, y + h - wallH, x + w / 2, y, x + w + 4, y + h - wallH);
  g.fillStyle(shade(st.roof, 0.75)).fillTriangle(x + w / 2, y, x + w + 4, y + h - wallH, x + w / 2, y + h - wallH);
  g.lineStyle(1.5, OUT).strokeTriangle(x - 4, y + h - wallH, x + w / 2, y, x + w + 4, y + h - wallH);
}

function tent(g: G, cx: number, base: number, r: number, st: Style): void {
  g.fillStyle(st.wall).fillRect(cx - r, base - r * 0.55, r * 2, r * 0.55);
  g.lineStyle(1.5, OUT).strokeRect(cx - r, base - r * 0.55, r * 2, r * 0.55);
  g.fillStyle(st.roof).fillTriangle(cx - r - 3, base - r * 0.55, cx, base - r * 1.5, cx + r + 3, base - r * 0.55);
  g.fillStyle(shade(st.roof, 0.75)).fillTriangle(cx, base - r * 1.5, cx + r + 3, base - r * 0.55, cx, base - r * 0.55);
  g.lineStyle(1.5, OUT).strokeTriangle(cx - r - 3, base - r * 0.55, cx, base - r * 1.5, cx + r + 3, base - r * 0.55);
  g.fillStyle(st.trim).fillRect(cx - r * 0.2, base - r * 0.42, r * 0.4, r * 0.42);
}

/**
 * Draws a building as a small picture of what it is, so a house, a barracks and a farm can be told
 * apart at a glance. (x, y) is the top-left of its footprint and w its width in pixels.
 */
export function drawBuilding(g: G, type: string, x: number, y: number, w: number, team: number, race: string, done: boolean, t: number): void {
  const st = STYLES[race] ?? STYLES.sancak;
  const a = 1;
  // Ground plate in the owner's colour: who it belongs to must never be in doubt.
  g.fillStyle(0x000000, 0.22 * a).fillEllipse(x + w / 2, y + w - 5, w * 0.95, w * 0.3);
  g.fillStyle(team, 0.55 * a).fillRect(x + 3, y + w - 8, w - 6, 5);
  const cx = x + w / 2, base = y + w - 8;
  switch (type) {
    case 'house':
      if (st.tent) tent(g, cx, base, w * 0.36, st);
      else {
        gableHouse(g, x + 10, y + 10, w - 20, w - 18, st);
        g.fillStyle(st.trim).fillRect(cx - 5, base - 14, 10, 14);
        g.fillStyle(0xffe9a8).fillRect(x + 16, base - 16, 7, 7);
      }
      break;
    case 'towncenter': {
      if (st.tent) { tent(g, cx - 20, base, 20, st); tent(g, cx + 22, base, 18, st); tent(g, cx, base, 30, st); }
      else {
        gableHouse(g, x + 8, y + 30, w - 16, w - 38, st);
        // The keep: a tower in the middle, taller than anything else in the base.
        g.fillStyle(shade(st.wall, 0.9)).fillRect(cx - 13, y + 14, 26, w - 22);
        g.lineStyle(1.5, OUT).strokeRect(cx - 13, y + 14, 26, w - 22);
        for (let i = 0; i < 3; i++) g.fillStyle(shade(st.wall, 0.9)).fillRect(cx - 13 + i * 10, y + 8, 6, 6).lineStyle(1, OUT).strokeRect(cx - 13 + i * 10, y + 8, 6, 6);
        g.fillStyle(st.trim).fillRect(cx - 6, base - 18, 12, 18);
        g.fillStyle(0xffe9a8).fillRect(cx - 4, y + 26, 8, 9);
      }
      flag(g, cx, y + 10, 16, team, t);
      break;
    }
    case 'farm': {
      g.fillStyle(0x7a5a34).fillRect(x + 4, y + 6, w - 8, w - 16);
      g.lineStyle(1.5, shade(0x7a5a34, 0.6)).strokeRect(x + 4, y + 6, w - 8, w - 16);
      for (let r = 0; r < 5; r++) {
        const ry = y + 12 + r * ((w - 28) / 4);
        g.lineStyle(3, r % 2 ? 0xd9c24a : 0x6fae3d).lineBetween(x + 8, ry, x + w - 8, ry);
      }
      // Scarecrow, so a field never reads as bare ground.
      g.lineStyle(2, 0x4a3320).lineBetween(cx, y + w - 16, cx, y + 14).lineBetween(cx - 8, y + 22, cx + 8, y + 22);
      g.fillStyle(team).fillCircle(cx, y + 14, 4);
      break;
    }
    case 'barracks': {
      g.fillStyle(st.wall).fillRect(x + 8, y + 30, w - 16, w - 38);
      g.lineStyle(1.5, OUT).strokeRect(x + 8, y + 30, w - 16, w - 38);
      for (let i = 0; i < 6; i++) g.fillStyle(shade(st.wall, 0.85)).fillRect(x + 8 + i * ((w - 22) / 5), y + 23, 7, 8).lineStyle(1, OUT).strokeRect(x + 8 + i * ((w - 22) / 5), y + 23, 7, 8);
      g.fillStyle(st.trim).fillRect(cx - 9, base - 24, 18, 24);
      // Shield with crossed swords: the sign of a place that trains soldiers.
      g.fillStyle(team).fillCircle(cx, y + 46, 10).lineStyle(1.5, OUT).strokeCircle(cx, y + 46, 10);
      g.lineStyle(2.5, 0xe8e8e8).lineBetween(cx - 16, y + 34, cx + 16, y + 58).lineBetween(cx + 16, y + 34, cx - 16, y + 58);
      flag(g, x + 14, y + 24, 14, team, t);
      flag(g, x + w - 14, y + 24, 14, team, t + 1);
      break;
    }
    case 'archery': {
      g.fillStyle(st.wall).fillRect(x + 8, y + 40, w * 0.42, w - 48);
      g.lineStyle(1.5, OUT).strokeRect(x + 8, y + 40, w * 0.42, w - 48);
      g.fillStyle(st.roof).fillTriangle(x + 4, y + 40, x + 8 + w * 0.21, y + 20, x + 12 + w * 0.42, y + 40);
      g.lineStyle(1.5, OUT).strokeTriangle(x + 4, y + 40, x + 8 + w * 0.21, y + 20, x + 12 + w * 0.42, y + 40);
      // Straw target on a stand.
      const tx = x + w * 0.72, ty = y + w * 0.5;
      g.lineStyle(3, 0x4a3320).lineBetween(tx - 10, base, tx, ty).lineBetween(tx + 10, base, tx, ty);
      g.fillStyle(0xf2f2f2).fillCircle(tx, ty, 16).lineStyle(1.5, OUT).strokeCircle(tx, ty, 16);
      g.fillStyle(0xd23b3b).fillCircle(tx, ty, 11);
      g.fillStyle(0xf2f2f2).fillCircle(tx, ty, 6);
      g.fillStyle(team).fillCircle(tx, ty, 3);
      g.lineStyle(2, 0x4a3320).lineBetween(tx - 3, ty - 2, tx - 16, ty - 10);
      break;
    }
    case 'stable': {
      g.fillStyle(st.wall).fillRect(x + 8, y + 32, w - 16, w - 40);
      g.lineStyle(1.5, OUT).strokeRect(x + 8, y + 32, w - 16, w - 40);
      g.fillStyle(st.roof).fillRect(x + 4, y + 22, w - 8, 12).lineStyle(1.5, OUT).strokeRect(x + 4, y + 22, w - 8, 12);
      // Open stall doors with a horse looking out.
      for (const dx of [-22, 22]) {
        g.fillStyle(0x2a1d12).fillRect(cx + dx - 11, y + 42, 22, base - (y + 42));
        g.fillStyle(0x8b5a2b).fillEllipse(cx + dx, y + 54, 12, 16);
        g.fillStyle(0x8b5a2b).fillTriangle(cx + dx - 5, y + 47, cx + dx - 2, y + 40, cx + dx, y + 47);
        g.fillStyle(0x111111).fillCircle(cx + dx + 2, y + 52, 1.5);
      }
      g.lineStyle(2, st.trim).lineBetween(x + 4, base - 6, x + w - 4, base - 6);
      flag(g, cx, y + 24, 14, team, t);
      break;
    }
    case 'blacksmith': {
      g.fillStyle(shade(st.wall, 0.8)).fillRect(x + 10, y + 36, w - 20, w - 44);
      g.lineStyle(1.5, OUT).strokeRect(x + 10, y + 36, w - 20, w - 44);
      g.fillStyle(st.roof).fillTriangle(x + 4, y + 36, cx, y + 16, x + w - 4, y + 36);
      g.lineStyle(1.5, OUT).strokeTriangle(x + 4, y + 36, cx, y + 16, x + w - 4, y + 36);
      g.fillStyle(0x4a4a4a).fillRect(x + w - 30, y + 8, 12, 24).lineStyle(1.5, OUT).strokeRect(x + w - 30, y + 8, 12, 24);
      // Forge glow and drifting smoke.
      g.fillStyle(0xff8a2a, 0.75 + Math.sin(t * 6) * 0.2).fillRect(x + 18, y + 48, 18, base - (y + 48));
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.5 + i / 3) % 1;
        g.fillStyle(0xdddddd, (1 - p) * 0.6).fillCircle(x + w - 24 + Math.sin(p * 5) * 4, y + 6 - p * 26, 4 + p * 5);
      }
      // Anvil.
      g.fillStyle(0x2b2b2b).fillRect(cx + 4, base - 12, 22, 6).fillRect(cx + 10, base - 6, 10, 6);
      g.fillStyle(team).fillRect(cx + 4, base - 16, 22, 4);
      break;
    }
    default:
      g.fillStyle(st.wall).fillRect(x + 6, y + 6, w - 12, w - 14);
  }
  if (!done) {
    // Fade what is not finished and put scaffolding over it.
    g.fillStyle(0x5a8f3c, 0.45).fillRect(x, y, w, w - 8);
    g.lineStyle(2, 0xc9a45a, 0.9);
    for (let i = 0; i <= 3; i++) g.lineBetween(x + 6 + (i * (w - 12)) / 3, y + 10, x + 6 + (i * (w - 12)) / 3, base);
    g.lineBetween(x + 6, y + w * 0.4, x + w - 6, y + w * 0.4).lineBetween(x + 6, y + w * 0.7, x + w - 6, y + w * 0.7);
  }
}

export interface UnitLook { moving: boolean; t: number; id: number; level?: number }

/** Draws a unit as a small figure with the gear of its class. */
export function drawUnit(g: G, cls: string, x: number, y: number, team: number, look: UnitLook): void {
  const bob = look.moving ? Math.sin(look.t * 10 + look.id) * 1.5 : 0;
  const skin = 0xf0c9a0;
  g.fillStyle(0x000000, 0.25).fillEllipse(x, y + 8, cls === 'cavalry' ? 22 : 14, 6);
  y += bob;
  g.lineStyle(1.2, OUT);
  switch (cls) {
    case 'villager':
      g.fillStyle(team).fillRoundedRect(x - 4, y - 3, 8, 10, 2).strokeRoundedRect(x - 4, y - 3, 8, 10, 2);
      g.fillStyle(skin).fillCircle(x, y - 6, 3.5).strokeCircle(x, y - 6, 3.5);
      g.fillStyle(0xcaa15a).fillTriangle(x - 5, y - 8, x + 5, y - 8, x, y - 12);
      g.lineStyle(1.5, 0x5a4025).lineBetween(x + 5, y + 6, x + 8, y - 6);
      break;
    case 'scout':
      g.fillStyle(0x9a6a3a).fillEllipse(x, y + 2, 16, 8).strokeEllipse(x, y + 2, 16, 8);
      g.fillStyle(team).fillRoundedRect(x - 3, y - 7, 6, 8, 2).strokeRoundedRect(x - 3, y - 7, 6, 8, 2);
      g.fillStyle(skin).fillCircle(x, y - 9, 3);
      g.lineStyle(1.5, 0x5a4025).lineBetween(x + 4, y - 4, x + 4, y - 16);
      g.fillStyle(team).fillTriangle(x + 4, y - 16, x + 11, y - 13, x + 4, y - 10);
      break;
    case 'infantry':
      g.lineStyle(1.8, 0x7a5a34).lineBetween(x + 6, y + 7, x + 6, y - 14);
      g.fillStyle(0xdedede).fillTriangle(x + 4, y - 14, x + 8, y - 14, x + 6, y - 19);
      g.lineStyle(1.2, OUT);
      g.fillStyle(team).fillRoundedRect(x - 5, y - 4, 10, 11, 2).strokeRoundedRect(x - 5, y - 4, 10, 11, 2);
      g.fillStyle(skin).fillCircle(x, y - 7, 3.5);
      g.fillStyle(0x8f979f).fillRect(x - 4, y - 11, 8, 4).strokeRect(x - 4, y - 11, 8, 4);
      g.fillStyle(shade(team, 0.75)).fillCircle(x - 5, y + 1, 5).strokeCircle(x - 5, y + 1, 5);
      g.fillStyle(0xe8e8e8).fillCircle(x - 5, y + 1, 1.5);
      break;
    case 'archer':
      g.fillStyle(team).fillRoundedRect(x - 4, y - 4, 8, 11, 2).strokeRoundedRect(x - 4, y - 4, 8, 11, 2);
      g.fillStyle(skin).fillCircle(x, y - 7, 3.5);
      g.fillStyle(0x2f6b2f).fillTriangle(x - 5, y - 6, x + 5, y - 6, x, y - 13);
      g.lineStyle(1.8, 0x7a5a34).beginPath();
      g.arc(x + 5, y, 9, -Math.PI / 2.4, Math.PI / 2.4).strokePath();
      g.lineStyle(1, 0xf2f2f2).lineBetween(x + 7.5, y - 8, x + 7.5, y + 8);
      break;
    case 'cavalry':
      g.fillStyle(0x8b5a2b).fillEllipse(x, y + 3, 22, 11).strokeEllipse(x, y + 3, 22, 11);
      g.fillStyle(0x8b5a2b).fillEllipse(x + 11, y - 3, 8, 9).strokeEllipse(x + 11, y - 3, 8, 9);
      g.fillStyle(0x3a2412).fillTriangle(x - 11, y + 1, x - 16, y + 6, x - 10, y + 5);
      g.fillStyle(team).fillRoundedRect(x - 4, y - 9, 8, 10, 2).strokeRoundedRect(x - 4, y - 9, 8, 10, 2);
      g.fillStyle(skin).fillCircle(x, y - 12, 3.2);
      g.fillStyle(0x8f979f).fillRect(x - 3.5, y - 16, 7, 3.5);
      g.lineStyle(1.8, 0xdedede).lineBetween(x + 3, y - 4, x + 17, y - 14);
      break;
    case 'hero': {
      const pulse = 0.5 + Math.sin(look.t * 4) * 0.25;
      g.lineStyle(2, 0xffd24a, pulse).strokeCircle(x, y + 1, 14);
      g.lineStyle(1.2, OUT);
      g.fillStyle(shade(team, 0.7)).fillTriangle(x - 8, y - 4, x + 8, y - 4, x, y + 12);
      g.fillStyle(team).fillRoundedRect(x - 6, y - 6, 12, 13, 3).strokeRoundedRect(x - 6, y - 6, 12, 13, 3);
      g.fillStyle(skin).fillCircle(x, y - 10, 4.5).strokeCircle(x, y - 10, 4.5);
      g.fillStyle(0xffd24a).fillTriangle(x - 5, y - 13, x - 3, y - 19, x - 1, y - 13).fillTriangle(x - 2, y - 13, x, y - 20, x + 2, y - 13).fillTriangle(x + 1, y - 13, x + 3, y - 19, x + 5, y - 13);
      g.lineStyle(2.2, 0xe8e8e8).lineBetween(x + 8, y + 6, x + 8, y - 12);
      g.lineStyle(2.2, 0xffd24a).lineBetween(x + 5, y - 2, x + 11, y - 2);
      break;
    }
    default: {
      // Neutral creature: grey fur, pointed ears, red eyes.
      g.fillStyle(0x6b5b7a).fillEllipse(x, y + 1, 18, 12).strokeEllipse(x, y + 1, 18, 12);
      g.fillStyle(0x6b5b7a).fillTriangle(x - 7, y - 3, x - 4, y - 11, x - 1, y - 4).fillTriangle(x + 1, y - 4, x + 4, y - 11, x + 7, y - 3);
      g.fillStyle(0xff4040).fillCircle(x - 3, y - 1, 1.6).fillCircle(x + 3, y - 1, 1.6);
      g.fillStyle(0xf2f2f2).fillTriangle(x - 2, y + 4, x, y + 8, x + 2, y + 4);
    }
  }
}

/** Trees, berry bushes and crystals, varied a little by position so forests do not look stamped. */
export function drawNode(g: G, terrain: number, x: number, y: number, seed: number): void {
  const j = ((seed * 2654435761) >>> 0) % 7 - 3;
  if (terrain === 1) {
    g.fillStyle(0x000000, 0.2).fillEllipse(x + 16, y + 27, 22, 7);
    g.fillStyle(0x5a3d22).fillRect(x + 14, y + 16, 5, 12);
    g.fillStyle(0x1f5a2a).fillCircle(x + 16 + j * 0.5, y + 12, 12);
    g.fillStyle(0x2f7a38).fillCircle(x + 12 + j * 0.5, y + 9, 7);
    g.fillStyle(0x3f9447).fillCircle(x + 19 + j * 0.5, y + 7, 4);
  } else if (terrain === 2) {
    g.fillStyle(0x000000, 0.18).fillEllipse(x + 16, y + 25, 24, 7);
    g.fillStyle(0x2f6b2f).fillCircle(x + 11, y + 18, 9).fillCircle(x + 21, y + 17, 9).fillCircle(x + 16, y + 12, 9);
    g.fillStyle(0xc0304a);
    for (const [dx, dy] of [[9, 16], [15, 11], [21, 15], [13, 21], [22, 21], [18, 17]]) g.fillCircle(x + dx, y + dy, 2.2);
  } else if (terrain === 3) {
    g.fillStyle(0x000000, 0.2).fillEllipse(x + 16, y + 27, 24, 7);
    g.fillStyle(0x4fb8e8).fillTriangle(x + 6, y + 27, x + 11, y + 8 + j, x + 16, y + 27);
    g.fillStyle(0x7fd8ff).fillTriangle(x + 12, y + 27, x + 18, y + 2, x + 24, y + 27);
    g.fillStyle(0xbdeeff).fillTriangle(x + 18, y + 2, x + 20, y + 27, x + 24, y + 27);
    g.fillStyle(0x4fb8e8).fillTriangle(x + 20, y + 27, x + 25, y + 13 - j, x + 29, y + 27);
  }
}
