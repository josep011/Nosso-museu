// Nosso Museu — jogo: cena, gatos, controles, colisões e câmera.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { criarGato } from './gato.js';
import { construirSalao, ZONAS, SPAWN } from './salao.js';

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
  return { nome, gato, grupo, x: spawn.x, z: spawn.z, yaw: spawn.yaw, andando: false, esc, ...extra };
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
$('cena').addEventListener('pointerdown', (e) => { if (arrasto) return; arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY }; $('cena').setPointerCapture(e.pointerId); $('painel').classList.remove('on'); });
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
$('trocar').addEventListener('click', () => { eu().gato.parar(0.1); eu().andando = false; ativo = (ativo + 1) % jogadores.length; atualizarNome(); });
atualizarNome();
let cima = false;
$('btnCima').addEventListener('click', () => { cima = !cima; salao.esconderTeto(cima); $('btnCima').textContent = cima ? 'Voltar ao gato' : 'Ver de cima'; });

// ---------- laço do jogo ----------
const relogio = new THREE.Clock();
const alvo = new THREE.Vector3(), desejada = new THREE.Vector3(), dir = new THREE.Vector3();
const raio = new THREE.Raycaster();
let zonaAtual = null, tZona = 0;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function mover(p, dt) {
  let ix = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0) - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0) + joy.x;
  let iy = (teclas.has('KeyW') || teclas.has('ArrowUp') ? 1 : 0) - (teclas.has('KeyS') || teclas.has('ArrowDown') ? 1 : 0) + joy.y;
  const m = Math.min(1, Math.hypot(ix, iy));
  if (m > 0.12) {
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
  const p = eu(); alvo.set(p.x, ALTURA_GATO * 0.72, p.z);
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
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
  camera.position.lerp(desejada, 1 - Math.exp(-14 * dt)); camera.lookAt(alvo);
}

function atualizarZona(dt) {
  const p = eu(); const z = ZONAS.find((q) => p.x >= q.x0 && p.x <= q.x1 && p.z >= q.z0 && p.z <= q.z1);
  if (z && z.id !== zonaAtual) { zonaAtual = z.id; $('zona').textContent = z.nome; $('zona').classList.add('on'); tZona = 2.6; }
  if (tZona > 0 && (tZona -= dt) <= 0) $('zona').classList.remove('on');
}

function passo(dt) {
  dt = Math.min(dt, 0.1);
  mover(eu(), dt);
  for (const j of jogadores) j.gato.atualizar(dt);
  atualizarCamera(dt); atualizarZona(dt);
}
renderer.setAnimationLoop(() => { passo(relogio.getDelta()); renderer.render(cena, camera); });

// posição inicial da câmera atrás do gato
{ const p = eu(); cam.yaw = p.yaw - Math.PI; camera.position.set(p.x + Math.sin(cam.yaw) * 4, 2.4, p.z + Math.cos(cam.yaw) * 4); }
$('carregando').classList.add('fim');

// gancho para testes automáticos
window.museu = {
  jogadores, cam, salao, THREE, camera,
  ativo: () => ativo,
  colocar(x, z, yaw) { const p = eu(); p.x = x; p.z = z; if (yaw != null) p.yaw = yaw; p.grupo.position.set(x, 0, z); p.grupo.rotation.y = p.yaw; camera.position.set(x + Math.sin(cam.yaw) * cam.dist, 2.4, z + Math.cos(cam.yaw) * cam.dist); },
  cima(on) { if (on !== cima) $('btnCima').click(); },
  humor: (n) => fazerHumor(eu(), n), gesto: (n) => fazerGesto(eu(), n), trocar: () => $('trocar').click(),
  tick(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) passo(dt); },
  pausar() { renderer.setAnimationLoop(null); },
  png() { renderer.render(cena, camera); return renderer.domElement.toDataURL('image/png'); },
};
