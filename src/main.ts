import Phaser from 'phaser';
import { GameScene } from './render/GameScene';
import { createGame } from './sim/state';
import { CFG } from './sim/data';
import type { Difficulty, Personality, PlayerSetup, RaceId } from './sim/types';

interface Blurb { title: string; text: string; perks: string[]; note?: string }
const RACE_BLURB: Record<RaceId, Blurb> = {
  sancak: { title: 'Sancaklılar', text: 'Ovaların dengeli halkı. Anlaşarak büyür.', perks: ['🌾 Çiftlikleri daha verimli', '🐎 Süvarisi ucuz', '🤝 Her pakt için kervan kristal getirir'] },
  kul: { title: 'Külboyları', text: 'Bozkırın kalabalık göçebeleri. Avlanarak büyür.', perks: ['⚔ Birimleri ucuz ve hızlı çıkar', '💰 Kamp temizleyince ganimet alır', '🏚 Binaları kırılgan'] },
  yaprak: { title: 'Yaprakdiller', text: 'Kadim ormanların okçu halkı.', perks: ['🏹 Okçuları daha uzaktan vurur', '🪵 Odunu hızlı toplar', '💔 Birimlerinin canı az'], note: 'Deneysel' },
  tasocak: { title: 'Taşocaklılar', text: 'Dağ içi ocakların sağlam ustaları.', perks: ['🛡 Piyadesi zırhlı, binaları sağlam', '💎 Kristali hızlı toplar', '🐢 Birimleri yavaş, süvarisi pahalı'], note: 'Deneysel' },
};

/** The two AI neighbours: the classic pair where possible, never the player's own people twice. */
function opponents(race: RaceId): PlayerSetup[] {
  const pool: { race: RaceId; personality: Personality; label: string }[] = [
    { race: 'sancak', personality: 'trader', label: 'Tüccar' },
    { race: 'kul', personality: 'expander', label: 'Yayılmacı' },
    { race: 'tasocak', personality: 'trader', label: 'Tüccar' },
    { race: 'yaprak', personality: 'expander', label: 'Yayılmacı' },
  ];
  const others = pool.filter((p) => p.race !== race);
  const trader = others.find((p) => p.personality === 'trader')!, expander = others.find((p) => p.personality === 'expander')!;
  return [trader, expander].map((p) => ({ race: p.race, isAI: true, personality: p.personality, name: `${RACE_BLURB[p.race].title} (${p.label})` }));
}

const LEVEL_TEXT: Record<Difficulty, string> = {
  cirak: 'Komşular ağır gelişir, orduları küçük kalır. Barış 10 dakika. Köylülerin kendiliğinden üretilir ve işe gider.',
  kasif: 'Komşular orta hızda gelişir. Barış 8 dakika. Köylülerin kendiliğinden üretilir ve işe gider.',
  komutan: 'Komşular tam hızda oynar. Barış 8 dakika. Yardım yok.',
};
let difficulty: Difficulty = 'cirak';

function start(race: RaceId): void {
  document.getElementById('menu')!.remove();
  const seed = Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e9);
  const players: PlayerSetup[] = [{ race, isAI: false, name: `Sen (${RACE_BLURB[race].title})` }, ...opponents(race)];
  const game = createGame({
    seed,
    // A different corner each match, so no start position is always the player's.
    seatOffset: Math.floor(Math.random() * players.length),
    difficulty,
    players,
  });
  const phaser = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#10140f',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  });
  phaser.scene.add('game', GameScene, true, { game, me: 0 });
  // Exposed for debugging and automated checks.
  (window as unknown as { __game: unknown }).__game = { state: game, phaser };
}

const menu = document.getElementById('menu')!;
function renderMenu(): void {
  const levels = (Object.keys(LEVEL_TEXT) as Difficulty[]).map((d) =>
    `<button data-level="${d}" class="${d === difficulty ? 'on' : ''}">${CFG.difficulty[d].name}</button>`).join('');
  menu.innerHTML = `<h1>Boylar: Kadim Miras</h1><div>Zorluk</div><div class="levels">${levels}</div><div class="help">${LEVEL_TEXT[difficulty]}</div><div>Halkını seç</div><div class="races">${
    (Object.keys(RACE_BLURB) as RaceId[]).map((r) => {
      const b = RACE_BLURB[r];
      return `<button class="race" data-race="${r}"><b>${b.title}${b.note ? ` <span class="tag">${b.note}</span>` : ''}</b>${b.text}<ul>${b.perks.map((p) => `<li>${p}</li>`).join('')}</ul></button>`;
    }).join('')
  }</div><div class="help">Barış süresinde üssünü kur, keşfet, kamp avla. Sonra Kadim Harabe'yi alıp başında 3 dakika nöbet tut ya da rakipleri yen. İki komşun var: barışçıl bir Tüccar ve saldırgan bir Yayılmacı. Onlarla savaşabilir ya da pakt yapabilirsin.<br>Okçu, süvari ve Demirci <b>Kale Çağı</b>'nda açılır: iki farklı bina kur, kaynak biriktir, üstteki ⬆ düğmesine bas.<br>“Deneysel” halkların özel birimi ve binası henüz yok; dengeleri ölçülmedi.</div>`;
}
renderMenu();
menu.addEventListener('click', (e) => {
  const level = (e.target as HTMLElement).closest('[data-level]') as HTMLElement | null;
  if (level) { difficulty = level.dataset.level as Difficulty; renderMenu(); return; }
  const el = (e.target as HTMLElement).closest('[data-race]') as HTMLElement | null;
  if (el) start(el.dataset.race as RaceId);
});
