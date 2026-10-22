// Funcionário da recepção: o mesmo modelo do gatinho de terno, com pelagem laranja e branca
// (padrão da foto de referência) e terno vinho. Fica em pé atrás do balcão; acena quando alguém chega perto.
import * as THREE from 'three';
import { criarGato } from './gato.js?v=202610212251';

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const FACE = /^(olhos|boca|extra|rosto)/;
const ROUPA = /^tinta (paletó|calça|braço|manga|antebraço|punho|canela|coxa)/;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// cinza do pelo -> laranja; branco continua branco (rosto, peito, focinho ficam brancos, como no gato da foto)
function laranjaTextura(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2], L = (0.299 * r + 0.587 * gg + 0.114 * b) / 255, t = suave(0.66, 0.86, L), k = Math.min(1.25, Math.max(0.6, L / 0.55));
    p[i] = Math.min(255, 228 * k) * (1 - t) + r * t; p[i + 1] = Math.min(255, 138 * k) * (1 - t) + gg * t; p[i + 2] = Math.min(255, 58 * k) * (1 - t) + b * t;
  }
  g.putImageData(d, 0, 0); return c;
}
function recolorir(modelo) {
  modelo.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'cabeça' && o.material.map) {
      o.material = o.material.clone();
      const t = new THREE.CanvasTexture(laranjaTextura(o.material.map.image));
      t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; o.material.map = t;
    } else if (o.geometry.attributes.color) {        // cauda e orelhas: cor por vértice (linear)
      o.geometry = o.geometry.clone(); const a = o.geometry.attributes.color;
      for (let i = 0; i < a.count; i++) {
        const r = a.getX(i), g = a.getY(i), b = a.getZ(i), L = 0.299 * r + 0.587 * g + 0.114 * b, t = suave(0.45, 0.75, L), k = Math.min(1.25, Math.max(0.6, L / 0.22));
        a.setXYZ(i, Math.min(1, 0.76 * k) * (1 - t) + r * t, Math.min(1, 0.26 * k) * (1 - t) + g * t, Math.min(1, 0.048 * k) * (1 - t) + b * t);
      }
    } else if (ROUPA.test(o.material.name)) {        // terno vinho (mantém os tons claros/escuros do original)
      o.material = o.material.clone(); const hsl = {}; o.material.color.getHSL(hsl);
      o.material.color.setHSL(0.97, 0.38, Math.min(0.4, hsl.l * 1.15));
    }
  });
}

export function criarRecepcionista(gltf, cena, { x, z, yaw, altura = 1.3 }) {
  const gato = criarGato(gltf); recolorir(gato.modelo);
  const caixa = new THREE.Box3().setFromObject(gato.modelo), esc = altura / (caixa.max.y - caixa.min.y);
  const interno = new THREE.Group(); interno.scale.setScalar(esc); interno.position.y = -caixa.min.y * esc; interno.add(gato.modelo);
  const grupo = new THREE.Group(); grupo.add(interno); cena.add(grupo);
  gato.modelo.traverse((o) => { if (o.isMesh) { o.castShadow = !FACE.test(o.name); o.receiveShadow = false; } });
  grupo.position.set(x, 0, z); grupo.rotation.y = yaw;

  const e = { yaw: yaw, perto: false, cd: 3, ocio: 6 + Math.random() * 6, humorT: 0 };
  function atualizar(dt, jogadores) {
    let mais = null, md = 1e9;
    for (const j of jogadores) { const d = Math.hypot(j.x - x, j.z - z); if (d < md) { md = d; mais = j; } }
    const perto = md < 3.6; e.cd -= dt; e.ocio -= dt;
    if (perto && !e.perto && e.cd <= 0) { gato.acao('acenar'); gato.humor('feliz'); e.humorT = 3.2; e.cd = 14; e.ocio = 9; }   // cumprimenta quem chega
    e.perto = perto;
    if (e.humorT > 0 && (e.humorT -= dt) <= 0) gato.humor('normal');
    if (e.ocio <= 0) {                               // movimento aleatório, bem tranquilo
      const lista = perto ? ['balancar', 'olhar'] : ['olhar', 'pensar', 'balancar', 'espreguicar'];
      gato.acao(lista[Math.floor(Math.random() * lista.length)]); e.ocio = 8 + Math.random() * 9;
    }
    let alvo = yaw;                                  // vira devagar para quem está perto
    if (mais && md < 5.5) { const a = Math.atan2(mais.x - x, mais.z - z); alvo = yaw + Math.max(-1.0, Math.min(1.0, angDiff(yaw, a))); }
    e.yaw += angDiff(e.yaw, alvo) * Math.min(1, 3 * dt); grupo.rotation.y = e.yaw;
    gato.atualizar(dt);
  }
  return { grupo, gato, atualizar };
}
