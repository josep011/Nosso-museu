// Mobília do museu (estilo toy low-poly: formas arredondadas, cores suaves).
// Dimensões pensadas para os gatos (1,3 m de altura, quadril a ~26 cm do chão, pernas curtas):
// assentos a ~42 cm do chão, então as perninhas ficam balançando.
// Devolve os assentos (onde os gatos podem sentar) e adiciona colisões ao salão.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './RoundedBoxGeometry.js?v=202610220925';

const COR = { claro: 0xd2ad7e, nogueira: 0x7b5638, preto: 0x1d1d20, creme: 0xeadfcd, salvia: 0x9fb394, rosa: 0xd7a79d,
              terracota: 0xc47b5a, azul: 0x8ba0ad, latao: 0xb89a5a, branco: 0xf4f1ea, bege: 0xd9cbb2 };
const mats = new Map();
const M = (cor, rug = 0.8, extra = {}) => {
  const k = `${cor}|${rug}|${JSON.stringify(extra)}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: cor, roughness: rug, ...extra }));
  return mats.get(k);
};
const sombra = (m, c = true) => { m.castShadow = c; m.receiveShadow = true; return m; };
const rbox = (w, h, d, r, mat, x = 0, y = 0, z = 0) => { const m = sombra(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), mat)); m.position.set(x, y, z); return m; };
const cil = (r1, r2, h, mat, x = 0, y = 0, z = 0, seg = 20) => { const m = sombra(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat)); m.position.set(x, y, z); return m; };

// ---------- peças (frente = +z local; origem no chão, no centro) ----------
function banco(len) {
  const g = new THREE.Group();
  g.add(rbox(len, 0.07, 0.5, 0.025, M(COR.claro, 0.6), 0, 0.385, 0));
  for (const s of [-1, 1]) g.add(rbox(0.06, 0.35, 0.42, 0.012, M(COR.preto, 0.5), s * (len / 2 - 0.22), 0.175, 0));
  return { g, w: len, d: 0.5, alt: 0.42 };
}
function poltrona(cor) {
  const g = new THREE.Group(), t = M(cor, 0.92), tc = M(cor, 0.92), pe = M(COR.nogueira, 0.6);
  for (const [x, z] of [[-0.34, -0.3], [0.34, -0.3], [-0.34, 0.3], [0.34, 0.3]]) g.add(cil(0.035, 0.028, 0.16, pe, x, 0.08, z, 12));
  g.add(rbox(0.9, 0.18, 0.85, 0.06, t, 0, 0.25, 0));
  g.add(rbox(0.66, 0.1, 0.62, 0.05, tc, 0, 0.39, 0.05));
  g.add(rbox(0.9, 0.55, 0.2, 0.07, t, 0, 0.615, -0.33));
  for (const s of [-1, 1]) g.add(rbox(0.16, 0.3, 0.72, 0.06, t, s * 0.37, 0.49, 0));
  return { g, w: 0.9, d: 0.85, alt: 0.44 };
}
function sofa(cor, cor2) {
  const g = new THREE.Group(), t = M(cor, 0.92), pe = M(COR.nogueira, 0.6);
  for (const [x, z] of [[-0.9, -0.36], [0.9, -0.36], [-0.9, 0.36], [0.9, 0.36]]) g.add(cil(0.035, 0.028, 0.12, pe, x, 0.06, z, 12));
  g.add(rbox(2.0, 0.2, 0.9, 0.06, t, 0, 0.22, 0));
  for (const s of [-1, 1]) g.add(rbox(0.82, 0.12, 0.66, 0.05, t, s * 0.42, 0.38, 0.07));
  g.add(rbox(2.0, 0.55, 0.22, 0.08, t, 0, 0.6, -0.34));
  for (const s of [-1, 1]) g.add(rbox(0.2, 0.34, 0.92, 0.06, t, s * 0.9, 0.49, 0));
  for (const s of [-1, 1]) { const a = rbox(0.62, 0.34, 0.14, 0.06, M(cor2, 0.95), s * 0.45, 0.62, -0.18); a.rotation.x = -0.18; g.add(a); }
  return { g, w: 2.0, d: 0.9, alt: 0.44 };
}
function mesaCentro() {
  const g = new THREE.Group(), mm = M(COR.claro, 0.55);
  g.add(cil(0.55, 0.55, 0.05, mm, 0, 0.4, 0, 32));
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5, l = cil(0.028, 0.022, 0.38, M(COR.nogueira, 0.6), Math.cos(a) * 0.3, 0.19, Math.sin(a) * 0.3, 10); l.rotation.set(Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1); g.add(l); }
  g.add(rbox(0.3, 0.04, 0.22, 0.01, M(COR.terracota, 0.8), -0.1, 0.445, 0.05)); g.add(rbox(0.26, 0.04, 0.2, 0.01, M(COR.azul, 0.8), -0.1, 0.485, 0.05));
  g.add(cil(0.07, 0.05, 0.18, M(COR.branco, 0.4), 0.22, 0.515, -0.12, 16));
  return { g, w: 1.1, d: 1.1 };
}
function mesaLateral() {
  const g = new THREE.Group();
  g.add(cil(0.3, 0.3, 0.04, M(COR.claro, 0.55), 0, 0.55, 0, 28)); g.add(cil(0.03, 0.03, 0.5, M(COR.nogueira, 0.6), 0, 0.28, 0, 10)); g.add(cil(0.2, 0.22, 0.03, M(COR.nogueira, 0.6), 0, 0.015, 0, 24));
  g.add(cil(0.06, 0.08, 0.14, M(COR.rosa, 0.5), 0.05, 0.64, 0, 16));
  return { g, w: 0.6, d: 0.6 };
}
function luminaria() {
  const g = new THREE.Group();
  g.add(cil(0.2, 0.22, 0.03, M(COR.latao, 0.35, { metalness: 0.6 }), 0, 0.015, 0, 24)); g.add(cil(0.02, 0.02, 1.45, M(COR.latao, 0.35, { metalness: 0.6 }), 0, 0.75, 0, 10));
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.3, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd9a0, emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide }));
  sh.position.y = 1.62; g.add(sh);
  return { g, w: 0.45, d: 0.45 };
}
function balcao() {
  const g = new THREE.Group();
  g.add(rbox(2.6, 0.95, 0.7, 0.05, M(COR.nogueira, 0.55), 0, 0.475, 0));
  g.add(rbox(2.72, 0.06, 0.84, 0.025, M(COR.creme, 0.5), 0, 0.98, 0.02));
  g.add(rbox(2.2, 0.5, 0.04, 0.012, M(COR.claro, 0.6), 0, 0.5, 0.36));
  g.add(cil(0.03, 0.06, 0.07, M(COR.latao, 0.3, { metalness: 0.7 }), 0.7, 1.045, 0.1, 16)); g.add(cil(0.07, 0.09, 0.04, M(COR.latao, 0.3, { metalness: 0.7 }), 0.7, 1.025, 0.1, 16));
  const l = cil(0.06, 0.1, 0.14, M(COR.salvia, 0.5), -0.9, 1.08, 0.05, 16); g.add(l);
  return { g, w: 2.72, d: 0.84 };
}
function tapete(w, d, cor, cor2, redondo = false) {
  const g = new THREE.Group();
  if (redondo) {
    const a1 = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.02, 48), M(cor2, 1)); a1.position.y = 0.01; g.add(a1);
    const a2 = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 - 0.12, w / 2 - 0.12, 0.024, 48), M(cor, 1)); a2.position.y = 0.012; g.add(a2);
    g.children.forEach((m) => { m.receiveShadow = true; });
  }
  else { g.add(rbox(w, 0.02, d, 0.008, M(cor2, 1), 0, 0.01, 0)); g.add(rbox(w - 0.24, 0.024, d - 0.24, 0.008, M(cor, 1), 0, 0.012, 0)); }
  g.children.forEach((m) => { m.castShadow = false; });
  return { g, w, d };
}

export function construirMobilia(cena, salao) {
  const assentos = [];
  let n = 0;
  // põe uma peça: (x, z) no chão, yaw = para onde a frente olha. Colisão = retângulo da peça (yaw múltiplo de 90°).
  function por(peca, x, z, yaw, { colisao = true, assentosLocais = [], nome = '', lzAssento = -0.05, esticado = false } = {}) {
    const { g, w, d, alt } = peca;
    g.position.set(x, 0, z); g.rotation.y = yaw; cena.add(g);
    const gir = Math.abs(Math.sin(yaw)) > 0.5, W = gir ? d : w, D = gir ? w : d;
    if (colisao) salao.colliders.push({ x0: x - W / 2, z0: z - D / 2, x1: x + W / 2, z1: z + D / 2 });
    for (const lx of assentosLocais) {       // posição do assento no mundo (um pouco para trás do centro)
      const lz = lzAssento, c = Math.cos(yaw), s = Math.sin(yaw);
      assentos.push({ id: `${nome}-${++n}`, nome, x: x + lx * c + lz * s, z: z - lx * s + lz * c, yaw, alt, prof: d, esticado, ocupado: null });
    }
    return g;
  }
  const doisLugares = (len) => (len >= 1.6 ? [-0.42, 0.42] : [0]);
  const bancoEm = (len, x, z, yaw, nome) => por(banco(len), x, z, yaw, { assentosLocais: doisLugares(len), nome, lzAssento: 0.22 });

  // ---- bancos para sentar e olhar os quadros / a vista ----
  bancoEm(1.9, 0, -1.9, Math.PI, 'Banco da galeria');          // de frente para a fileira de quadros do painel central
  bancoEm(1.9, 0, -5.45, 0, 'Banco da galeria');               // de frente para o tríptico (costas do painel)
  bancoEm(1.7, -7.5, -7.0, Math.PI, 'Banco da janela');        // olhando o jardim (canto de leitura)
  bancoEm(1.7, 7.5, -7.0, Math.PI, 'Banco da janela');         // olhando o jardim (café)
  bancoEm(1.7, 9.2, 4.5, Math.PI / 2, 'Banco do salão');       // de frente para a grade de quadros
  bancoEm(1.7, -8.9, 1.2, -Math.PI / 2, 'Banco da sala');
  bancoEm(1.9, 7.56, 5.2, 0, 'Banco do mural');               // de frente para o mural de recados (com espaço para mexer nele)      // de frente para os quadros da parede esquerda

  // ---- canto de leitura: duas poltronas, mesinha, luminária e tapete redondo ----
  por(tapete(3.4, 3.4, COR.rosa, COR.bege, true), -7.4, -4.6, 0, { colisao: false });
  por(poltrona(COR.salvia), -6.7, -3.55, Math.PI / 2, { assentosLocais: [0], nome: 'Poltrona', lzAssento: 0.06, esticado: true });
  por(poltrona(COR.azul), -6.7, -5.65, Math.PI / 2, { assentosLocais: [0], nome: 'Poltrona', lzAssento: 0.06, esticado: true });
  por(mesaLateral(), -6.7, -4.6, 0);
  por(luminaria(), -6.5, -2.55, 0);

  // ---- sala de estar: sofá de dois lugares, mesa de centro, mesinha, luminária e tapete ----
  por(tapete(3.4, 3.2, COR.salvia, COR.bege), -8.0, 4.5, 0, { colisao: false });
  por(sofa(COR.creme, COR.terracota), -6.6, 4.5, -Math.PI / 2, { assentosLocais: [-0.42, 0.42], nome: 'Sofá', lzAssento: 0.06, esticado: true });
  por(mesaCentro(), -8.3, 4.5, 0);
  por(mesaLateral(), -6.6, 6.0, 0);
  por(luminaria(), -6.4, 6.6, 0);

  // ---- recepção: balcão (o funcionário fica atrás, do lado de +z) ----
  por(balcao(), 0, 7.05, Math.PI);

  return { assentos };
}
