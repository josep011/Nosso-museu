// Buquê de flores (para as patinhas dos gatos), o arranjo que fica no vaso e o vaso de vidro com água.
// Estilo toy low-poly, cada peça vira uma malha só (leve).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const SPH = new THREE.SphereGeometry(1, 10, 7), CYL = new THREE.CylinderGeometry(1, 1, 1, 10), CONE = new THREE.ConeGeometry(1, 1, 14, 1, true);
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
function juntar(partes) {
  const geos = partes.map(([geo, cor, pos, rot, esc]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(_m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...esc)));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    _c.set(cor); const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  });
  const m = new THREE.Mesh(mergeGeometries(geos, false), MAT); m.castShadow = false; return m;
}
// flores: rosas (vermelho/rosa), margaridas (branco com miolo amarelo), raminhos verdes
function flores(base = 0.1) {
  const p = [], rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const lugares = [[0, 0.02], [0.045, 0.01], [-0.045, 0.012], [0.02, 0.045], [-0.02, -0.042], [0.05, -0.035], [-0.05, 0.04], [0, -0.01]];
  lugares.forEach(([x, z], i) => {
    const y = base + 0.09 + (i === 0 ? 0.025 : 0) + rnd() * 0.012;
    p.push([CYL, 0x4f8a46, [x * 0.5, base + 0.04, z * 0.5], [z * 2, 0, -x * 2], [0.004, 0.11, 0.004]]);       // cabinho
    if (i % 3 === 2) {                                       // margarida
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; p.push([SPH, 0xfdfbf4, [x + Math.cos(a) * 0.016, y, z + Math.sin(a) * 0.016], [0, -a, 0], [0.012, 0.004, 0.006]]); }
      p.push([SPH, 0xf2c335, [x, y + 0.003, z], [0, 0, 0], [0.008, 0.006, 0.008]]);
    } else {                                                 // rosa
      const cor = i % 3 === 0 ? 0xd8344f : 0xf08aa6;
      p.push([SPH, cor, [x, y, z], [0, 0, 0], [0.022, 0.019, 0.022]]);
      p.push([SPH, cor, [x, y + 0.012, z], [0, 0, 0], [0.014, 0.012, 0.014]]);
      p.push([SPH, 0x3f7a3c, [x, y - 0.014, z], [0, 0, 0], [0.016, 0.006, 0.016]]);
    }
  });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; p.push([SPH, 0x5f9a55, [Math.cos(a) * 0.06, base + 0.08, Math.sin(a) * 0.06], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], [0.012, 0.035, 0.005]]); }
  return p;
}
// buquê de mão: papel kraft em cone com laço rosa; origem no ponto onde as patinhas seguram
export function criarBuque() {
  const p = [
    [CONE, 0xd9b48a, [0, 0.02, 0], [Math.PI, 0, 0], [0.085, 0.2, 0.085]],          // papel (cone virado)
    [CONE, 0xf4e6d4, [0, 0.035, 0], [Math.PI, 0.4, 0], [0.078, 0.17, 0.078]],      // papel de dentro
    [CYL, 0xf08aa6, [0, -0.02, 0], [0, 0, 0], [0.034, 0.025, 0.034]],             // fita
    [SPH, 0xf08aa6, [0.032, -0.02, 0.012], [0, 0, 0.5], [0.022, 0.012, 0.01]], [SPH, 0xf08aa6, [-0.032, -0.02, 0.012], [0, 0, -0.5], [0.022, 0.012, 0.01]],
    [CYL, 0x4f8a46, [0, -0.1, 0], [0, 0, 0], [0.012, 0.06, 0.012]],                // cabinhos aparecendo embaixo
    ...flores(0.05),
  ];
  const g = new THREE.Group(); g.add(juntar(p)); return g;
}
// arranjo para o vaso (sem papel)
export function criarArranjo() { const g = new THREE.Group(); g.add(juntar([[CYL, 0x4f8a46, [0, 0.1, 0], [0, 0, 0], [0.012, 0.2, 0.012]], ...flores(0.16)])); return g; }
// vaso de vidro com água
export function criarVaso() {
  const g = new THREE.Group();
  const vidro = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xdff1f5, transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  vidro.position.y = 0.1; vidro.renderOrder = 2; g.add(vidro);
  const fundo = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.012, 24), new THREE.MeshStandardMaterial({ color: 0xcfe6ea, transparent: true, opacity: 0.6, roughness: 0.1 }));
  fundo.position.y = 0.006; g.add(fundo);
  const agua = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x9fd0e0, transparent: true, opacity: 0.42, roughness: 0.05, depthWrite: false }));
  agua.position.y = 0.072; agua.renderOrder = 1; g.add(agua);
  const borda = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.004, 6, 24), new THREE.MeshStandardMaterial({ color: 0xeaf6f8, transparent: true, opacity: 0.6, roughness: 0.1 }));
  borda.rotation.x = Math.PI / 2; borda.position.y = 0.2; g.add(borda);
  return g;
}
