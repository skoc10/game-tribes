import { createGame } from '../src/sim/state';
for (const n of [2, 3, 4]) {
  const s = createGame({ seed: 1, players: Array.from({ length: n }, () => ({ race: 'sancak' as const, isAI: false })) });
  let mismatch = 0;
  for (let i = 0; i < s.w * s.h; i++) { const m = s.w * s.h - 1 - i; if (s.terrain[i] !== s.terrain[m] || (s.occ[i] !== 0) !== (s.occ[m] !== 0)) mismatch++; }
  const campSym = s.camps.every((c) => s.camps.some((o) => Math.abs(o.x - (s.w - c.x)) < 1e-9 && Math.abs(o.y - (s.h - c.y)) < 1e-9));
  console.log(`${n} oyuncu: üsler ${s.bases.map((b) => `(${b.x},${b.y})`).join(' ')} | nokta simetrisine uymayan karo ${mismatch} | kamplar simetrik ${campSym}`);
  s.bases.forEach((b, i) => {
    const count = [0, 0, 0, 0];
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const t = s.terrain[y * s.w + x]; if (t && Math.hypot(x - b.x, y - b.y) <= 14) count[t]++; }
    console.log(`   koltuk ${i}: ağaç ${count[1]} çalı ${count[2]} kristal ${count[3]}`);
  });
}
