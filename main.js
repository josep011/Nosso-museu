// Nosso Museu — jogo: cena, gatos, controles, colisões e câmera.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { criarGato } from './gato.js';
import { construirSalao, ZONAS, SPAWN } from './salao.js';
import { criarQuadros } from './quadros.js';
import { construirMobilia } from './mobilia.js';
import { construirDecoracao } from './decoracao.js';
import { criarRecepcionista } from './recepcionista.js';
import * as armazem from './armazem.js';

const ALTURA_GATO = 1.3;      // altura do gato no jogo, em metros
const RAIO = 0.38;            // "tamanho" do gato para colisões
const VELOCIDADE = 2.4;       // m/s
const $ = (id) => document.getElementById(id);

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('cena'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = 'NeutralToneMapping' in THREE ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const cena = new THREE.Scene(); cena.background = new THREE.Color(0xcfd8dc);
const pmrem = new THREE.PMREMGenerator(renderer);
cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; cena.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
const salao = construirSalao(cena);
const quadros = criarQuadros(cena);
const mobilia = construirMobilia(cena, salao);
construirDecoracao(cena, salao);

function ajustar() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', ajustar); ajustar();

// ---------- gatos ----------
const FACE = /^(olhos|boca|extra|rosto)/;
function criarJogador(gltf, nome, spawn, extra = {}) {
  const gato = criarGato(gltf);
  const caixa = new THREE.Box3().setFromObject(gato.modelo);
  const esc = ALTURA_GATO / (caixa.max.y - caixa.min.y);
  const interno = new THREE.Group(); interno.scale.setScalar(esc); interno.position.y = -caixa.min.y * esc; interno.add(gato.modelo);
  const grupo = new THREE.Group(); grupo.add(interno); cena.add(grupo);
  gato.modelo.traverse((o) => { if (o.isMesh) { o.castShadow = !FACE.test(o.name); o.receiveShadow = false; } });
  grupo.position.set(spawn.x, 0, spawn.z); grupo.rotation.y = spawn.yaw;
  grupo.updateMatrixWorld(true);       // altura do quadril em pé (para encaixar no assento ao sentar)
  const perna = gato.modelo.getObjectByName('perna_esq'); const vq = new THREE.Vector3();
  const hipAlt = perna ? perna.getWorldPosition(vq).y : 0.26;
  return { nome, gato, grupo, x: spawn.x, z: spawn.z, yaw: spawn.yaw, andando: false, esc, hipAlt, assento: null, altSent: 0, ...extra };
}

// ---------- colisões ----------
function empurrar(p) {
  for (let it = 0; it < 3; it++) {
    for (const c of salao.colliders) {
      const cx = Math.max(c.x0, Math.min(p.x, c.x1)), cz = Math.max(c.z0, Math.min(p.z, c.z1));
      let dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= RAIO * RAIO) continue;
      if (d2 < 1e-8) {   // centro dentro do bloco: sai pelo lado mais perto
        const e = [p.x - c.x0, c.x1 - p.x, p.z - c.z0, c.z1 - p.z], m = Math.min(...e), i = e.indexOf(m);
        if (i === 0) p.x = c.x0 - RAIO; else if (i === 1) p.x = c.x1 + RAIO; else if (i === 2) p.z = c.z0 - RAIO; else p.z = c.z1 + RAIO;
      } else { const d = Math.sqrt(d2), k = (RAIO - d) / d; p.x += dx * k; p.z += dz * k; }
    }
  }
}

// ---------- entrada: teclado, joystick e câmera ----------
const teclas = new Set();
addEventListener('keydown', (e) => { teclas.add(e.code); });
addEventListener('keyup', (e) => { teclas.delete(e.code); });
addEventListener('blur', () => teclas.clear());
const joy = { x: 0, y: 0, id: null };
const joyEl = $('joy'), knob = $('knob');
function joyMover(e) {
  const r = joyEl.getBoundingClientRect(), R = r.width / 2;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`; joy.x = dx / R; joy.y = -dy / R;
}
joyEl.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMover(e); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) joyMover(e); });
const joyFim = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', joyFim); joyEl.addEventListener('pointercancel', joyFim);

const cam = { yaw: 0, pitch: 0.38, dist: 4.4 };
let arrasto = null;
$('cena').addEventListener('pointerdown', (e) => { sairZoom(); if (arrasto) return; arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY }; $('cena').setPointerCapture(e.pointerId); $('painel').classList.remove('on'); });
$('cena').addEventListener('pointermove', (e) => {
  if (!arrasto || e.pointerId !== arrasto.id) return;
  cam.yaw -= (e.clientX - arrasto.x) * 0.0055; cam.pitch = Math.max(0.05, Math.min(1.1, cam.pitch + (e.clientY - arrasto.y) * 0.004));
  arrasto.x = e.clientX; arrasto.y = e.clientY;
});
const fimArrasto = (e) => { if (arrasto && e.pointerId === arrasto.id) arrasto = null; };
$('cena').addEventListener('pointerup', fimArrasto); $('cena').addEventListener('pointercancel', fimArrasto);
$('cena').addEventListener('wheel', (e) => { cam.dist = Math.max(2.2, Math.min(7, cam.dist + e.deltaY * 0.004)); }, { passive: true });

// ---------- carregamento ----------
const loader = new GLTFLoader();
const progresso = [0, 0];
const barra = document.querySelector('#barra i');
const mostrarProgresso = (i, v) => { progresso[i] = v; barra.style.width = ((progresso[0] + progresso[1]) * 50) + '%'; };
const carregar = (nome, i) => loader.loadAsync(`./${nome}.glb`, (e) => { if (e.total) mostrarProgresso(i, e.loaded / e.total); });
const [gTerno, gMedica] = await Promise.all([carregar('gatinho_terno', 0), carregar('gatinha_doutora', 1)]);

const jogadores = [
  criarJogador(gTerno, 'Gatinho de terno', SPAWN.terno, { terno: true }),
  criarJogador(gMedica, 'Gatinha médica', SPAWN.medica),
];
const recep = criarRecepcionista(gTerno, cena, { x: 2.0, z: 7.0, yaw: Math.PI });
salao.colliders.push({ x0: 1.8, z0: 6.8, x1: 2.2, z1: 7.2 });      // funcionário da recepção (não jogável)
let ativo = 0;
const eu = () => jogadores[ativo];

// ---------- interface: trocar de gato, emoções e gestos ----------
const HUMORES = { normal: 'Normal', feliz: 'Feliz', falando: 'Falando', triste: 'Triste', chorando: 'Chorando', brava: 'Brava', irritada: 'Irritada', surpresa: 'Surpresa', apaixonada: 'Apaixonada', tonta: 'Tonta', sono: 'Com sono', dormindo: 'Dormindo', marota: 'Marota', envergonhada: 'Envergonhada' };
const GESTOS = { pular: 'Pular', pulinhos: 'Pulinhos', comemorar: 'Comemorar', dancar: 'Dançar', palmas: 'Palmas', espreguicar: 'Espreguiçar', marchar: 'Marchar', girar: 'Girar', reverencia: 'Reverência', pensar: 'Pensar', olhar: 'Olhar ao redor', espirro: 'Espirrar', susto: 'Susto', timida: 'Tímida', sacudir: 'Sacudir', balancar: 'Balançar', acenar: 'Acenar', beijo: 'Beijo' };
function fazerHumor(j, nome) { j.gato.humor(nome); }
function fazerGesto(j, nome) {
  if (nome === 'beijo' && j.terno) {      // o gatinho de terno tem uma boca de beijo extra
    j.gato.expressao('felizes', 'beijo', ['bochechas']);
    clearTimeout(j.tBeijo); j.tBeijo = setTimeout(() => j.gato.humor('normal'), 2300);
  }
  j.gato.acao(nome);
}
const botao = (txt, fn) => { const b = document.createElement('button'); b.textContent = txt; b.addEventListener('click', fn); return b; };
for (const [k, v] of Object.entries(HUMORES)) $('gradeHumores').append(botao(v, () => fazerHumor(eu(), k)));
for (const [k, v] of Object.entries(GESTOS)) $('gradeGestos').append(botao(v, () => fazerGesto(eu(), k)));
$('btnEmocoes').addEventListener('click', () => $('painel').classList.toggle('on'));
function atualizarNome() { $('nomeGato').textContent = eu().nome; }
$('trocar').addEventListener('click', () => { sairZoom(); eu().gato.parar(0.1); eu().andando = false; ativo = (ativo + 1) % jogadores.length; atualizarNome(); });
atualizarNome();
let cima = false;
$('btnCima').addEventListener('click', () => { cima = !cima; salao.esconderTeto(cima); $('btnCima').textContent = cima ? 'Voltar ao gato' : 'Ver de cima'; });

// ---------- sentar nos bancos, poltronas e sofá ----------
let assentoPerto = null;
function acharAssento(p) {
  let melhor = null, md = 1.25;
  for (const a of mobilia.assentos) {
    if (a.ocupado && a.ocupado !== p) continue;
    const d = Math.hypot(a.x - p.x, a.z - p.z); if (d < md) { md = d; melhor = a; }
  }
  return melhor;
}
function sentar(p, a) {
  if (p.assento || !a || (a.ocupado && a.ocupado !== p)) return;
  if (p.andando) { p.gato.parar(0.1); p.andando = false; }
  p.assento = a; a.ocupado = p; p.altSent = a.alt + 0.03 - p.hipAlt; p.gato.sentar(true, a.esticado); sairZoom();
}
function levantar(p) {
  const a = p.assento; if (!a) return;
  p.gato.sentar(false); p.assento = null; a.ocupado = null;
  p.x = a.x + Math.sin(a.yaw) * 0.6; p.z = a.z + Math.cos(a.yaw) * 0.6; empurrar(p);   // levanta para a frente do assento
}
function alternarSentar() { const p = eu(); if (p.assento) levantar(p); else sentar(p, acharAssento(p)); rotularQuadro(); }
$('btnSentar').addEventListener('click', alternarSentar);
addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat) alternarSentar(); });

// ---------- fotos nos quadros ----------
let quadroAtual = null, tAviso = 0;
function aviso(txt) { $('aviso').textContent = txt; $('aviso').classList.add('on'); clearTimeout(tAviso); tAviso = setTimeout(() => $('aviso').classList.remove('on'), 3500); }
function rotularQuadro() {
  const q = quadroAtual; const sent = !!eu().assento;
  $('quadroUI').hidden = !(q || sent || assentoPerto);
  $('btnSentar').hidden = !(sent || assentoPerto); $('btnSentar').textContent = sent ? 'Levantar' : 'Sentar';
  for (const id of ['btnPerto', 'btnFoto']) $(id).hidden = !q;
  $('notaFoto').hidden = !q;
  if (!q) { $('btnRemover').hidden = true; return; }
  $('btnFoto').textContent = q.temFoto ? 'Trocar foto' : 'Adicionar foto'; $('btnRemover').hidden = !q.temFoto;
}
function atualizarQuadro() {
  const q = zoomQ || (cima ? null : quadros.perto(eu().x, eu().z, eu().yaw));
  const a = eu().assento ? null : acharAssento(eu());
  if (q !== quadroAtual || a !== assentoPerto) { quadroAtual = q; assentoPerto = a; quadros.realce(q); rotularQuadro(); }
}
// reduz a foto (lado maior 1600 px) e corrige a rotação do celular antes de guardar
async function prepararFoto(arquivo) {
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.88));
  return { tela: c, blob };
}
$('btnFoto').addEventListener('click', () => $('arqFoto').click());
addEventListener('keydown', (e) => { if (e.code === 'KeyF' && quadroAtual && !e.repeat) $('arqFoto').click(); });
$('arqFoto').addEventListener('change', async (e) => {
  const arquivo = e.target.files[0]; e.target.value = ''; const q = quadroAtual;
  if (!arquivo || !q) return;
  try {
    const { tela, blob } = await prepararFoto(arquivo);
    quadros.colocarFoto(q, tela); rotularQuadro();
    try { await armazem.salvar(q.id, blob); } catch { aviso('A foto aparece, mas não deu para guardar neste aparelho.'); }
  } catch { aviso('Não consegui abrir essa imagem.'); }
});
$('btnRemover').addEventListener('click', async () => {
  const q = quadroAtual; if (!q) return;
  quadros.limparFoto(q); rotularQuadro();
  try { await armazem.apagar(q.id); } catch { /* sem problema: só não estava guardada */ }
});
(async () => {       // recoloca as fotos guardadas neste aparelho
  try {
    for (const { id, blob } of await armazem.todas()) { const q = quadros.porId(id); if (q) quadros.colocarFoto(q, await createImageBitmap(blob)); }
    rotularQuadro();
  } catch (erro) { console.warn('fotos guardadas indisponíveis', erro); }
})();

// ---------- ver de perto (zoom suave no quadro) ----------
let zoomQ = null, ultimoZoom = null, zoomK = 0;
const olhar = new THREE.Vector3(), vPos = new THREE.Vector3(), vC = new THREE.Vector3(), vN = new THREE.Vector3();
function visadaQuadro(q) {      // onde a câmera fica e quanto de zoom usar para a foto aparecer bem
  const c = quadros.centro(q); vC.set(c.x, c.y, c.z);
  let D = 2.0; raio.set(vC, vN.set(q.nx, 0, q.nz)); raio.far = D + 0.3;
  const h = raio.intersectObjects(salao.paredes.children, true)[0]; if (h) D = Math.max(1.2, h.distance - 0.3);
  vPos.set(c.x + q.nx * D, c.y + 0.05, c.z + q.nz * D);
  const alturaVista = Math.max((q.H + 0.14) / 0.8, ((q.W + 0.14) / 0.88) / camera.aspect);
  return { c: vC, pos: vPos, fov: Math.min(75, Math.max(28, 2 * Math.atan(alturaVista / 2 / D) * 180 / Math.PI)) };
}
let histZoom = [];      // quadros já vistos nesta "visita de perto" (para o botão de voltar)
function navUI() { $('qAnt').hidden = !(zoomQ && histZoom.length); $('qProx').hidden = !zoomQ; }
function sairZoom() { if (!zoomQ) return; zoomQ = null; histZoom = []; $('btnPerto').textContent = 'Ver de perto'; navUI(); }
function proximoQuadro(q) {      // o quadro mais perto deste que dá para ver sem parede no meio e ainda não visitado
  const v = visadaQuadro(q), origem = v.pos.clone(), cq = quadros.centro(q), alvoC = new THREE.Vector3(), d = new THREE.Vector3();
  const pontua = (livre) => {
    let melhor = null, md = 1e9;
    for (const o of quadros.lista) {
      if (o === q || (!livre && histZoom.includes(o))) continue;
      const c = quadros.centro(o); alvoC.set(c.x, c.y, c.z);
      if (o.nx * (origem.x - c.x) + o.nz * (origem.z - c.z) <= 0) continue;      // está de costas
      const dist = Math.hypot(c.x - cq.x, (c.y - cq.y) * 0.6, c.z - cq.z);
      if (dist >= md) continue;
      d.copy(alvoC).sub(origem); const L = d.length(); raio.set(origem, d.normalize()); raio.far = L - 0.1;
      if (raio.intersectObjects(salao.paredes.children, true).length) continue;   // parede no caminho
      md = dist; melhor = o;
    }
    return melhor;
  };
  return pontua(false) || pontua(true);
}
$('qProx').addEventListener('click', () => { const o = zoomQ && proximoQuadro(zoomQ); if (!o) return; histZoom.push(zoomQ); zoomQ = ultimoZoom = o; navUI(); });
$('qAnt').addEventListener('click', () => { if (!zoomQ || !histZoom.length) return; zoomQ = ultimoZoom = histZoom.pop(); navUI(); });
$('btnPerto').addEventListener('click', () => {
  if (zoomQ) sairZoom(); else if (quadroAtual) { zoomQ = ultimoZoom = quadroAtual; histZoom = []; $('btnPerto').textContent = 'Voltar'; navUI(); }
});

// ---------- laço do jogo ----------
const relogio = new THREE.Clock();
const alvo = new THREE.Vector3(), desejada = new THREE.Vector3(), dir = new THREE.Vector3();
const raio = new THREE.Raycaster();
let zonaAtual = null, tZona = 0;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function acomodar(p, dt) {       // desliza até o assento e se vira para a frente dele
  const k = 1 - Math.exp(-9 * dt), a = p.assento;
  p.x += (a.x - p.x) * k; p.z += (a.z - p.z) * k; p.yaw += angDiff(p.yaw, a.yaw) * k;
  p.grupo.position.set(p.x, 0, p.z); p.grupo.rotation.y = p.yaw;
}
function mover(p, dt) {
  let ix = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0) - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0) + joy.x;
  let iy = (teclas.has('KeyW') || teclas.has('ArrowUp') ? 1 : 0) - (teclas.has('KeyS') || teclas.has('ArrowDown') ? 1 : 0) + joy.y;
  const m = Math.min(1, Math.hypot(ix, iy));
  if (p.assento) {
    if (m > 0.12) { levantar(p); rotularQuadro(); }
    else {            // desliza até o assento e se vira para a frente dele
      acomodar(p, dt); return;
    }
  }
  if (m > 0.12) {
    sairZoom();
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let dx = fx * iy + rx * ix, dz = fz * iy + rz * ix; const n = Math.hypot(dx, dz); dx /= n; dz /= n;
    p.x += dx * VELOCIDADE * m * dt; p.z += dz * VELOCIDADE * m * dt;
    p.yaw += angDiff(p.yaw, Math.atan2(dx, dz)) * Math.min(1, 12 * dt);
    if (!p.andando) { p.gato.acao('andar'); p.andando = true; }
  } else if (p.andando) { p.gato.parar(0.25); p.andando = false; }
  empurrar(p);
  for (const o of jogadores) {          // não atravessa o outro gato
    if (o === p) continue;
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = RAIO * 2;
    if (d < min && d > 1e-4) { p.x += (dx / d) * (min - d); p.z += (dz / d) * (min - d); }
  }
  empurrar(p);
  p.grupo.position.set(p.x, 0, p.z); p.grupo.rotation.y = p.yaw;
}

function atualizarCamera(dt) {
  if (cima) {
    camera.position.lerp(desejada.set(0, 27, 7), 1 - Math.exp(-6 * dt)); camera.lookAt(0, 0, 0.5); camera.fov = 50; camera.updateProjectionMatrix(); return;
  }
  const p = eu(); alvo.set(p.x, ALTURA_GATO * 0.72 - 0.3 * p.gato.nivelSentado(), p.z);
  const poeDir = (pitch) => dir.set(Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(cam.yaw) * Math.cos(pitch));
  poeDir(cam.pitch);
  let d = cam.dist;
  raio.set(alvo, dir); raio.far = d + 0.4;
  const hit = raio.intersectObjects(salao.paredes.children, true)[0];
  if (hit) {      // parede atrás da câmera: aproxima e sobe, olhando o gato de cima
    d = Math.max(1.7, hit.distance - 0.3);
    poeDir(Math.min(1.2, cam.pitch + (1 - d / cam.dist) * 0.55));
  }
  desejada.copy(alvo).addScaledVector(dir, d);
  // zoom suave sobre o quadro ("Ver de perto")
  zoomK += ((zoomQ ? 1 : 0) - zoomK) * (1 - Math.exp(-5 * dt));
  if (zoomK < 0.002) zoomK = 0;
  olhar.copy(alvo); let fov = 55;
  if (zoomK > 0) {
    const v = visadaQuadro(zoomQ || ultimoZoom), k = zoomK * zoomK * (3 - 2 * zoomK);
    desejada.lerp(v.pos, k); olhar.lerp(v.c, k); fov = 55 + (v.fov - 55) * k;
  }
  jogadores.forEach((j) => { j.grupo.visible = true; });
  if (zoomK > 0.6) p.grupo.visible = false;          // o gato some enquanto você olha a foto de perto
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.position.lerp(desejada, 1 - Math.exp(-14 * dt)); camera.lookAt(olhar);
}

function atualizarZona(dt) {
  const p = eu(); const z = ZONAS.find((q) => p.x >= q.x0 && p.x <= q.x1 && p.z >= q.z0 && p.z <= q.z1);
  if (z && z.id !== zonaAtual) { zonaAtual = z.id; $('zona').textContent = z.nome; $('zona').classList.add('on'); tZona = 2.6; }
  if (tZona > 0 && (tZona -= dt) <= 0) $('zona').classList.remove('on');
}

function passo(dt) {
  dt = Math.min(dt, 0.1);
  mover(eu(), dt);
  recep.atualizar(dt, jogadores);
  for (const j of jogadores) if (j !== eu() && j.assento) acomodar(j, dt);
  for (const j of jogadores) { j.gato.atualizar(dt); j.grupo.position.y = j.altSent * j.gato.nivelSentado(); }
  atualizarCamera(dt); atualizarZona(dt); atualizarQuadro();
}
renderer.setAnimationLoop(() => { passo(relogio.getDelta()); renderer.render(cena, camera); });

// posição inicial da câmera atrás do gato
{ const p = eu(); cam.yaw = p.yaw - Math.PI; camera.position.set(p.x + Math.sin(cam.yaw) * 4, 2.4, p.z + Math.cos(cam.yaw) * 4); }
$('carregando').classList.add('fim');

// gancho para testes automáticos
window.museu = {
  jogadores, cam, salao, mobilia, recep, sentar: (i = ativo) => { const p = jogadores[i]; sentar(p, acharAssento(p)); rotularQuadro(); }, levantar: (i = ativo) => { levantar(jogadores[i]); rotularQuadro(); }, THREE, camera, quadros, quadroAtual: () => quadroAtual,
  ativo: () => ativo,
  colocar(x, z, yaw) { const p = eu(); p.x = x; p.z = z; if (yaw != null) p.yaw = yaw; p.grupo.position.set(x, 0, z); p.grupo.rotation.y = p.yaw; camera.position.set(x + Math.sin(cam.yaw) * cam.dist, 2.4, z + Math.cos(cam.yaw) * cam.dist); },
  cima(on) { if (on !== cima) $('btnCima').click(); },
  humor: (n) => fazerHumor(eu(), n), gesto: (n) => fazerGesto(eu(), n), trocar: () => $('trocar').click(),
  tick(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) passo(dt); },
  pausar() { renderer.setAnimationLoop(null); },
  png() { renderer.render(cena, camera); return renderer.domElement.toDataURL('image/png'); },
};
