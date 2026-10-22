// Vitrola: o móvel com o toca-discos (no café) e o tocador de música do jogo.
// A música toca baixinho, em loop. Para acrescentar músicas, é só pôr o arquivo na lista abaixo.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './RoundedBoxGeometry.js?v=202610212212';

export const MUSICAS = [
  { arquivo: 'sunlight_on_polished_stone.mp3', nome: 'Sunlight on Polished Stone' },
];
const VOLUME_PADRAO = 0.3;

export function criarTocador(pasta, { aoMudar } = {}) {
  const audio = new Audio(); audio.preload = 'none'; audio.volume = VOLUME_PADRAO;
  let i = 0, querTocar = false;
  const carregar = (n) => { i = ((n % MUSICAS.length) + MUSICAS.length) % MUSICAS.length; audio.src = pasta + MUSICAS[i].arquivo; audio.loop = MUSICAS.length === 1; };
  audio.addEventListener('ended', () => { if (MUSICAS.length > 1) { carregar(i + 1); tocar(); } });
  audio.addEventListener('play', () => aoMudar && aoMudar());
  audio.addEventListener('pause', () => aoMudar && aoMudar());
  carregar(0);
  function tocar() { querTocar = true; const p = audio.play(); if (p) p.catch(() => { /* o celular só deixa tocar depois de um toque na tela */ }); aoMudar && aoMudar(); }
  function pausar() { querTocar = false; audio.pause(); aoMudar && aoMudar(); }
  return {
    tocar, pausar,
    alternar() { if (audio.paused) tocar(); else pausar(); },
    proxima() { carregar(i + 1); if (querTocar) tocar(); else aoMudar && aoMudar(); },
    anterior() { carregar(i - 1); if (querTocar) tocar(); else aoMudar && aoMudar(); },
    ir(n, tocando) { if (n !== i) carregar(n); if (tocando) tocar(); else pausar(); },
    volume(v) { audio.volume = Math.max(0, Math.min(1, v)); },
    tocando: () => !audio.paused, indice: () => i, nome: () => MUSICAS[i].nome, volumeAtual: () => audio.volume,
    retomarSeQueria() { if (querTocar && audio.paused) tocar(); },
  };
}

// móvel baixo de madeira com toca-discos em cima (frente = +z)
export function criarVitrola(cena, salao, { x, z, yaw }) {
  const g = new THREE.Group();
  const M = (c, r = 0.6, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...e });
  const caixa = (w, h, d, r, m, px, py, pz) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const nog = M(0x7b5638), clara = M(0xd2ad7e), preto = M(0x1d1d20, 0.4), latao = M(0xb89a5a, 0.3, { metalness: 0.7 });
  caixa(1.1, 0.62, 0.42, 0.03, nog, 0, 0.39, 0);                       // móvel
  caixa(0.5, 0.42, 0.02, 0.008, clara, -0.27, 0.39, 0.215); caixa(0.5, 0.42, 0.02, 0.008, clara, 0.27, 0.39, 0.215);  // portinhas
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), latao); p.rotation.x = Math.PI / 2; p.position.set(s * 0.05, 0.42, 0.24); g.add(p); }
  for (const [px, pz] of [[-0.48, -0.15], [0.48, -0.15], [-0.48, 0.15], [0.48, 0.15]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.08, 8), preto); l.position.set(px, 0.04, pz); g.add(l); }
  caixa(0.52, 0.07, 0.4, 0.02, clara, -0.12, 0.735, 0);                // base do toca-discos
  const prato = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 40), preto); prato.position.set(-0.17, 0.776, 0); g.add(prato);
  const disco = new THREE.Group(); disco.position.set(-0.17, 0.785, 0); g.add(disco);
  const vinil = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.006, 40), M(0x111114, 0.25)); disco.add(vinil);
  const rotulo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 24), M(0xd7a79d, 0.6)); disco.add(rotulo);
  const marca = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.009, 0.012), M(0xf4f1ea)); marca.position.set(0.03, 0.001, 0); disco.add(marca);   // para ver o disco girar
  const braco = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), latao); braco.rotation.set(Math.PI / 2, 0, 0.5); braco.position.set(0.0, 0.8, -0.02); g.add(braco);
  const pino = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), latao); pino.position.set(0.05, 0.79, -0.1); g.add(pino);
  // pilha de discos e um vasinho ao lado
  for (let k = 0; k < 4; k++) caixa(0.2, 0.012, 0.2, 0.003, M([0xc47b5a, 0x8ba0ad, 0xeadfcd, 0x9fb394][k]), 0.33, 0.705 + k * 0.013, 0.02 + (k % 2) * 0.01);
  g.position.set(x, 0, z); g.rotation.y = yaw; cena.add(g);
  const gir = Math.abs(Math.sin(yaw)) > 0.5, W = gir ? 0.42 : 1.1, D = gir ? 1.1 : 0.42;
  salao.colliders.push({ x0: x - W / 2, z0: z - D / 2, x1: x + W / 2, z1: z + D / 2 });
  let vel = 0;
  return { x, z, atualizar(dt, tocando) { vel += ((tocando ? 3.5 : 0) - vel) * Math.min(1, 3 * dt); disco.rotation.y -= vel * dt; } };
}
