/**
 * Headless balance check: plays AI-versus-AI matches and reports win rates.
 *   npx tsx scripts/simulate.ts [matches=40] [mirror]   ("mirror" skips the three-way series)
 */
import { runMatch, type Seat } from '../src/sim/headless';

const matches = Number(process.argv[2]) || 40;
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : '—');

function series(title: string, seatsFor: (i: number) => Seat[], label: (seat: Seat) => string): void {
  const wins: Record<string, number> = {}, kinds: Record<string, number> = {};
  let total = 0, minutes = 0, undecided = 0;
  for (let i = 0; i < matches; i++) {
    const seats = seatsFor(i);
    const r = runMatch(1000 + i, seats);
    if (r.winner < 0) { undecided++; continue; }
    total++;
    minutes += r.minutes;
    const key = label(seats[r.winner]);
    wins[key] = (wins[key] ?? 0) + 1;
    kinds[r.winKind] = (kinds[r.winKind] ?? 0) + 1;
  }
  console.log(`\n${title} — ${matches} maç`);
  for (const [k, n] of Object.entries(wins).sort()) console.log(`  ${k}: ${n} galibiyet (${pct(n, total)})`);
  console.log(`  zafer türü: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ') || '—'}`);
  console.log(`  ortalama süre: ${total ? (minutes / total).toFixed(1) : '—'} dk, sonuçsuz (60 dk): ${undecided}`);
}

// 1v1 with the same personality on both sides isolates the race difference. Seats swap every match.
for (const personality of ['expander', 'trader'] as const) {
  series(`1'e 1, iki taraf da ${personality}`, (i) => {
    const pair: Seat[] = [{ race: 'sancak', personality }, { race: 'kul', personality }];
    return i % 2 ? pair.reverse() : pair;
  }, (seat) => seat.race);
}

if (process.argv[3] === 'mirror') process.exit(0);

// The MVP line-up: a third seat stands in for the player, rotating race and seat order.
series('MVP dizilişi (3 taraf)', (i) => {
  const seats: Seat[] = [
    { race: i % 2 ? 'sancak' : 'kul', personality: i % 4 < 2 ? 'expander' : 'trader' },
    { race: 'sancak', personality: 'trader' },
    { race: 'kul', personality: 'expander' },
  ];
  return [...seats.slice(i % 3), ...seats.slice(0, i % 3)];
}, (seat) => `${seat.race}/${seat.personality}`);
