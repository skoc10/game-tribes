import Phaser from 'phaser';
import { GameScene } from './render/GameScene';
import { createGame } from './sim/state';
import type { RaceId } from './sim/types';

const RACE_BLURB: Record<RaceId, { title: string; text: string }> = {
  sancak: { title: 'Sancaklılar', text: 'Dengeli halk. Çiftlikleri verimli, süvarisi ucuz. Anlaşarak büyür.' },
  kul: { title: 'Külboyları', text: 'Kalabalık ve hızlı. Birimleri ucuz, binaları kırılgan. Avlanarak büyür.' },
};

function start(race: RaceId): void {
  document.getElementById('menu')!.remove();
  const seed = Number(new URLSearchParams(location.search).get('seed')) || 1;
  const game = createGame({
    seed,
    players: [
      { race, isAI: false },
      { race: 'sancak', isAI: true, name: 'Sancaklılar (Tüccar)' },
      { race: 'kul', isAI: true, name: 'Külboyları (Yayılmacı)' },
    ],
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
menu.innerHTML = `<h1>Boylar: Kadim Miras</h1><div>Halkını seç</div><div class="races">${
  (Object.keys(RACE_BLURB) as RaceId[]).map((r) => `<button class="race" data-race="${r}"><b>${RACE_BLURB[r].title}</b>${RACE_BLURB[r].text}</button>`).join('')
}</div><div class="help">Erken prototip. İlk 8 dakika barış: üssünü kur, keşfet, kamp avla. Sonra Kadim Harabe'yi 3 dakika tut ya da rakipleri yen. Yapay zekâ ve diplomasi henüz yok.</div>`;
menu.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-race]') as HTMLElement | null;
  if (el) start(el.dataset.race as RaceId);
});
