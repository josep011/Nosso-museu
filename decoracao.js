// Vida para o salão: plantas e estantes de livros (estilo toy low-poly).
// Cada planta/estante vira UMA malha só (geometrias fundidas com cor por vértice): leve para celular.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SALAO } from './salao.js';

const rng = (seed) => { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const SPH = new THREE.SphereGeometry(1, 10, 7), CYL = new THREE.CylinderGeometry(1, 1, 1, 12), VASO = new THREE.CylinderGeometry(1, 0.74, 1, 16);
const CONE = new THREE.ConeGeometry(1, 1, 8), CAIXA = new THREE.BoxGeometry(1, 1, 1);
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const quatDir = (d, giro = 0) => _q.clone().setFromUnitVectors(Y, d.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(Y, giro));

class Montagem {
  constructor() { this.partes = []; }
  add(geo, cor, pos = [0, 0, 0], rot = [0, 0, 0], esc = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const q = rot instanceof THREE.Quaternion ? rot : _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
    g.applyMatrix4(_m.compose(_p.set(pos[0], pos[1], pos[2]), q, _s.set(esc[0], esc[1], esc[2])));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    _c.set(cor); const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); this.partes.push(g);
  }
  malha() { const m = new THREE.Mesh(mergeGeometries(this.partes, false), MAT); m.castShadow = true; m.receiveShadow = true; return m; }
}

const TERRA = 0x3b2a20, VASOS = { terracota: 0xc47b5a, branco: 0xeee8da, rosa: 0xd7a79d, cinza: 0x9b9a96, azul: 0x8ba0ad };
const verde = (R) => _c.setHSL(0.24 + R() * 0.1, 0.42 + R() * 0.16, 0.25 + R() * 0.15).getHex();
function vaso(m, cor, r, h) { m.add(VASO, cor, [0, h / 2, 0], [0, 0, 0], [r, h, r]); m.add(CYL, TERRA, [0, h - 0.012, 0], [0, 0, 0], [r * 0.93, 0.024, r * 0.93]); }
function folha(m, base, az, inclina, comp, larg, cor, giro) {
  const d = new THREE.Vector3(Math.sin(inclina) * Math.cos(az), Math.cos(inclina), Math.sin(inclina) * Math.sin(az));
  const c = new THREE.Vector3(...base).addScaledVector(d, comp * 0.5 + 0.03);
  m.add(SPH, cor, c.toArray(), quatDir(d, giro), [larg, comp * 0.5, larg * 0.2]);
}

// ---------- plantas ----------
function plantaAlta(seed, cv = VASOS.terracota) {          // tipo figueira-lira: tronco fino e folhas grandes
  const R = rng(seed), m = new Montagem(); vaso(m, cv, 0.25, 0.42);
  m.add(CYL, 0x6b4b32, [0, 0.42 + 0.6, 0], [0, 0, 0], [0.022, 1.2, 0.022]);
  for (let i = 0; i < 17; i++) { const t = i / 16; folha(m, [0, 0.85 + t * 0.78, 0], i * 2.4 + R(), 1.35 - t * 1.05, 0.34 + R() * 0.12, 0.1 + R() * 0.03, verde(R), R() * 6); }
  return m.malha();
}
function arbusto(seed, cv = VASOS.branco) {                // folhagem baixa e cheia
  const R = rng(seed), m = new Montagem(); vaso(m, cv, 0.27, 0.34);
  for (let i = 0; i < 22; i++) folha(m, [0, 0.34, 0], i * 2.4 + R(), 0.2 + (i / 22) * 0.85 + R() * 0.2, 0.46 + R() * 0.26, 0.1 + R() * 0.03, verde(R), R() * 6);
  return m.malha();
}
function topiaria(seed, cv = VASOS.cinza) {                // bolinhas de folhas, bem "toy"
  const R = rng(seed), m = new Montagem(); vaso(m, cv, 0.2, 0.3);
  m.add(CYL, 0x6b4b32, [0, 0.62, 0], [0, 0, 0], [0.025, 0.7, 0.025]);
  m.add(SPH, verde(R), [0, 1.0, 0], [0, 0, 0], [0.31, 0.29, 0.31]); m.add(SPH, verde(R), [0.05, 1.32, 0.02], [0, 0, 0], [0.2, 0.19, 0.2]);
  return m.malha();
}
function cacto(seed, cv = VASOS.rosa) {
  const R = rng(seed), m = new Montagem(), g = 0x5f9a5a; vaso(m, cv, 0.1, 0.11);
  m.add(CYL, g, [0, 0.25, 0], [0, 0, 0], [0.06, 0.28, 0.06]); m.add(SPH, g, [0, 0.39, 0], [0, 0, 0], [0.06, 0.06, 0.06]);
  m.add(CYL, g, [0.08, 0.27, 0], [0, 0, 0], [0.032, 0.12, 0.032]); m.add(SPH, g, [0.08, 0.33, 0], [0, 0, 0], [0.032, 0.032, 0.032]);
  m.add(SPH, 0xe58aa0, [0, 0.45, 0], [0, 0, 0], [0.03, 0.03, 0.03]); void R;
  return m.malha();
}
function suculenta(seed, cv = VASOS.terracota) {
  const R = rng(seed), m = new Montagem(); vaso(m, cv, 0.1, 0.1);
  for (let i = 0; i < 10; i++) { const a = i * 2.4, d = new THREE.Vector3(Math.sin(0.9) * Math.cos(a), Math.cos(0.9), Math.sin(0.9) * Math.sin(a)); m.add(CONE, verde(R), [d.x * 0.045, 0.14 + d.y * 0.05, d.z * 0.045], quatDir(d), [0.03, 0.14, 0.03]); }
  return m.malha();
}

// ---------- estantes de livros ----------
const LIVROS = [0xc47b5a, 0x9fb394, 0xd7a79d, 0x8ba0ad, 0xeadfcd, 0x6c4a36, 0x2f3a4a, 0xb89a5a, 0x7a8f6a, 0xcbb08a, 0xa65d57, 0xe0c9a6, 0x4d6a73];
function enfeite(m, R, x, y, z, ch) {                       // objetinho decorativo numa prateleira
  const t = R();
  if (t < 0.4) { const cv = [0xd7a79d, 0x9fb394, 0xeadfcd, 0x8ba0ad][Math.floor(R() * 4)]; m.add(SPH, cv, [x, y + 0.075, z], [0, 0, 0], [0.06, 0.075, 0.06]); m.add(CYL, cv, [x, y + 0.17, z], [0, 0, 0], [0.022, 0.06, 0.022]); }
  else if (t < 0.75) { m.add(VASO, VASOS.terracota, [x, y + 0.04, z], [0, 0, 0], [0.05, 0.08, 0.05]); m.add(SPH, verde(R), [x, y + 0.14, z], [0, 0, 0], [0.085, 0.075, 0.085]); }
  else { for (let i = 0; i < 3; i++) m.add(CAIXA, LIVROS[Math.floor(R() * LIVROS.length)], [x + (R() - 0.5) * 0.02, y + 0.018 + i * 0.036, z], [0, (R() - 0.5) * 0.3, 0], [0.21 - i * 0.02, 0.034, 0.15]); }
  void ch;
}
function estante(seed, w, h, niveis, d = 0.34) {            // frente = +z; origem no chão, no centro
  const R = rng(seed), m = new Montagem(), t = 0.03, base = 0.07, mad = 0x7b5638, mad2 = 0x8a6444;
  const ch = (h - base - (niveis + 1) * t) / niveis;
  for (const s of [-1, 1]) m.add(CAIXA, mad, [s * (w / 2 - t / 2), h / 2, 0], [0, 0, 0], [t, h, d]);
  m.add(CAIXA, 0x6b4a33, [0, h / 2, -d / 2 + 0.006], [0, 0, 0], [w - 2 * t, h, 0.012]);
  m.add(CAIXA, 0x1f1d1f, [0, base / 2, -0.02], [0, 0, 0], [w - 2 * t, base, d - 0.06]);
  for (let k = 0; k <= niveis; k++) m.add(CAIXA, k % 2 ? mad2 : mad, [0, base + t / 2 + k * (ch + t), 0], [0, 0, 0], [w - 2 * t + 0.002, t, d]);
  for (let k = 0; k < niveis; k++) {
    const piso = base + t + k * (ch + t), x0 = -w / 2 + t + 0.02, x1 = w / 2 - t - 0.02; let x = x0;
    const alvo = x1 - (R() < 0.45 ? 0.2 + R() * 0.3 : 0);        // algumas prateleiras terminam com espaço para um enfeite
    while (x < alvo - 0.04) {
      if (R() < 0.07) { enfeite(m, R, x + 0.12, piso, -d / 2 + 0.2, ch); x += 0.26; continue; }
      const bw = 0.028 + R() * 0.045, bh = ch * (0.6 + R() * 0.34), bd = d * (0.6 + R() * 0.22), cor = LIVROS[Math.floor(R() * LIVROS.length)];
      if (R() < 0.1 && x + bh < alvo) { m.add(CAIXA, cor, [x + bh * 0.5, piso + bw / 2, -d / 2 + 0.03 + bd / 2], [0, 0, 0], [bh, bw, bd]); x += bh + 0.01; continue; }   // livro deitado
      const incl = R() < 0.08 ? (R() < 0.5 ? -0.22 : 0.22) : 0;
      m.add(CAIXA, cor, [x + bw / 2 + Math.abs(incl) * bh * 0.4, piso + bh / 2, -d / 2 + 0.03 + bd / 2 + R() * 0.02], [0, 0, incl], [bw, bh, bd]);
      x += bw + 0.004 + Math.abs(incl) * bh * 0.7;
    }
  }
  return m.malha();
}

export function construirDecoracao(cena, salao) {
  const colocar = (obj, x, y, z, yaw = 0, esc = 1) => { obj.position.set(x, y, z); obj.rotation.y = yaw; obj.scale.setScalar(esc); cena.add(obj); return obj; };
  const bloco = (x, z, r) => salao.colliders.push({ x0: x - r, z0: z - r, x1: x + r, z1: z + r });

  // plantas grandes (no chão), longe de quadros e de caminhos
  const grandes = [
    [plantaAlta(11, VASOS.terracota), -2.45, 7.25, 1], [plantaAlta(12, VASOS.branco), 3.3, 7.25, 1.05],      // recepção
    [arbusto(21, VASOS.branco), -9.2, -7.3, 1], [plantaAlta(13, VASOS.cinza), 0, -7.4, 0.95], [arbusto(22, VASOS.terracota), 9.2, -7.3, 1],    // janelas
    [topiaria(31, VASOS.cinza), -2.25, -3.5, 1], [topiaria(32, VASOS.branco), 2.25, -3.5, 1],                // pontas do painel central
    [plantaAlta(14, VASOS.rosa), -10.1, 7.3, 1], [plantaAlta(15, VASOS.terracota), 10.1, 7.3, 1], [arbusto(23, VASOS.cinza), 10.2, 2.3, 1],    // cantos
  ];
  for (const [o, x, z, e] of grandes) { colocar(o, x, 0, z, (x * 7 + z) % 6, e); bloco(x, z, 0.24 * e); }

  // plantinhas sobre móveis
  colocar(cacto(41), -6.55, 0.57, 6.0, 0.4);          // mesinha do sofá
  colocar(suculenta(42), 1.05, 1.01, 7.15, 0.3);      // balcão da recepção
  colocar(cacto(43, VASOS.branco), -6.8, 0.57, -4.5, 1.2);   // mesinha da leitura (ao lado do vaso rosa)

  // estantes de livros encostadas nas paredes (livres de quadros)
  const colar = (obj, w, d, xParede, z, yaw) => {
    const x = xParede + (yaw > 0 ? 1 : -1) * (d / 2 + 0.02); colocar(obj, x, 0, z, yaw);
    const xm = Math.min(xParede, xParede + (yaw > 0 ? 1 : -1) * (d + 0.04)), xM = Math.max(xParede, xParede + (yaw > 0 ? 1 : -1) * (d + 0.04));
    salao.colliders.push({ x0: xm, z0: z - w / 2, x1: xM, z1: z + w / 2 });
  };
  colar(estante(101, 2.6, 2.15, 5), 2.6, 0.34, SALAO.x0, -2.2, Math.PI / 2);        // canto de leitura (parede esquerda)
  colar(estante(102, 2.4, 2.15, 5), 2.4, 0.34, SALAO.x1, -3.6, -Math.PI / 2);       // café (parede direita)
  const baixa = estante(103, 1.6, 1.1, 3); colar(baixa, 1.6, 0.34, SALAO.x0, 4.5, Math.PI / 2);   // aparador de livros na sala de estar
  colocar(topiaria(44, VASOS.branco), SALAO.x0 + 0.2, 1.1, 4.5, 0, 0.5);             // plantinha em cima do aparador
  return {};
}
