// Vitrola: o móvel com o toca-discos (no café) e o tocador de música do jogo.
// A música toca baixinho, em loop. Para acrescentar músicas, é só pôr o arquivo na lista abaixo.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './RoundedBoxGeometry.js?v=202610212333';

export const MUSICAS = [
  { arquivo: 'sunlight_on_polished_stone.mp3', nome: 'Sunlight on Polished Stone' },
];
const VOLUME_PADRAO = 0.6;

// eco de sala (feito na hora, sem arquivo): um "ruído" que vai sumindo
function impulsoSala(ctx, seg = 2.3, queda = 3) {
  const n = Math.floor(ctx.sampleRate * seg), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, queda); }
  return buf;
}

// Tocador com som de ambiente: a música sai da vitrola. Perto fica mais alto, longe mais baixo,
// com um eco suave de salão; com parede no meio, fica abafada.
export function criarTocador(pasta, { origem, aoMudar } = {}) {
  const audio = new Audio(); audio.preload = 'none'; audio.crossOrigin = 'anonymous';
  let i = 0, querTocar = false, volume = VOLUME_PADRAO, ctx = null, no = null;
  const carregar = (n) => { i = ((n % MUSICAS.length) + MUSICAS.length) % MUSICAS.length; audio.src = pasta + MUSICAS[i].arquivo; audio.loop = MUSICAS.length === 1; };
  audio.addEventListener('ended', () => { if (MUSICAS.length > 1) { carregar(i + 1); tocar(); } });
  audio.addEventListener('play', () => aoMudar && aoMudar());
  audio.addEventListener('pause', () => aoMudar && aoMudar());
  carregar(0);

  function prepararAudio() {             // precisa acontecer depois de um toque na tela (regra dos celulares)
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { audio.volume = volume * 0.5; return; }
    try {
      ctx = new AC();
      const fonte = ctx.createMediaElementSource(audio), painel = ctx.createPanner();
      painel.panningModel = 'equalpower'; painel.distanceModel = 'linear'; painel.rolloffFactor = 0;   // só dá a direção; a distância controlamos abaixo
      const pos = origem || { x: 0, y: 0.8, z: 0 };
      if (painel.positionX) { painel.positionX.value = pos.x; painel.positionY.value = pos.y; painel.positionZ.value = pos.z; } else painel.setPosition(pos.x, pos.y, pos.z);
      const abafar = ctx.createBiquadFilter(); abafar.type = 'lowpass'; abafar.frequency.value = 18000;
      const seco = ctx.createGain(), eco = ctx.createConvolver(), molhado = ctx.createGain(), mestre = ctx.createGain();
      eco.buffer = impulsoSala(ctx); seco.gain.value = 0; molhado.gain.value = 0; mestre.gain.value = volume;
      fonte.connect(painel); painel.connect(abafar); abafar.connect(seco); seco.connect(mestre);
      fonte.connect(eco); eco.connect(molhado); molhado.connect(mestre); mestre.connect(ctx.destination);
      no = { abafar, seco, molhado, mestre };
    } catch { ctx = null; audio.volume = volume * 0.5; }
  }
  function tocar() { querTocar = true; prepararAudio(); const p = audio.play(); if (p) p.catch(() => { /* espera o próximo toque na tela */ }); aoMudar && aoMudar(); }
  function pausar() { querTocar = false; audio.pause(); aoMudar && aoMudar(); }
  const suave = (param, v) => { if (param.setTargetAtTime) param.setTargetAtTime(v, ctx.currentTime, 0.12); else param.value = v; };
  return {
    tocar, pausar,
    alternar() { if (audio.paused) tocar(); else pausar(); },
    proxima() { carregar(i + 1); if (querTocar) tocar(); else aoMudar && aoMudar(); },
    anterior() { carregar(i - 1); if (querTocar) tocar(); else aoMudar && aoMudar(); },
    ir(n, tocando) { if (n !== i) carregar(n); if (tocando) tocar(); else pausar(); },
    volume(v) { volume = Math.max(0, Math.min(1, v)); if (no) suave(no.mestre.gain, volume); else audio.volume = volume * 0.5; },
    destravar() { if (querTocar && audio.paused) tocar(); else if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    // ouvinte = onde está o seu gatinho; frente = para onde a câmera olha; parede = tem parede entre você e a vitrola
    ouvir(ouvinte, frente, parede) {
      if (!ctx || !no) return;
      const L = ctx.listener;
      if (L.positionX) { L.positionX.value = ouvinte.x; L.positionY.value = ouvinte.y; L.positionZ.value = ouvinte.z; L.forwardX.value = frente.x; L.forwardY.value = 0; L.forwardZ.value = frente.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
      else { L.setPosition(ouvinte.x, ouvinte.y, ouvinte.z); L.setOrientation(frente.x, 0, frente.z, 0, 1, 0); }
      const o = origem, d = Math.hypot(ouvinte.x - o.x, ouvinte.z - o.z), perto = 1.8 / (1.8 + 1.15 * Math.max(0, d - 1.8));
      suave(no.seco.gain, perto * (parede ? 0.5 : 1));
      suave(no.molhado.gain, 0.12 + 0.28 * perto);
      suave(no.abafar.frequency, parede ? 900 : 18000);
    },
    tocando: () => !audio.paused, indice: () => i, nome: () => MUSICAS[i].nome, volumeAtual: () => volume,
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
