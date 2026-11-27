/**
 * Headless balance check: plays AI-versus-AI matches and reports win rates.
 *   npx tsx scripts/simulate.ts [matches=200] [all|mirror] [seedBase=1000]
 *
 * Tune on one seed base and confirm on another: numbers tuned and measured on the same
 * seeds look better than they are.
 */
import { runMatch, type Seat } from '../src/sim/headless';

const matches = Number(process.argv[2]) || 200;
const mode = process.argv[3] ?? 'all';
const seedBase = Number(process.argv[4]) || 1000;

/** Share with a 95% confidence interval (normal approximation). */
function share(n: number, d: number): string {
  if (!d) return '—';
  const p = n / d, half = 1.96 * Math.sqrt((p * (1 - p)) / d);
  return `%${(100 * p).toFixed(0)} (±${(100 * half).toFixed(0)})`;
}

function series(title: string, seatsFor: (i: number) => Seat[], label: (seat: Seat, index: number, i: number) => string): void {
  const wins: Record<string, number> = {}, played: Record<string, number> = {}, kinds: Record<string, number> = {};
  let total = 0, minutes = 0, undecided = 0, firstSeat = 0;
  for (let i = 0; i < matches; i++) {
    const seats = seatsFor(i);
    const r = runMatch(seedBase + i, seats);
    if (r.winner < 0) { undecided++; continue; }
    total++;
    minutes += r.minutes;
    seats.forEach((seat, index) => { const k = label(seat, index, i); played[k] = (played[k] ?? 0) + 1; });
    if (r.winner === 0) firstSeat++;
    const key = label(seats[r.winner], r.winner, i);
    wins[key] = (wins[key] ?? 0) + 1;
    kinds[r.winKind] = (kinds[r.winKind] ?? 0) + 1;
  }
  console.log(`\n${title} — ${matches} maç, tohum ${seedBase}–${seedBase + matches - 1}`);
  // Shares are per game that label actually played, so labels that sit out some matches compare fairly.
  for (const k of Object.keys(played).sort()) console.log(`  ${k}: ${wins[k] ?? 0}/${played[k]} galibiyet, ${share(wins[k] ?? 0, played[k])}`);
  console.log(`  zafer türü: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ') || '—'}`);
  console.log(`  ortalama süre: ${total ? (minutes / total).toFixed(1) : '—'} dk; sonuçsuz (60 dk): ${undecided}; ilk koltuk: ${share(firstSeat, total)}`);
}

// 1v1 with the same personality on both sides isolates the race difference. Seats swap every match.
for (const personality of ['expander', 'trader'] as const) {
  series(`1'e 1, iki taraf da ${personality}`, (i) => {
    const pair: Seat[] = [{ race: 'sancak', personality }, { race: 'kul', personality }];
    return i % 2 ? pair.reverse() : pair;
  }, (seat) => seat.race);
}

if (mode !== 'mirror') {
  // The MVP line-up: a fixed trader and a fixed expander, plus a third seat standing in for the
  // player that cycles through both races and both personalities. Seat order rotates.
  const rotation = (i: number) => i % 3;
  series('MVP dizilişi (3 taraf)', (i) => {
    const seats: Seat[] = [
      { race: i % 2 ? 'sancak' : 'kul', personality: i % 4 < 2 ? 'expander' : 'trader' },
      { race: 'sancak', personality: 'trader' },
      { race: 'kul', personality: 'expander' },
    ];
    return [...seats.slice(rotation(i)), ...seats.slice(0, rotation(i))];
  }, (seat, index, i) => {
    const original = (index + rotation(i)) % 3;
    return `${['oyuncu yerine', 'sabit Tüccar', 'sabit Yayılmacı'][original]} (${seat.race}/${seat.personality})`;
  });
}
