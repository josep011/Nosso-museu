// Quadros nas paredes, em composições variadas (fileiras, grades, trípticos, pares...).
// Cada quadro tem um id FIXO (as fotos guardadas dependem dele: não renomear grupos).
//
// Cada quadro é um "espaço" de tamanho máximo (w x h, em metros). Quando uma foto entra, a moldura
// se ajusta ao formato da foto dentro desse espaço (passe-partout branco fino em volta), para a foto
// aparecer o maior possível. Sem foto, mostra o espaço vazio com "Sua foto aqui".
import * as THREE from 'three';

const ESTILOS = { preta: 0x1b1b1d, madeira: 0x9c7a55, clara: 0xdccbb0, branca: 0xf1efe9 };
const BORDA = 0.035;       // largura da moldura
const PROF = 0.05;         // profundidade da moldura
const MARGEM = 0.06;       // passe-partout branco em volta da foto
const ALCANCE = { min: 0.35, max: 2.5, lado: 0.7 };   // distância de frente / folga lateral para "estar perto"

// ---------- composições ----------
// fila(grupo, [x, z] do centro na parede, [nx, nz] para onde olha, estilo, itens)
// item = [deslocamento ao longo da parede, largura, altura, altura do centro]
const DEF = [];
function fila(grupo, [ax, az], [nx, nz], estilo, itens) {
  const tx = nz, tz = -nx;                       // direção ao longo da parede
  itens.forEach(([s, w, h, y], i) => DEF.push({ id: `${grupo}-${i + 1}`, x: ax + tx * s, z: az + tz * s, nx, nz, y, w, h, estilo }));
}
const GRADE = (s0, w = 0.66, h = 0.84) => [[s0 - 0.45, w, h, 1.95], [s0 + 0.45, w, h, 1.95], [s0 - 0.45, w, h, 1.0], [s0 + 0.45, w, h, 1.0]];
const PAR_VERTICAL = (w = 0.95, h = 0.72) => [[0, w, h, 2.05], [0, w, h, 1.2]];

// parede do fundo (entre as janelas): pares verticais nos cantos, um quadro entre as janelas
fila('fundo-a', [-10.05, -8], [0, 1], 'preta', PAR_VERTICAL());
fila('fundo-b', [-5.0, -8], [0, 1], 'madeira', [[0, 0.95, 1.3, 1.6]]);
fila('fundo-c', [-2.75, -8], [0, 1], 'preta', [[0, 1.5, 1.05, 1.6]]);
fila('fundo-d', [2.75, -8], [0, 1], 'preta', [[0, 1.5, 1.05, 1.6]]);
fila('fundo-e', [5.0, -8], [0, 1], 'madeira', [[0, 0.95, 1.3, 1.6]]);
fila('fundo-f', [10.05, -8], [0, 1], 'preta', PAR_VERTICAL());
// painel solto da galeria: fileira de 4 (frente) e tríptico com o do meio mais largo (costas)
fila('painel-frente', [0, -3.375], [0, 1], 'clara', [[-1.2, 0.68, 0.88, 1.6], [-0.4, 0.68, 0.88, 1.6], [0.4, 0.68, 0.88, 1.6], [1.2, 0.68, 0.88, 1.6]]);
fila('painel-tras', [0, -3.625], [0, -1], 'madeira', [[-1.1, 0.85, 1.15, 1.6], [0, 1.0, 0.85, 1.6], [1.1, 0.85, 1.15, 1.6]]);
// divisória do canto de leitura: grade 2x2 + quadro grande (galeria) / composição de três (leitura)
fila('leitura-galeria-grade', [-3.875, -6.2], [1, 0], 'branca', GRADE(0));
fila('leitura-galeria-grande', [-3.875, -3.4], [1, 0], 'madeira', [[0, 1.5, 1.05, 1.6]]);
fila('leitura-lado', [-4.125, -5.0], [-1, 0], 'branca', [[-1.35, 1.2, 0.85, 1.55], [-0.15, 0.62, 0.46, 1.85], [-0.15, 0.62, 0.46, 1.25], [1.15, 1.5, 0.62, 1.55]]);
// divisórias do café
fila('cafe-galeria', [3.875, -6], [-1, 0], 'preta', [[-0.5, 1.2, 0.85, 1.6], [0.6, 0.7, 1.0, 1.6]]);
fila('cafe-lado', [4.125, -6], [1, 0], 'clara', [[0, 1.6, 1.1, 1.6]]);
fila('cafe-fotos', [6, -3.875], [0, 1], 'madeira', [[-1.15, 1.0, 0.72, 1.6], [0, 1.0, 0.72, 1.6], [1.15, 1.0, 0.72, 1.6]]);
fila('cafe-canto', [6, -4.125], [0, -1], 'preta', [[0, 1.5, 1.05, 1.6]]);
// parede esquerda: fileira de 3 retratos (leitura), grande com dois laterais (estar), par vertical
fila('esq-leitura', [-10.99, -5], [1, 0], 'madeira', [[-0.85, 0.7, 0.95, 1.6], [0, 0.7, 0.95, 1.6], [0.85, 0.7, 0.95, 1.6]]);
fila('esq-estar', [-10.99, 1.5], [1, 0], 'preta', [[1.65, 0.7, 0.95, 1.6], [0, 1.7, 1.2, 1.6], [-1.65, 0.7, 0.95, 1.6]]);
fila('esq-fundo', [-10.99, 6], [1, 0], 'clara', PAR_VERTICAL());
// parede direita: um quadro (café), fileira de 3 retratos, grade 2x2 (fotos)
fila('dir-cafe', [10.99, -6], [-1, 0], 'preta', [[0, 1.5, 1.05, 1.6]]);
fila('dir-fotos', [10.99, -0.5], [-1, 0], 'branca', [[-1, 0.75, 1.0, 1.6], [0, 0.75, 1.0, 1.6], [1, 0.75, 1.0, 1.6]]);
fila('dir-grade', [10.99, 4.5], [-1, 0], 'madeira', GRADE(0));
// divisórias baixas
fila('estar-div-a', [-7.5, 2.625], [0, 1], 'preta', [[0, 1.4, 1.0, 1.6]]);
fila('estar-div-b', [-7.5, 2.375], [0, -1], 'clara', [[0, 1.4, 1.0, 1.6]]);
fila('fotos-div-a', [7.5, 1.125], [0, 1], 'branca', [[-0.55, 0.8, 1.1, 1.6], [0.55, 0.8, 1.1, 1.6]]);
fila('fotos-div-b', [7.5, 0.875], [0, -1], 'madeira', [[0, 1.8, 1.2, 1.6]]);

// ---------- aparência do espaço vazio ----------
const vazios = new Map();
function texVazio(w, h) {
  const chave = `${w}x${h}`; if (vazios.has(chave)) return vazios.get(chave);
  const W = 384, H = Math.round(384 * h / w), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, W, H);
  const m = W * (MARGEM / w), r = Math.min(W, H) * 0.11;
  g.fillStyle = '#ece8dd'; g.fillRect(m, m * (W / H) * (H / W), W - 2 * m, H - 2 * m);
  g.strokeStyle = '#b5ab92'; g.lineWidth = Math.max(2, W * 0.012); g.beginPath(); g.arc(W / 2, H / 2 - r * 0.25, r, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(W / 2 - r * 0.5, H / 2 - r * 0.25); g.lineTo(W / 2 + r * 0.5, H / 2 - r * 0.25);
  g.moveTo(W / 2, H / 2 - r * 0.75); g.lineTo(W / 2, H / 2 + r * 0.25); g.stroke();
  g.fillStyle = '#a69c84'; g.font = `600 ${Math.max(13, Math.round(Math.min(W, H) * 0.075))}px system-ui, sans-serif`; g.textAlign = 'center';
  g.fillText('Sua foto aqui', W / 2, H / 2 + r * 1.35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; vazios.set(chave, t); return t;
}

export function criarQuadros(cena) {
  const lista = [];
  const geoCaixa = new THREE.BoxGeometry(1, 1, 1), geoPlano = new THREE.PlaneGeometry(1, 1);

  const dimensionar = (q, W, H) => { q.W = W; q.H = H; q.moldura.scale.set(W + 2 * BORDA, H + 2 * BORDA, PROF); q.mat.scale.set(W, H, 1); };

  for (const d of DEF) {
    const grupo = new THREE.Group(); grupo.position.set(d.x, d.y, d.z); grupo.rotation.y = Math.atan2(d.nx, d.nz);
    const moldura = new THREE.Mesh(geoCaixa, new THREE.MeshStandardMaterial({ color: ESTILOS[d.estilo], roughness: 0.55, emissive: 0xe8c98f, emissiveIntensity: 0 }));
    moldura.position.z = PROF / 2;
    const vazio = texVazio(d.w, d.h);
    const mat = new THREE.Mesh(geoPlano, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: vazio, emissive: 0xffffff, emissiveMap: vazio, emissiveIntensity: 0.18 }));
    mat.position.z = PROF + 0.002;
    const foto = new THREE.Mesh(geoPlano, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.22 }));
    foto.position.z = PROF + 0.004; foto.visible = false;
    grupo.add(moldura, mat, foto); cena.add(grupo);
    const q = { ...d, cx: d.x, cz: d.z, moldura, mat, foto, vazio, temFoto: false };
    dimensionar(q, d.w, d.h); lista.push(q);
  }

  const porId = (id) => lista.find((q) => q.id === id);
  function perto(x, z, yaw = 0) {   // o quadro em que dá para "mexer" (perto e, de preferência, olhando para ele), ou null
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let melhor = null, nota = 1e9;
    for (const q of lista) {
      const dx = x - q.cx, dz = z - q.cz;
      const frente = dx * q.nx + dz * q.nz, lado = Math.abs(-dx * q.nz + dz * q.nx);
      if (frente < ALCANCE.min || frente > ALCANCE.max || lado > q.W / 2 + ALCANCE.lado) continue;
      const olhando = -(fx * q.nx + fz * q.nz);          // 1 = de frente para o quadro
      const n = frente + lado * 0.6 + (1 - olhando) * 0.9; if (n < nota) { nota = n; melhor = q; }
    }
    return melhor;
  }
  const realce = (q) => { for (const o of lista) o.moldura.material.emissiveIntensity = o === q ? 0.55 : 0; };
  const centro = (q) => ({ x: q.cx + q.nx * (PROF + 0.02), y: q.y, z: q.cz + q.nz * (PROF + 0.02) });

  function colocarFoto(q, imagem) {
    let tela = imagem;
    if (!(imagem instanceof HTMLCanvasElement)) { tela = document.createElement('canvas'); tela.width = imagem.width; tela.height = imagem.height; tela.getContext('2d').drawImage(imagem, 0, 0); }
    const t = new THREE.CanvasTexture(tela); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const fm = q.foto.material; fm.map?.dispose(); fm.map = fm.emissiveMap = t; fm.needsUpdate = true;
    // a foto ocupa o espaço do quadro mantendo sua proporção; a moldura acompanha
    const aw = q.w - 2 * MARGEM, ah = q.h - 2 * MARGEM, a = tela.width / tela.height;
    const pw = a > aw / ah ? aw : ah * a, ph = a > aw / ah ? aw / a : ah;
    q.foto.scale.set(pw, ph, 1); q.foto.visible = true;
    q.mat.material.map = q.mat.material.emissiveMap = null; q.mat.material.needsUpdate = true;
    dimensionar(q, pw + 2 * MARGEM, ph + 2 * MARGEM); q.temFoto = true;
  }
  function limparFoto(q) {
    q.foto.material.map?.dispose(); q.foto.material.map = q.foto.material.emissiveMap = null; q.foto.visible = false;
    q.mat.material.map = q.mat.material.emissiveMap = q.vazio; q.mat.material.needsUpdate = true;
    dimensionar(q, q.w, q.h); q.temFoto = false;
  }
  return { lista, porId, perto, realce, centro, colocarFoto, limparFoto };
}
