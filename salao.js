// O salão do museu: estrutura, divisórias, piso por zona, janelas, teto e luzes.
// Medidas em metros. O gato tem ~1,3 m de altura no jogo, então o salão é "galeria grande".
// Nada de móveis ou decoração aqui: só o espaço que vamos mobiliar nas próximas etapas.
import * as THREE from 'three';

export const SALAO = { x0: -11, x1: 11, z0: -8, z1: 8, h: 3.8 };

// Zonas do salão (cada uma tem um piso próprio e um nome que aparece na tela).
export const ZONAS = [
  { id: 'galeria',  nome: 'Galeria central',  x0: -4,  x1: 4,  z0: -8, z1: 4.5, piso: 'ladrilho', cor: '#d9d4c7' },
  { id: 'recepcao', nome: 'Recepção',         x0: -4,  x1: 4,  z0: 4.5, z1: 8,  piso: 'ladrilho', cor: '#e7ddcc' },
  { id: 'leitura',  nome: 'Canto de leitura', x0: -11, x1: -4, z0: -8, z1: -2,  piso: 'madeira',  cor: '#bf9467' },
  { id: 'estar',    nome: 'Sala de estar',    x0: -11, x1: -4, z0: -2, z1: 8,   piso: 'madeira',  cor: '#a9805a' },
  { id: 'cafe',     nome: 'Café e música',    x0: 4,   x1: 11, z0: -8, z1: -4,  piso: 'ladrilho', cor: '#b9c5ae' },
  { id: 'fotos',    nome: 'Salão das fotos',  x0: 4,   x1: 11, z0: -4, z1: 8,   piso: 'ladrilho', cor: '#d4d0c7' },
];

// Onde cada gato aparece (virados para dentro do salão).
export const SPAWN = {
  terno:  { x: -1.3, z: 5.6, yaw: Math.PI },
  medica: { x: 1.3,  z: 5.6, yaw: Math.PI },
};

const ESP = 0.25;            // espessura das divisórias
const COR_PAREDE = 0xd5d2ca;
const COR_RODAPE = 0xf0ede5;

// ---------- texturas desenhadas por código (sem arquivos externos) ----------
function canvasTex(w, h, desenhar, repX, repY) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  desenhar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.repeat.set(repX, repY);
  return t;
}
const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const ajusta = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };

function texLadrilho(cor, repX, repY) {      // 1 ladrilho = 0,8 m
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = ajusta(cor, (rnd() - 0.5) * 0.02); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '90,80,60'},${0.015 + rnd() * 0.02})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 14, 2 + rnd() * 14); }
    g.strokeStyle = 'rgba(70,62,50,0.28)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
  }, repX / 0.8, repY / 0.8);
}
function texMadeira(cor, repX, repY) {       // textura de 1,2 m x 1,2 m, 6 tábuas de 0,2 m
  return canvasTex(512, 512, (g, w, h) => {
    const n = 6, th = h / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = ajusta(cor, (rnd() - 0.5) * 0.07); g.fillRect(0, i * th, w, th);
      for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(60,38,20,${0.05 + rnd() * 0.07})`; g.lineWidth = 1 + rnd() * 1.5;
        const y = i * th + 6 + rnd() * (th - 12); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 6, w * 0.7, y + (rnd() - 0.5) * 6, w, y); g.stroke(); }
      const jx = w * (0.25 + rnd() * 0.5); g.fillStyle = 'rgba(40,26,14,0.45)'; g.fillRect(jx, i * th, 2, th);
      g.fillStyle = 'rgba(40,26,14,0.5)'; g.fillRect(0, i * th, w, 2);
    }
  }, repX / 1.2, repY / 1.2);
}
function texPaisagem() {                      // vista de fora pelas janelas (estilo brinquedo)
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const g = c.getContext('2d');
  const ceu = g.createLinearGradient(0, 0, 0, 440); ceu.addColorStop(0, '#9fc6df'); ceu.addColorStop(1, '#eef3ee');
  g.fillStyle = ceu; g.fillRect(0, 0, 2048, 512);
  for (const [cor, base, amp, fr] of [['#a9bfa0', 400, 40, 0.004], ['#93ad8b', 430, 28, 0.007]]) {
    g.fillStyle = cor; g.beginPath(); g.moveTo(0, 512);
    for (let x = 0; x <= 2048; x += 8) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * fr + base)));
    g.lineTo(2048, 512); g.fill();
  }
  g.fillStyle = '#b9cda7'; g.fillRect(0, 440, 2048, 72);
  for (let i = 0; i < 46; i++) { const x = rnd() * 2048, y = 410 + rnd() * 50, r = 14 + rnd() * 22;
    g.fillStyle = '#7b5d44'; g.fillRect(x - 3, y, 6, r * 0.9);
    g.fillStyle = ['#7ea072', '#6c9066', '#8fb083'][i % 3]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function construirSalao(cena) {
  const colliders = [];
  const paredes = new THREE.Group(); paredes.name = 'paredes'; cena.add(paredes);
  const matParede = new THREE.MeshStandardMaterial({ color: COR_PAREDE, roughness: 0.95 });
  const matRodape = new THREE.MeshStandardMaterial({ color: COR_RODAPE, roughness: 0.7 });
  const matBranco = new THREE.MeshStandardMaterial({ color: 0xf7f5ef, roughness: 0.55 });
  const matLatao = new THREE.MeshStandardMaterial({ color: 0xb89a5a, roughness: 0.35, metalness: 0.65 });

  const caixa = (x0, y0, z0, x1, y1, z1, mat, pai = paredes, sombra = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = sombra; m.receiveShadow = true; pai.add(m); return m;
  };
  const bloco = (x0, z0, x1, z1) => colliders.push({ x0, z0, x1, z1 });

  // ---------- pisos por zona + soleiras de latão ----------
  const pisos = new THREE.Group(); cena.add(pisos);
  for (const z of ZONAS) {
    const w = z.x1 - z.x0, d = z.z1 - z.z0;
    const mapa = z.piso === 'madeira' ? texMadeira(z.cor, w, d) : texLadrilho(z.cor, w, d);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: mapa, roughness: z.piso === 'madeira' ? 0.6 : 0.5 }));
    m.rotation.x = -Math.PI / 2; m.position.set((z.x0 + z.x1) / 2, 0, (z.z0 + z.z1) / 2); m.receiveShadow = true; pisos.add(m);
  }
  for (const [x0, z0, x1, z1] of [[-4.04, -8, -3.96, 8], [3.96, -8, 4.04, 8], [-4, 4.46, 4, 4.54], [-11, -2.04, -4, -1.96], [4, -4.04, 11, -3.96]])
    caixa(x0, 0, z0, x1, 0.014, z1, matLatao, pisos, false);

  // ---------- paredes externas (com janelas reais no fundo) ----------
  const { x0, x1, z0, z1, h } = SALAO, T = 0.3;
  caixa(x0 - T, 0, z1, x1 + T, h, z1 + T, matParede);                // frente
  caixa(x0 - T, 0, z0, x0, h, z1, matParede);                        // esquerda
  caixa(x1, 0, z0, x1 + T, h, z1, matParede);                        // direita
  bloco(x0 - T, z1, x1 + T, z1 + T); bloco(x0 - T, z0 - T, x0, z1); bloco(x1, z0 - T, x1 + T, z1);
  bloco(x0 - T, z0 - T, x1 + T, z0);                                  // fundo (inteiro, janelas ficam fechadas por colisão)
  const JAN = [-7.5, 0, 7.5], JL = 3.2, J0 = 0.8, J1 = 2.9;
  let cur = x0 - T;
  for (const c of JAN) {
    caixa(cur, 0, z0 - T, c - JL / 2, h, z0, matParede);
    caixa(c - JL / 2, 0, z0 - T, c + JL / 2, J0, z0, matParede);
    caixa(c - JL / 2, J1, z0 - T, c + JL / 2, h, z0, matParede);
    cur = c + JL / 2;
    // moldura, divisões e peitoril
    const a = 0.07, zf0 = z0 - T - 0.02, zf1 = z0 + 0.02;
    caixa(c - JL / 2 - a, J0 - a, zf0, c + JL / 2 + a, J0, zf1, matBranco);
    caixa(c - JL / 2 - a, J1, zf0, c + JL / 2 + a, J1 + a, zf1, matBranco);
    caixa(c - JL / 2 - a, J0, zf0, c - JL / 2, J1, zf1, matBranco);
    caixa(c + JL / 2, J0, zf0, c + JL / 2 + a, J1, zf1, matBranco);
    caixa(c - 0.03, J0, zf0 + 0.08, c + 0.03, J1, zf1 - 0.08, matBranco);
    caixa(c - JL / 2, (J0 + J1) / 2 - 0.03, zf0 + 0.08, c + JL / 2, (J0 + J1) / 2 + 0.03, zf1 - 0.08, matBranco);
    caixa(c - JL / 2 - 0.15, J0 - 0.01, z0 - 0.05, c + JL / 2 + 0.15, J0 + 0.05, z0 + 0.3, matBranco);
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(JL, J1 - J0), new THREE.MeshBasicMaterial({ color: 0xdff0f8, transparent: true, opacity: 0.16, depthWrite: false }));
    vidro.position.set(c, (J0 + J1) / 2, z0 - 0.15); cena.add(vidro);
  }
  caixa(cur, 0, z0 - T, x1 + T, h, z0, matParede);
  const paisagem = new THREE.Mesh(new THREE.PlaneGeometry(80, 20), new THREE.MeshBasicMaterial({ map: texPaisagem(), toneMapped: false }));
  paisagem.position.set(0, 8.4, z0 - 20); cena.add(paisagem);

  // ---------- rodapés das paredes externas ----------
  caixa(x0, 0, z1 - 0.03, x1, 0.14, z1, matRodape, paredes, false);
  caixa(x0, 0, z0, x1, 0.14, z0 + 0.03, matRodape, paredes, false);
  caixa(x0, 0, z0, x0 + 0.03, 0.14, z1, matRodape, paredes, false);
  caixa(x1 - 0.03, 0, z0, x1, 0.14, z1, matRodape, paredes, false);

  // ---------- divisórias soltas (poucas paredes, como na galeria de referência) ----------
  const painel = (xa, za, xb, zb, altura) => {
    const vertical = xa === xb;
    const a = vertical ? [xa - ESP / 2, Math.min(za, zb), xa + ESP / 2, Math.max(za, zb)] : [Math.min(xa, xb), za - ESP / 2, Math.max(xa, xb), za + ESP / 2];
    caixa(a[0], 0, a[1], a[2], altura, a[3], matParede);
    caixa(a[0] - 0.03, 0, a[1] - 0.03, a[2] + 0.03, 0.14, a[3] + 0.03, matRodape, paredes, false);
    bloco(a[0], a[1], a[2], a[3]);
  };
  painel(-4, -8, -4, -2, 3.8);     // separa o canto de leitura da galeria
  painel(4, -8, 4, -4, 3.8);       // fundo do canto do café
  painel(4, -4, 8, -4, 3.8);       // "L" do canto do café (entrada pela direita)
  painel(-1.6, -3.5, 1.6, -3.5, 2.8);   // painel solto no centro da galeria (para quadros)
  painel(-4, 5.5, -4, 8, 3.8);     // laterais da recepção
  painel(4, 5.5, 4, 8, 3.8);
  painel(-9, 2.5, -6, 2.5, 2.8);   // divisória baixa da sala de estar
  painel(6, 1, 9, 1, 2.8);         // divisória baixa do salão das fotos

  // ---------- teto escuro com trilhos e spots (como no print) ----------
  const matTeto = new THREE.MeshStandardMaterial({ color: 0x2c2b30, roughness: 0.95 });
  const teto = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 2 * T, 0.2, z1 - z0 + 2 * T), matTeto);
  teto.position.set(0, h + 0.1, 0); teto.castShadow = true; cena.add(teto);
  const matTrilho = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.6 });
  const trilhosZ = [-5.5, -1, 3.2, 6.2], spots = [], trilhos = [];
  for (const z of trilhosZ) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 1, 0.05, 0.08), matTrilho); t.position.set(0, h - 0.03, z); cena.add(t); trilhos.push(t);
    for (let x = x0 + 1.4; x < x1; x += 2.6) spots.push([x, z]);
  }
  const corpo = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.095, 0.22, 14), matTrilho, spots.length);
  const brilho = new THREE.InstancedMesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshBasicMaterial({ color: 0xfff3d4, toneMapped: false }), spots.length);
  const M = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    corpo.setMatrixAt(i, M.makeTranslation(x, h - 0.17, z));
    brilho.setMatrixAt(i, M.makeRotationX(Math.PI / 2).setPosition(x, h - 0.285, z));
  });
  cena.add(corpo, brilho);

  // ---------- luzes ----------
  cena.add(new THREE.HemisphereLight(0xfff6ea, 0xa89c8e, 1.35));
  const sol = new THREE.DirectionalLight(0xfff0d8, 2.6);       // entra pelas janelas do fundo
  sol.position.set(3, 14, -16); sol.target.position.set(0, 0, 0);
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -17, right: 17, top: 13, bottom: -13, near: 1, far: 45 });
  sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03;
  cena.add(sol, sol.target);
  for (const [x, z] of [[-7.5, -5], [7.5, -6], [0, -2], [-7.5, 4], [7.5, 3], [0, 6.2]]) {
    const l = new THREE.PointLight(0xffe2b8, 12, 14, 2); l.position.set(x, h - 0.5, z); cena.add(l);
  }

  // o teto some só para a câmera (continua fazendo sombra): útil na "vista de cima"
  const esconderTeto = (sim) => { matTeto.colorWrite = !sim; matTeto.depthWrite = !sim; corpo.visible = brilho.visible = !sim; trilhos.forEach((t) => { t.visible = !sim; }); };

  return { colliders, paredes, teto, esconderTeto };
}
