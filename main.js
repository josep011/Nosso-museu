// Nosso Museu — jogo: cena, gatos, controles, colisões e câmera.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { criarGato } from './gato.js?v=202610220905';
import { construirSalao, ZONAS, SPAWN, SALAO } from './salao.js?v=202610220905';
import { criarOnline, codigoValido } from './online.js?v=202610220905';
import { criarTocador, criarVitrola, MUSICAS } from './musica.js?v=202610220905';
import { criarMural, MURAL } from './mural.js?v=202610220905';
import { criarBuque, criarArranjo, criarVaso } from './buque.js?v=202610220905';
import { criarQuadros } from './quadros.js?v=202610220905';
import { construirMobilia } from './mobilia.js?v=202610220905';
import { construirDecoracao } from './decoracao.js?v=202610220905';
import { criarRecepcionista } from './recepcionista.js?v=202610220905';
import * as armazem from './armazem.js?v=202610220905';

const ALTURA_GATO = 1.3;      // altura do gato no jogo, em metros
const RAIO = 0.38;            // "tamanho" do gato para colisões
const VELOCIDADE = 2.4;       // m/s
const $ = (id) => document.getElementById(id);

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('cena'), antialias: true, powerPreference: 'default' });
// ---------- leveza: nitidez que se ajusta ao aparelho, sombras calculadas só quando a luz muda ----------
const CELULAR = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
// Modo "leve" (padrão no celular): 30 quadros/s, menos pixels e sombra mais simples. "Bonito": o máximo.
const lerModo = () => { try { return localStorage.getItem('museu-modo'); } catch { return null; } };
let modoLeve = (lerModo() || (CELULAR ? 'leve' : 'bonito')) === 'leve';
const nitidezMax = () => Math.min(window.devicePixelRatio || 1, modoLeve ? 1.15 : (CELULAR ? 1.5 : 2));
let nitidez = nitidezMax();
renderer.setPixelRatio(nitidez);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = 'NeutralToneMapping' in THREE ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = modoLeve ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;     // o salão não se mexe: sombra recalculada só quando o sol muda
const cena = new THREE.Scene(); cena.background = new THREE.Color(0xcfd8dc);
const gerarAmbiente = () => { const g = new THREE.PMREMGenerator(renderer); const t = g.fromScene(new RoomEnvironment(), 0.04).texture; g.dispose(); return t; };
cena.environment = gerarAmbiente(); cena.environmentIntensity = 0.35;
// Quando o celular tira o jogo da memória de vídeo (ex.: ao minimizar o navegador), refazemos tudo ao voltar:
// texturas, luz de ambiente e sombras. Sem isso, o chão e o rosto do recepcionista ficavam pretos e tudo escuro.
const TEXTURAS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'lightMap', 'bumpMap'];
function refazerGPU() {
  const antiga = cena.environment; cena.environment = gerarAmbiente(); antiga?.dispose?.();
  cena.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) { for (const k of TEXTURAS) if (m[k]) m[k].needsUpdate = true; m.needsUpdate = true; }
  });
  renderer.shadowMap.needsUpdate = true;
}
renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);     // deixa o navegador devolver a memória de vídeo
renderer.domElement.addEventListener('webglcontextrestored', () => refazerGPU(), false);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderer.shadowMap.needsUpdate = true; });
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
const salao = construirSalao(cena);
const quadros = criarQuadros(cena);
const mobilia = construirMobilia(cena, salao);
construirDecoracao(cena, salao);
const vitrola = criarVitrola(cena, salao, { x: 10.75, z: -6.0, yaw: -Math.PI / 2 });     // no café, embaixo do quadro
let mural = null;     // criado depois dos gatos (precisa saber quem você é)

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
  gato.modelo.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });     // a sombra dos gatos é a sombrinha suave no chão
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
mural = criarMural(cena, salao, {
  quem: () => jogadores[ativo].nome, aviso: (t) => aviso(t),
  aoMudar: (meta, blob, removido) => {          // mudou algo no mural: vai para o outro celular (se compartilhando)
    if (!compartilhando()) return;
    if (removido) online.removerFoto(meta.id, meta.em);
    else { online.avisoFotos({ t: 'mi', item: meta }); if (blob) online.enviarFoto(meta.id, blob, meta.em); }
  },
});
$('btnMural').addEventListener('click', () => { sairZoom(); mural.abrir(); });
const eu = () => jogadores[ativo];

// ---------- interface: emoções e gestos ----------
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
for (const [k, v] of Object.entries(HUMORES)) $('gradeHumores').append(botao(v, () => { fazerHumor(eu(), k); online.enviar({ t: 'h', n: k }); }));
for (const [k, v] of Object.entries(GESTOS)) $('gradeGestos').append(botao(v, () => { fazerGesto(eu(), k); online.enviar({ t: 'g', n: k }); }));
$('btnEmocoes').addEventListener('click', () => { $('casalPainel').classList.remove('on'); $('painel').classList.toggle('on'); });
function atualizarNome() { $('nomeGato').textContent = eu().nome; }
atualizarNome();
let cima = false;
$('btnCima').addEventListener('click', () => { cima = !cima; salao.esconderTeto(cima); $('btnCima').textContent = cima ? 'Voltar ao gato' : 'Ver de cima'; });

// ---------- sentar nos bancos, poltronas e sofá ----------
let assentoPerto = null, vitrolaPerto = false, muralPerto = false;
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
  p.assento = a; a.ocupado = p; p.altSent = a.alt + 0.03 - p.hipAlt; p.gato.sentar(true, a.esticado); if (p === eu()) sairZoom();
}
function levantar(p) {
  const a = p.assento; if (!a) return;
  p.gato.sentar(false); p.assento = null; a.ocupado = null;
  p.x = a.x + Math.sin(a.yaw) * 0.6; p.z = a.z + Math.cos(a.yaw) * 0.6; empurrar(p);   // levanta para a frente do assento
}
function alternarSentar() { if (casal || maos) return; const p = eu(); if (p.assento) levantar(p); else sentar(p, acharAssento(p)); rotularQuadro(); }
$('btnSentar').addEventListener('click', alternarSentar);
addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat) alternarSentar(); });

// ---------- fotos nos quadros ----------
let quadroAtual = null, tAviso = 0;
// fotos do museu: ficam guardadas só nos celulares de vocês. No online, os dois colocam/trocam/removem
// e a mudança vai direto para o outro celular (a mais nova vence). Nunca vão para o GitHub.
const fotosLocais = new Set(), versao = new Map();          // versao: id -> hora da última mudança (inclui remoções)
const lerOpcao = () => { try { return localStorage.getItem('museu-mostrar-fotos') !== 'nao'; } catch { return true; } };
const compartilhando = () => online.conectado() && $('chkFotos').checked;
async function enviarLista() {               // "estas são as fotos que eu tenho (e quando mudaram)"
  if (!compartilhando()) return;
  try { const itens = (await armazem.todas()).map((r) => ({ id: r.id, em: r.em || 1, a: r.apagado ? 1 : 0 })); online.avisoFotos({ t: 'fm', itens: itens.slice(0, 300) }); } catch { /* sem fotos */ }
}
async function avisoDeFotos(m) {             // lista do outro: pede o que for mais novo lá; aplica remoções mais novas
  if (!$('chkFotos').checked) return;
  if (m.t === 'mi') { if (m.item && mural.aplicarRemoto(m.item)) online.avisoFotos({ t: 'fq', id: m.item.id }); return; }   // item do mural
  if (m.t === 'fq' && typeof m.id === 'string' && m.id.startsWith('mural-')) {
    const p = mural.pegar(m.id); if (p) { online.avisoFotos({ t: 'mi', item: p.meta }); if (p.blob) online.enviarFoto(m.id, p.blob, p.meta.em); }
    return;
  }
  if (m.t === 'fq' && typeof m.id === 'string' && fotosLocais.has(m.id)) {
    try { const r = await armazem.uma(m.id); if (r && r.blob) online.enviarFoto(r.id, r.blob, r.em || 1); } catch { /* ok */ }
    return;
  }
  if (m.t !== 'fm' || !Array.isArray(m.itens)) return;
  for (const it of m.itens.slice(0, 300)) {
    if (it && typeof it.id === 'string' && it.id.startsWith('mural-') && Number.isFinite(it.em)) {
      if (it.em > mural.versao(it.id)) { if (it.a === 1) mural.removerRemoto(it.id, it.em); else online.avisoFotos({ t: 'fq', id: it.id }); }
      continue;
    }
    if (!it || typeof it.id !== 'string' || !quadros.porId(it.id) || !Number.isFinite(it.em)) continue;
    if (it.em <= (versao.get(it.id) || 0)) continue;
    if (it.a === 1) aplicarRemocao(it.id, it.em); else online.avisoFotos({ t: 'fq', id: it.id });
  }
}
async function receberFoto(id, blob, em) {   // foto (ou remoção) vinda do outro celular: conferida antes de aparecer
  if (id.startsWith('mural-')) { if (!$('chkFotos').checked) return; if (blob) mural.receberImagem(id, blob); else mural.removerRemoto(id, em); return; }
  const q = quadros.porId(id); if (!q || !$('chkFotos').checked || !Number.isFinite(em) || em <= (versao.get(id) || 0)) return;
  if (!blob) { aplicarRemocao(id, em); return; }
  if (blob.size > 4 * 1024 * 1024) return;
  let bmp; try { bmp = await createImageBitmap(blob); } catch { return; }
  if (bmp.width > 4096 || bmp.height > 4096) { bmp.close?.(); return; }
  quadros.colocarFoto(q, bmp); fotosLocais.add(id); versao.set(id, em); rotularQuadro();
  try { await armazem.salvar(id, blob, em); } catch { /* aparece, mas não guardou */ }
}
function aplicarRemocao(id, em) {
  const q = quadros.porId(id); if (!q) return;
  quadros.limparFoto(q); fotosLocais.delete(id); versao.set(id, em); rotularQuadro();
  armazem.apagar(id, em).catch(() => {});
}
function aviso(txt) { $('aviso').textContent = txt; $('aviso').classList.add('on'); clearTimeout(tAviso); tAviso = setTimeout(() => $('aviso').classList.remove('on'), 3500); }
function rotularQuadro() {
  const q = quadroAtual; const sent = !!eu().assento;
  $('quadroUI').hidden = !(q || sent || assentoPerto || vitrolaPerto || muralPerto);
  $('btnVitrola').hidden = !vitrolaPerto; $('btnMural').hidden = !muralPerto;
  $('btnSentar').hidden = !(sent || assentoPerto); $('btnSentar').textContent = sent ? 'Levantar' : 'Sentar';
  for (const id of ['btnPerto', 'btnFoto']) $(id).hidden = !q;
  $('notaFoto').hidden = !q;
  if (!q) { $('btnRemover').hidden = true; return; }
  const tem = fotosLocais.has(q.id);
  $('btnFoto').textContent = tem ? 'Trocar foto' : 'Adicionar foto'; $('btnRemover').hidden = !tem;
  $('notaFoto').textContent = online.conectado() && $('chkFotos').checked ? 'Fica guardada nos celulares de vocês dois (nunca no GitHub).' : 'A foto fica guardada neste aparelho (nunca no GitHub).';
}
function atualizarQuadro() {
  const q = zoomQ || (cima ? null : quadros.perto(eu().x, eu().z, eu().yaw));
  const a = eu().assento ? null : acharAssento(eu());
  const v = !cima && Math.hypot(eu().x - vitrola.x, eu().z - vitrola.z) < 1.7;
  if (v !== vitrolaPerto) { vitrolaPerto = v; rotularQuadro(); }
  const mu = !cima && Math.abs(eu().x - MURAL.x) < 2.3 && eu().z > 4.0 && eu().z < 8;
  if (mu !== muralPerto) { muralPerto = mu; rotularQuadro(); }
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
    const em = Date.now(); quadros.colocarFoto(q, tela); fotosLocais.add(q.id); versao.set(q.id, em); rotularQuadro();
    if (compartilhando()) online.enviarFoto(q.id, blob, em);
    try { await armazem.salvar(q.id, blob, em); } catch { aviso('A foto aparece, mas não deu para guardar neste aparelho.'); }
  } catch { aviso('Não consegui abrir essa imagem.'); }
});
$('btnRemover').addEventListener('click', async () => {
  const q = quadroAtual; if (!q) return;
  const em = Date.now(); fotosLocais.delete(q.id); versao.set(q.id, em); quadros.limparFoto(q); rotularQuadro();
  if (compartilhando()) online.removerFoto(q.id, em);
  try { await armazem.apagar(q.id, em); } catch { /* sem problema: só não estava guardada */ }
});
(async () => {       // recoloca as fotos guardadas neste aparelho
  try {
    for (const r of await armazem.todas()) {
      versao.set(r.id, r.em || 1); const q = quadros.porId(r.id);
      if (q && r.blob && !r.apagado) { quadros.colocarFoto(q, await createImageBitmap(r.blob)); fotosLocais.add(r.id); }
    }
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

// ---------- carinhos de casal: beijo, abraço e carinho ----------
// A animação muda conforme QUEM começa: o gatinho de terno (jeito firme e carinhoso) ou a gatinha (jeito fofo).
const CASAL = { beijo: { dist: 0.66 }, abraco: { dist: 0.6 }, carinho: { dist: 0.68 } };
let casal = null;
const outro = () => jogadores[(ativo + 1) % jogadores.length];
const estilo = (j) => (j.terno ? 'ele' : 'ela');
function podeCasal() { const a = eu(), b = outro(); return !casal && !maos && !cima && !a.assento && !b.assento && Math.hypot(a.x - b.x, a.z - b.z) < 2.2; }
function rostoCasal(j, papel, tipo) {     // papel: 'faz' ou 'recebe'
  const beijoBoca = j.gato.tem('boca_beijo') ? 'beijo' : 'sorriso';
  if (tipo === 'beijo') { if (papel === 'faz') j.gato.expressao('felizes', beijoBoca, ['bochechas']); else j.gato.expressao('piscando', 'sorriso', ['bochechas']); }
  else if (tipo === 'abraco') j.gato.expressao('felizes', j.terno ? 'sorriso' : 'aberta', ['bochechas']);
  else if (papel === 'faz') j.gato.expressao(j.terno ? 'abertos' : 'felizes', 'sorriso', ['bochechas']);
  else j.gato.expressao('felizes', j.terno ? 'sorriso' : 'aberta', ['bochechas']);
}
function iniciarCasal(tipo, remoto = false) {      // remoto = começou no celular do outro
  if (!CASAL[tipo]) return;
  if (remoto) { if (casal) return; for (const j of jogadores) if (j.assento) levantar(j); }
  else { if (!podeCasal()) return; online.enviar({ t: 'c', n: tipo }); }
  const a = remoto ? outro() : eu(), b = remoto ? eu() : outro(); sairZoom(); $('casalPainel').classList.remove('on');
  for (const j of [a, b]) { j.gato.parar(0.1); j.andando = false; clearTimeout(j.tBeijo); clearTimeout(j.tHumor); }
  let dx = b.x - a.x, dz = b.z - a.z; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, h = CASAL[tipo].dist / 2;
  casal = { tipo, a, b, t: 0, fase: 'chegar', dx, dz,
    pa: { x: mx - dx * h, z: mz - dz * h, yaw: Math.atan2(dx, dz) }, pb: { x: mx + dx * h, z: mz + dz * h, yaw: Math.atan2(-dx, -dz) } };
  a.gato.acao('andar'); b.gato.acao('andar');
}
function atualizarCasal(dt) {
  const c = casal; if (!c) return; c.t += dt;
  const k = 1 - Math.exp(-7 * dt);
  const levar = (j, alvo) => { j.x += (alvo.x - j.x) * k; j.z += (alvo.z - j.z) * k; j.yaw += angDiff(j.yaw, alvo.yaw) * k; j.grupo.position.set(j.x, 0, j.z); j.grupo.rotation.y = j.yaw; };
  levar(c.a, c.pa); levar(c.b, c.pb);
  if (c.fase === 'chegar' && c.t > 0.55) {
    c.fase = 'agir'; c.t = 0;
    c.dur = Math.max(c.a.gato.acao(`${c.tipo}_${estilo(c.a)}`), c.b.gato.acao(`receber_${c.tipo}_${estilo(c.b)}`));
    rostoCasal(c.a, 'faz', c.tipo); rostoCasal(c.b, 'recebe', c.tipo);
  } else if (c.fase === 'agir') {
    if ((c.coracao = (c.coracao || 0) - dt) <= 0) { c.coracao = 0.32; soltarCoracao((c.a.x + c.b.x) / 2, (c.a.z + c.b.z) / 2); }
    if (c.t >= c.dur) {          // termina: dão um passinho para trás, apaixonados
      c.fase = 'sair'; c.t = 0; const h = 0.42;
      c.pa = { ...c.pa, x: c.pa.x - c.dx * 0.17, z: c.pa.z - c.dz * 0.17 }; c.pb = { ...c.pb, x: c.pb.x + c.dx * 0.17, z: c.pb.z + c.dz * 0.17 }; void h;
      for (const j of [c.a, c.b]) { j.gato.humor('apaixonada'); j.tHumor = setTimeout(() => j.gato.humor('normal'), 2600); }
    }
  } else if (c.fase === 'sair' && c.t > 0.5) casal = null;
}
// ele levanta a gatinha um pouquinho no abraço
function alturaCasal(j) {
  const c = casal; if (!c || c.fase !== 'agir' || c.tipo !== 'abraco' || !c.a.terno || j !== c.b) return 0;
  const p = c.t / c.dur; return 0.07 * Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.3) / 0.5)));
}
// coraçõezinhos que sobem e somem
const texCoracao = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = '#ff7aa2'; g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(2, 34, 8, 4, 32, 20); g.bezierCurveTo(56, 4, 62, 34, 32, 56); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const coracoes = [];
function soltarCoracao(x, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texCoracao, transparent: true, depthWrite: false }));
  s.position.set(x + (Math.random() - 0.5) * 0.4, 1.25 + Math.random() * 0.15, z + (Math.random() - 0.5) * 0.4); s.scale.setScalar(0.16);
  s.userData.v = 0; cena.add(s); coracoes.push(s);
}
function atualizarCoracoes(dt) {
  for (let i = coracoes.length - 1; i >= 0; i--) {
    const s = coracoes[i]; s.userData.v += dt; const v = s.userData.v;
    s.position.y += 0.45 * dt; s.position.x += Math.sin(v * 4 + i) * 0.1 * dt; s.material.opacity = Math.max(0, 1 - v / 1.7); s.scale.setScalar(0.16 + v * 0.05);
    if (v > 1.7) { cena.remove(s); s.material.dispose(); coracoes.splice(i, 1); }
  }
}
for (const [id, tipo] of [['btnBeijo', 'beijo'], ['btnAbraco', 'abraco'], ['btnCarinho', 'carinho']]) $(id).addEventListener('click', () => iniciarCasal(tipo));
$('btnCasal').addEventListener('click', () => { $('painel').classList.remove('on'); $('casalPainel').classList.toggle('on'); });
addEventListener('keydown', (e) => { if (e.repeat) return; const t = { KeyB: 'beijo', KeyH: 'abraco', KeyC: 'carinho' }[e.code]; if (t) iniciarCasal(t); });
let podiaCasal = null;
function atualizarBotaoCasal() { const p = podeCasal(); if (p !== podiaCasal) { podiaCasal = p; $('btnCasal').hidden = !p; if (!p) $('casalPainel').classList.remove('on'); } }

// ---------- música (vitrola) ----------
function rotularMusica() {
  $('nomeMusica').textContent = tocador.nome(); $('btnTocar').textContent = tocador.tocando() ? '❚❚' : '▶';
  $('btnTocar').setAttribute('aria-label', tocador.tocando() ? 'Pausar' : 'Tocar');
  const varias = MUSICAS.length > 1; $('btnAnterior').disabled = !varias; $('btnProxima').disabled = !varias;
}
const tocador = criarTocador('./', { origem: { x: vitrola.x, y: 0.85, z: vitrola.z }, aoMudar: () => rotularMusica() });
const avisarMusica = () => online.enviar({ t: 'mu', i: tocador.indice(), on: tocador.tocando() ? 1 : 0 });
$('btnVitrola').addEventListener('click', () => { $('musicaUI').hidden = false; });
$('btnFecharMusica').addEventListener('click', () => { $('musicaUI').hidden = true; });
$('btnTocar').addEventListener('click', () => { tocador.alternar(); avisarMusica(); });
$('btnProxima').addEventListener('click', () => { tocador.proxima(); avisarMusica(); });
$('btnAnterior').addEventListener('click', () => { tocador.anterior(); avisarMusica(); });
$('volMusica').addEventListener('input', (e) => tocador.volume(+e.target.value));
rotularMusica();
addEventListener('pointerdown', () => tocador.destravar(), { passive: true });     // celulares só liberam som depois de um toque
// som de ambiente: onde você está em relação à vitrola, e se tem parede no meio
const raioSom = new THREE.Raycaster(), vOuv = new THREE.Vector3(), vDir = new THREE.Vector3();
let paredeNoMeio = false, tParede = 0;
function atualizarSom(dt) {
  const p = eu(), ouv = { x: p.x, y: 1.0, z: p.z };
  if ((tParede -= dt) <= 0) {
    tParede = 0.3; vOuv.set(ouv.x, 1.0, ouv.z); vDir.set(vitrola.x - ouv.x, 0, vitrola.z - ouv.z); const d = vDir.length();
    if (d > 0.01) { raioSom.set(vOuv, vDir.normalize()); raioSom.far = d - 0.3; paredeNoMeio = raioSom.intersectObjects(salao.paredes.children, true).length > 0; }
  }
  camera.getWorldDirection(vDir);
  tocador.ouvir(ouv, { x: vDir.x, z: vDir.z }, paredeNoMeio);
  if (!$('musicaUI').hidden && Math.hypot(p.x - vitrola.x, p.z - vitrola.z) > 3.2) $('musicaUI').hidden = true;   // o painel é da vitrola
}

// ---------- o dia passa de verdade: a luz segue o horário do aparelho ----------
let horaFixa = null, tHora = 0;
function atualizarHora(dt) {
  if ((tHora -= dt) > 0) return; tHora = 15;
  const agora = new Date(); salao.horario(horaFixa ?? agora.getHours() + agora.getMinutes() / 60); renderer.shadowMap.needsUpdate = true;
}

// ---------- sentados juntinhos: pose de casal automática ----------
const ladoDe = (j, o) => { const dx = o.x - j.x, dz = o.z - j.z, v = dx * Math.cos(j.yaw) - dz * Math.sin(j.yaw); return v < 0 ? -1 : 1; };
function atualizarPosesCasal() {
  const [a, b] = jogadores;
  const juntos = a.assento && b.assento && a.assento.nome === b.assento.nome && Math.hypot(a.assento.x - b.assento.x, a.assento.z - b.assento.z) < 1.0
    && a.gato.nivelSentado() > 0.9 && b.gato.nivelSentado() > 0.9;
  for (const [j, o] of [[a, b], [b, a]]) {
    const chave = juntos ? `${j.terno ? 'abracoLado' : 'ombro'}${ladoDe(j, o)}` : '';
    if (chave === j.poseAtual) continue; j.poseAtual = chave;
    if (juntos) j.gato.poseCasal(j.terno ? 'abracoLado' : 'ombro', ladoDe(j, o)); else j.gato.poseCasal(null);
  }
}

// ---------- de mãos dadas (como no Sky): um pede, o outro aceita; quem pediu conduz ----------
let maos = null, pedidoEnviado = 0, avisouConduzido = false;
function podeMao() { const a = eu(), b = outro(); return !maos && !casal && !cima && Math.hypot(a.x - b.x, a.z - b.z) < 2.2; }
function iniciarMaos(lider, seguidor, ladoCombinado) {
  for (const j of [lider, seguidor]) { if (j.assento) levantar(j); j.gato.parar(0.1); j.andando = false; }
  const lado = ladoCombinado === 1 || ladoCombinado === -1 ? ladoCombinado : ladoDe(lider, seguidor);     // no online os dois celulares usam o mesmo lado
  maos = { lider, seguidor, lado }; pedidoEnviado = 0; avisouConduzido = false;
  lider.gato.segurarMao(lado); seguidor.gato.segurarMao(-lado);
  $('casalPainel').classList.remove('on'); $('pedidoUI').hidden = true; sairZoom(); rotularMaos();
  aviso(lider === eu() ? 'De mãos dadas! Você conduz.' : `De mãos dadas! ${lider.nome} está te conduzindo.`);
}
function terminarMaos(avisar = true) {
  if (!maos) return; const { lider, seguidor } = maos; maos = null;
  for (const j of [lider, seguidor]) { j.gato.segurarMao(0); if (j !== eu() && j.andando && !online.conectado()) { j.gato.parar(0.25); j.andando = false; } }
  if (seguidor.andando && seguidor === eu()) { seguidor.gato.parar(0.25); seguidor.andando = false; }
  rotularMaos(); if (avisar) aviso('Soltaram as mãos.');
}
function pedirMao() {
  if (!podeMao()) return;
  if (!online.conectado()) { iniciarMaos(eu(), outro()); return; }        // no mesmo aparelho não tem para quem pedir
  pedidoEnviado = performance.now(); online.enviar({ t: 'mp' }); $('casalPainel').classList.remove('on'); aviso('Pedido enviado… 💕');
}
function soltarMaos() { if (!maos) return; online.enviar({ t: 'ms' }); terminarMaos(); }
function rotularMaos() { $('btnSoltar').hidden = !maos; }
function atualizarMaos(dt) {
  if (!maos) return;
  const { lider: L, seguidor: F, lado } = maos, d = 0.6;
  const tx = L.x + Math.cos(L.yaw) * lado * d, tz = L.z - Math.sin(L.yaw) * lado * d;
  if (Math.hypot(tx - F.x, tz - F.z) > 1.4) { F.x = tx; F.z = tz; }
  const k = 1 - Math.exp(-12 * dt); F.x += (tx - F.x) * k; F.z += (tz - F.z) * k; F.yaw += angDiff(F.yaw, L.yaw) * k;
  empurrar(F); F.grupo.position.set(F.x, 0, F.z); F.grupo.rotation.y = F.yaw;
  if (L.andando && !F.andando) { F.gato.acao('andar'); F.andando = true; } else if (!L.andando && F.andando) { F.gato.parar(0.25); F.andando = false; }
}
$('btnMao').addEventListener('click', pedirMao);
$('btnSoltar').addEventListener('click', soltarMaos);
$('btnAceitarMao').addEventListener('click', () => { $('pedidoUI').hidden = true; if (!podeMao()) return; const l = ladoDe(outro(), eu()); online.enviar({ t: 'ma', l }); iniciarMaos(outro(), eu(), l); });
$('btnRecusarMao').addEventListener('click', () => { $('pedidoUI').hidden = true; online.enviar({ t: 'mr' }); });
addEventListener('keydown', (e) => { if (e.repeat || e.code !== 'KeyM') return; if (maos) soltarMaos(); else pedirMao(); });

// ---------- buquê: ele oferece, ela recebe, cheira, leva e coloca no vaso ----------
// estado compartilhado: b = 'nenhum' | 'oferecendo' | 'com_ela'; vaso = 1 quando há flores no vaso. Guardado no aparelho.
const VASO = { x: -8.3, y: 0.425, z: 4.82 };                       // na mesa de centro da sala de estar
const vasoObj = criarVaso(); vasoObj.position.set(VASO.x, VASO.y, VASO.z); cena.add(vasoObj);
const arranjo = criarArranjo(); arranjo.position.set(VASO.x, VASO.y, VASO.z); arranjo.scale.setScalar(1.15); cena.add(arranjo);
const buqueMao = criarBuque(); buqueMao.scale.setScalar(1.3); buqueMao.rotation.order = 'YXZ'; cena.add(buqueMao);
const ESTADOS_BQ = ['nenhum', 'oferecendo', 'com_ela'];
const BQ = (() => { try { const v = JSON.parse(localStorage.getItem('museu-buque') || 'null'); if (v && ESTADOS_BQ.includes(v.b) && (v.vaso === 0 || v.vaso === 1) && Number.isFinite(v.em)) return v; } catch { /* ok */ } return { b: 'nenhum', vaso: 0, em: 0 }; })();
const ele = () => jogadores[0], ela = () => jogadores[1];
let cheirando = 0, camBuque = 0, buqK = 0, tAutoReceber = 0;
const patas = jogadores.map((j) => [j.gato.modelo.getObjectByName('pata_esq'), j.gato.modelo.getObjectByName('pata_dir')]);
function salvarBQ() { try { localStorage.setItem('museu-buque', JSON.stringify(BQ)); } catch { /* ok */ } }
function mudarBQ(b, vaso, enviar = true) {
  const antes = BQ.b; BQ.b = b; BQ.vaso = vaso; BQ.em = Math.max(Date.now(), BQ.em + 1); salvarBQ(); aplicarBQ(antes);
  if (enviar) online.enviar({ t: 'bq', b, vaso, em: BQ.em });
}
function receberBQ(m) {
  if (!ESTADOS_BQ.includes(m.b) || (m.vaso !== 0 && m.vaso !== 1) || !Number.isFinite(m.em) || m.em <= BQ.em) return;
  const antes = BQ.b; BQ.b = m.b; BQ.vaso = m.vaso; BQ.em = m.em; salvarBQ(); aplicarBQ(antes);
}
function aplicarBQ(antes) {
  buqueMao.visible = BQ.b !== 'nenhum'; arranjo.visible = BQ.vaso === 1;
  ele().gato.segurarBuque(BQ.b === 'oferecendo' ? 'oferecer' : null);
  ela().gato.segurarBuque(BQ.b === 'com_ela' ? (cheirando > 0 ? 'cheirar' : 'segurar') : null);
  if (antes === 'oferecendo' && BQ.b === 'com_ela') {         // ela recebeu: carinha apaixonada e coraçõezinhos
    ela().gato.humor('apaixonada'); ele().gato.humor('feliz'); for (let i = 0; i < 6; i++) setTimeout(() => soltarCoracao(ela().x, ela().z), i * 180);
    clearTimeout(ela().tHumor); ela().tHumor = setTimeout(() => { ela().gato.humor('normal'); ele().gato.humor('normal'); }, 3500);
    if (eu() === ela()) aviso('Você recebeu um buquê 💐 Leve até o vaso da sala de estar quando quiser.');
  }
  if (antes === 'com_ela' && BQ.b === 'nenhum' && BQ.vaso === 1) { for (let i = 0; i < 5; i++) setTimeout(() => soltarCoracao(VASO.x, VASO.z), i * 200); }
  if (BQ.b !== 'com_ela') { cheirando = 0; camBuque = 0; }
  rotularBuque();
}
const pertoDeEla = () => Math.hypot(ele().x - ela().x, ele().z - ela().z) < 2.6;
const pertoDoVaso = () => Math.hypot(eu().x - VASO.x, eu().z - VASO.z) < 1.5;
function rotularBuque() {
  const souEle = eu() === ele(), souEla = eu() === ela();
  $('btnBuque').hidden = !(souEle && BQ.b === 'nenhum');
  $('btnGuardarBuque').hidden = !(souEle && BQ.b === 'oferecendo');
  $('btnReceber').hidden = !(souEla && BQ.b === 'oferecendo' && pertoDeEla());
  $('btnCheirar').hidden = !(souEla && BQ.b === 'com_ela');
  $('btnVaso').hidden = !(souEla && BQ.b === 'com_ela' && pertoDoVaso());
}
$('btnBuque').addEventListener('click', () => {
  if (eu() !== ele() || BQ.b !== 'nenhum') return;
  if (!pertoDeEla()) { aviso('Chegue pertinho dela para oferecer o buquê.'); return; }
  $('casalPainel').classList.remove('on'); mudarBQ('oferecendo', BQ.vaso);
  if (!online.conectado()) { clearTimeout(tAutoReceber); tAutoReceber = setTimeout(() => { if (BQ.b === 'oferecendo') mudarBQ('com_ela', BQ.vaso); }, 1600); }   // no mesmo aparelho, ela aceita sozinha
});
$('btnGuardarBuque').addEventListener('click', () => { if (BQ.b === 'oferecendo') mudarBQ('nenhum', BQ.vaso); });
$('btnReceber').addEventListener('click', () => { if (eu() === ela() && BQ.b === 'oferecendo') mudarBQ('com_ela', BQ.vaso); });
$('btnCheirar').addEventListener('click', () => {
  if (BQ.b !== 'com_ela') return; cheirando = 3.2; camBuque = 3.2; aplicarBQ(BQ.b);
  ela().gato.expressao('felizes', 'sorriso', ['bochechas']); for (let i = 0; i < 4; i++) setTimeout(() => soltarCoracao(ela().x, ela().z), i * 250);
});
$('btnVaso').addEventListener('click', () => { if (eu() === ela() && BQ.b === 'com_ela' && pertoDoVaso()) { mudarBQ('nenhum', 1); aviso('As flores estão no vaso 💐'); } });
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
function atualizarBuque(dt) {
  if (cheirando > 0 && (cheirando -= dt) <= 0) { cheirando = 0; aplicarBQ(BQ.b); ela().gato.humor('normal'); }
  if (camBuque > 0) camBuque -= dt;
  rotularBuque();
  if (!buqueMao.visible) return;
  const j = BQ.b === 'oferecendo' ? ele() : ela(), [pe, pd] = patas[jogadores.indexOf(j)];
  if (!pe || !pd) { buqueMao.position.set(j.x + Math.sin(j.yaw) * 0.25, 0.6 + j.grupo.position.y, j.z + Math.cos(j.yaw) * 0.25); return; }
  pe.getWorldPosition(vA); pd.getWorldPosition(vB); vA.add(vB).multiplyScalar(0.5);
  const frente = cheirando > 0 ? 0.13 : 0.03;          // ao cheirar, as flores ficam logo abaixo do nariz, na frente do rosto
  buqueMao.position.set(vA.x + Math.sin(j.yaw) * frente, vA.y + (cheirando > 0 ? -0.04 : 0.02), vA.z + Math.cos(j.yaw) * frente);
  buqueMao.rotation.set(BQ.b === 'oferecendo' ? 0.55 : (cheirando > 0 ? 0.6 : 0.12), j.yaw, 0);
}
aplicarBQ(null);

// ---------- online: cada um no seu celular ----------
let tPedido = 0, alvoRemoto = null, tEnvio = 0, eventosSeg = 0, tEventos = 0, tConectando = 0;
const num = (v, a, b) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : null);
const tem = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
function definirGatos(i) {
  if (i === ativo) return;
  sairZoom(); eu().gato.parar(0.1); eu().andando = false; ativo = i; atualizarNome();
  const p = eu(); cam.yaw = p.yaw - Math.PI; camera.position.set(p.x + Math.sin(cam.yaw) * 4, 2.4, p.z + Math.cos(cam.yaw) * 4);
}
function receber(m) {          // tudo que chega do outro celular é conferido antes de usar
  if (m.t === 'e') {
    const x = num(m.x, SALAO.x0, SALAO.x1), z = num(m.z, SALAO.z0, SALAO.z1), yaw = num(m.y, -50, 50);
    if (x == null || z == null || yaw == null) return;
    const s = typeof m.s === 'string' ? (mobilia.assentos.find((a) => a.id === m.s) || null) : null;
    alvoRemoto = { x, z, yaw, andando: m.a === 1, assento: s }; return;
  }
  if (++eventosSeg > 8) return;                       // no máximo 8 gestos/emoções por segundo
  if (m.t === 'h' && tem(HUMORES, m.n)) fazerHumor(outro(), m.n);
  else if (m.t === 'g' && tem(GESTOS, m.n)) fazerGesto(outro(), m.n);
  else if (m.t === 'c' && tem(CASAL, m.n)) iniciarCasal(m.n, true);
  else if (m.t === 'mp') { if (podeMao()) { $('pedidoTexto').textContent = `${outro().nome} quer te conduzir de mãos dadas.`; $('pedidoUI').hidden = false; clearTimeout(tPedido); tPedido = setTimeout(() => { $('pedidoUI').hidden = true; }, 15000); } else online.enviar({ t: 'mr' }); }
  else if (m.t === 'ma') { if (pedidoEnviado && performance.now() - pedidoEnviado < 20000 && podeMao()) iniciarMaos(eu(), outro(), m.l); }
  else if (m.t === 'mr') { if (pedidoEnviado) { pedidoEnviado = 0; aviso('Agora não 💕'); } }
  else if (m.t === 'ms') terminarMaos();
  else if (m.t === 'bq') receberBQ(m);
  else if (m.t === 'mu' && Number.isInteger(m.i) && m.i >= 0 && m.i < MUSICAS.length && (m.on === 0 || m.on === 1)) tocador.ir(m.i, m.on === 1);
  else if (m.t === 'ola' && online.papel() === 'convidado' && (m.gato === 0 || m.gato === 1)) {
    const meu = 1 - m.gato, mudou = meu !== ativo || escolhendo;
    fecharEscolha(meu);
    if (mudou) aviso(`${jogadores[m.gato].nome} já está com quem criou a sala — você é ${jogadores[meu].nome}.`);
  }
}
function atualizarRemoto(dt) {
  if (!online.conectado() || !alvoRemoto || casal || (maos && maos.seguidor === outro())) return;
  const r = outro(), a = alvoRemoto;
  if (a.assento) {
    if (r.assento !== a.assento) { if (r.assento) levantar(r); if (!a.assento.ocupado) sentar(r, a.assento); }
    if (r.assento) return;                           // quem está sentado se acomoda sozinho no passo
  } else if (r.assento) levantar(r);
  const k = 1 - Math.exp(-10 * dt), d = Math.hypot(a.x - r.x, a.z - r.z);
  if (d > 3) { r.x = a.x; r.z = a.z; } else { r.x += (a.x - r.x) * k; r.z += (a.z - r.z) * k; }
  r.yaw += angDiff(r.yaw, a.yaw) * k;
  if (a.andando && !r.andando) { r.gato.acao('andar'); r.andando = true; } else if (!a.andando && r.andando) { r.gato.parar(0.25); r.andando = false; }
  r.grupo.position.set(r.x, 0, r.z); r.grupo.rotation.y = r.yaw;
}
function enviarEstado(dt) {
  tEventos += dt; if (tEventos > 1) { tEventos = 0; eventosSeg = 0; }
  if (!online.conectado() || (tEnvio -= dt) > 0) return;
  tEnvio = 1 / 15; const p = eu();
  online.enviar({ t: 'e', x: +p.x.toFixed(3), z: +p.z.toFixed(3), y: +p.yaw.toFixed(3), a: p.andando ? 1 : 0, s: p.assento ? p.assento.id : null });
}
const TEXTO_ON = { esperando: 'Esperando ela entrar…', procurando: 'Procurando a sala…', conectando: 'Conectando os celulares…',
  conectado: 'Conectados!', 'reconectando-recados': 'Tentando achar a sala de novo…', 'erro-rede': 'Sem internet para achar a sala.',
  falhou: 'Não deu para conectar direto. Tentem os dois no mesmo Wi-Fi e criem a sala de novo.', desconectado: 'A conexão caiu.' };
const online = criarOnline({
  aoAbrir: (papel) => {
    clearTimeout(tConectando); $('onlineUI').hidden = true; alvoRemoto = null; atualizarOnlineUI();
    if (papel === 'anfitriao') { online.enviar({ t: 'ola', gato: ativo }); avisarMusica(); }
    enviarLista(); rotularQuadro(); online.enviar({ t: 'bq', b: BQ.b, vaso: BQ.vaso, em: BQ.em });      // combina o estado do buquê (vale o mais novo)
    aviso('Conectados! Agora cada um anda com o seu gatinho.');
  },
  aoMensagem: receber,
  aoFoto: receberFoto,
  aoFotoAviso: avisoDeFotos,
  aoFechar: () => { rotularQuadro(); terminarMaos(false); $('pedidoUI').hidden = true; alvoRemoto = null; const r = outro(); if (r.andando) { r.gato.parar(0.25); r.andando = false; } aviso('A conexão caiu. Dá para criar a sala de novo.'); atualizarOnlineUI(); },
  aoStatus: (st) => { $('onEstado').textContent = TEXTO_ON[st] || ''; if (st === 'falhou') aviso(TEXTO_ON.falhou); },
});
function atualizarOnlineUI() {
  const c = online.conectado();
  $('btnOnline').textContent = c ? 'Online ●' : 'Online'; $('btnOnline').classList.toggle('on', c);
  $('btnSairOnline').hidden = !online.ativo();
}
function mostrarSala(codigo) { $('onInicio').hidden = true; $('onSala').hidden = false; $('codigoGrande').textContent = codigo; }
function esperarConexao() { clearTimeout(tConectando); tConectando = setTimeout(() => { if (!online.conectado()) $('onEstado').textContent = 'Está demorando… Confiram se os dois estão com internet (de preferência no mesmo Wi-Fi).'; }, 30000); }
$('btnOnline').addEventListener('click', () => { const on = online.ativo(); $('onInicio').hidden = on; $('onSala').hidden = !on; $('onlineUI').hidden = false; atualizarOnlineUI(); });
$('btnFecharOnline').addEventListener('click', () => { $('onlineUI').hidden = true; });
$('btnCriarSala').addEventListener('click', () => { const c = online.criarSala(); mostrarSala(c); $('btnConvite').hidden = false; esperarConexao(); atualizarOnlineUI(); });
function entrarSala(c) {
  c = (c || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (!codigoValido(c)) { aviso('O código tem 8 letras/números.'); return; }
  online.entrar(c); mostrarSala(c); $('btnConvite').hidden = true; esperarConexao(); atualizarOnlineUI();
}
$('btnEntrarSala').addEventListener('click', () => entrarSala($('codigoSala').value));
for (const ev of ['keydown', 'keyup']) $('codigoSala').addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Enter') entrarSala($('codigoSala').value); });
$('btnConvite').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?sala=${online.codigo()}`;
  try { if (navigator.share) { await navigator.share({ title: 'Nosso Museu', text: 'Vem passear comigo no nosso museu 💕', url }); return; } } catch { /* cancelou */ return; }
  try { await navigator.clipboard.writeText(url); aviso('Link do convite copiado!'); } catch { aviso(url); }
});
$('chkFotos').checked = lerOpcao();
$('chkFotos').addEventListener('change', async (e) => {
  try { localStorage.setItem('museu-mostrar-fotos', e.target.checked ? 'sim' : 'nao'); } catch { /* ok */ }
  if (!online.conectado()) return;
  if (e.target.checked) enviarLista();
  rotularQuadro();
});
$('btnSairOnline').addEventListener('click', () => { online.sair(); clearTimeout(tConectando); alvoRemoto = null; $('onInicio').hidden = false; $('onSala').hidden = true; atualizarOnlineUI(); });
{   // entrou pelo link do convite (?sala=CODIGO)
  const q = new URLSearchParams(location.search).get('sala');
  if (q) { const limpo = new URL(location.href); limpo.searchParams.delete('sala'); history.replaceState(null, '', limpo); $('onlineUI').hidden = false; entrarSala(q); }
}

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
  if (casal || escolhendo || mural.aberto()) { if (p.andando) { p.gato.parar(0.25); p.andando = false; } return; }
  if (maos && maos.seguidor === p) {
    const quer = teclas.size > 0 || Math.hypot(joy.x, joy.y) > 0.3;
    if (quer && !avisouConduzido) { avisouConduzido = true; aviso('Você está sendo conduzida 💕 Toque em “Soltar a mão” para andar sozinha.'); }
    return;
  }
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
    if (o === p || maos) continue;
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
  buqK += ((camBuque > 0 && eu() === ela() && BQ.b === 'com_ela' ? 1 : 0) - buqK) * (1 - Math.exp(-4 * dt)); if (buqK < 0.002) buqK = 0;
  if (buqK > 0) {          // "Cheirar": a câmera chega pertinho do rosto e do buquê
    const k = buqK * buqK * (3 - 2 * buqK);
    desejada.lerp(vA.set(p.x + Math.sin(p.yaw) * 1.25, 1.05 + p.grupo.position.y, p.z + Math.cos(p.yaw) * 1.25), k);
    olhar.lerp(vB.set(buqueMao.position.x, buqueMao.position.y + 0.12, buqueMao.position.z), k); fov += (40 - fov) * k;
  }
  jogadores.forEach((j) => { j.grupo.visible = true; });
  if (zoomK > 0.6) p.grupo.visible = false;          // o gato some enquanto você olha a foto de perto
  for (const j of jogadores) if (j !== p && Math.hypot(camera.position.x - j.x, camera.position.z - j.z) < 0.75 && camera.position.y < 1.6 + j.grupo.position.y) j.grupo.visible = false;   // não atravessar a cabeça de quem está colado na câmera
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
  atualizarRemoto(dt);
  atualizarCasal(dt);
  atualizarMaos(dt);
  recep.atualizar(dt, jogadores);
  for (const j of jogadores) if (j !== eu() && j.assento) acomodar(j, dt);
  for (const j of jogadores) { j.gato.atualizar(dt); j.grupo.position.y = j.altSent * j.gato.nivelSentado() + alturaCasal(j); }
  atualizarCoracoes(dt); atualizarBotaoCasal(); enviarEstado(dt); atualizarPosesCasal(); vitrola.atualizar(dt, tocador.tocando()); atualizarSom(dt); atualizarHora(dt); atualizarBuque(dt);
  atualizarCamera(dt); atualizarZona(dt); atualizarQuadro();
}
function aplicarModo(leve) {
  modoLeve = leve; try { localStorage.setItem('museu-modo', leve ? 'leve' : 'bonito'); } catch { /* ok */ }
  nitidez = nitidezMax(); renderer.setPixelRatio(nitidez); ajustar();
  renderer.shadowMap.type = leve ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; renderer.shadowMap.needsUpdate = true;
  cena.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  $('btnModo').textContent = leve ? 'Leve' : 'Bonito'; $('btnModo').title = leve ? 'Modo leve: esquenta menos o celular' : 'Modo bonito: máximo de qualidade';
}
$('btnModo').addEventListener('click', () => { aplicarModo(!modoLeve); aviso(modoLeve ? 'Modo leve: o celular esquenta menos.' : 'Modo bonito: máximo de qualidade (esquenta mais no celular).'); });
$('btnModo').textContent = modoLeve ? 'Leve' : 'Bonito';

// sombrinha suave embaixo de cada gato (acompanha onde ele está)
const texSombra = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const geoSombra = new THREE.PlaneGeometry(1, 1), matSombra = new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false });
function sombrinha(x, z, r = 0.72) { const m = new THREE.Mesh(geoSombra, matSombra); m.rotation.x = -Math.PI / 2; m.scale.set(r, r, 1); m.position.set(x, 0.03, z); m.renderOrder = 1; cena.add(m); return m; }
const sombras = jogadores.map((j) => sombrinha(j.x, j.z)); sombrinha(2.0, 7.0);
function atualizarSombras() { jogadores.forEach((j, i) => sombras[i].position.set(j.x, 0.03, j.z)); }

// ritmo: 60 quadros por segundo quando algo se mexe; no celular, 30 quando está tudo parado (economiza bateria e calor)
const algoMexendo = () => teclas.size > 0 || Math.hypot(joy.x, joy.y) > 0.05 || !!arrasto || !!casal || !!maos || cima || coracoes.length > 0
  || (zoomK > 0.001 && zoomK < 0.999) || jogadores.some((j) => j.andando) || camera.position.distanceToSquared(desejada) > 1e-4;
let acumulado = 0, mediaQuadro = 16.7, tAjuste = 0;
renderer.setAnimationLoop(() => {
  acumulado += relogio.getDelta();
  const rapido = !modoLeve && (!CELULAR || algoMexendo()), alvo = rapido ? 1 / 62 : 1 / 31;
  if (acumulado < alvo) return;
  const dt = acumulado; acumulado = 0;
  passo(dt); atualizarSombras(); renderer.render(cena, camera);
  // se o aparelho não está dando conta, baixa um pouco a nitidez; se sobra fôlego, volta a subir
  if (rapido && dt < 0.25) {
    mediaQuadro += (dt * 1000 - mediaQuadro) * 0.05;
    if ((tAjuste += dt) > 2) {
      tAjuste = 0; let nova = nitidez;
      if (mediaQuadro > 26 && nitidez > 1) nova = Math.max(1, nitidez - 0.15);
      else if (mediaQuadro < 18 && nitidez < nitidezMax()) nova = Math.min(nitidezMax(), nitidez + 0.1);
      if (nova !== nitidez) { nitidez = nova; renderer.setPixelRatio(nitidez); ajustar(); }
    }
  }
});

// posição inicial da câmera atrás do gato
{ const p = eu(); cam.yaw = p.yaw - Math.PI; camera.position.set(p.x + Math.sin(cam.yaw) * 4, 2.4, p.z + Math.cos(cam.yaw) * 4); }

// ---------- tela de escolha: a primeira coisa ao abrir o jogo ----------
function retratos() {          // foto de cada gatinho para os cartões (desenhada uma vez, num quadro à parte)
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(300, 340, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = renderer.toneMapping;
    const sc = new THREE.Scene(), cm = new THREE.PerspectiveCamera(30, 300 / 340, 0.1, 20);
    sc.add(new THREE.HemisphereLight(0xffffff, 0xcbb9a0, 2.4)); const luz = new THREE.DirectionalLight(0xfff4e6, 1.8); luz.position.set(1.5, 2.5, 3); sc.add(luz);
    cm.position.set(0, 0.78, 3.0); cm.lookAt(0, 0.66, 0);
    const fotos = jogadores.map((j) => {
      const c = j.grupo.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0.25 * (j.terno ? 1 : -1), 0); c.visible = true;
      sc.add(c); r.render(sc, cm); const url = r.domElement.toDataURL('image/png'); sc.remove(c); return url;
    });
    r.dispose(); r.forceContextLoss(); return fotos;
  } catch { return []; }
}
let escolhendo = true;
function fecharEscolha(i) {
  if (escolhendo) { escolhendo = false; $('escolha').classList.add('fim'); setTimeout(() => { $('escolha').hidden = true; }, 600); }
  if (i !== ativo) definirGatos(i); else atualizarNome();
}
{
  const fotos = retratos();
  document.querySelectorAll('#escolha .cartao').forEach((b) => {
    const i = +b.dataset.gato; if (fotos[i]) b.querySelector('img').src = fotos[i];
    b.querySelector('b').textContent = jogadores[i].nome;
    b.addEventListener('click', () => fecharEscolha(i));
  });
  $('escolha').hidden = false;
}
$('carregando').classList.add('fim');

// gancho para testes automáticos
window.museu = {
  jogadores, cam, salao, mobilia, recep, online, tocador, BQ, buque: { oferecer: () => $('btnBuque').click(), receber: () => $('btnReceber').click(), cheirar: () => $('btnCheirar').click(), vaso: () => $('btnVaso').click(), guardar: () => $('btnGuardarBuque').click() }, VASO, mural: () => mural, refazerGPU, modo: (leve) => aplicarModo(leve), fotosLocais, hora: (h) => { horaFixa = h; tHora = 0; }, maos: () => maos, pedirMao, soltarMaos, iniciarMaos, casal: (t) => iniciarCasal(t), emCasal: () => casal && casal.fase, sentar: (i = ativo) => { const p = jogadores[i]; sentar(p, acharAssento(p)); rotularQuadro(); }, levantar: (i = ativo) => { levantar(jogadores[i]); rotularQuadro(); }, THREE, camera, quadros, quadroAtual: () => quadroAtual,
  ativo: () => ativo,
  colocar(x, z, yaw) { const p = eu(); p.x = x; p.z = z; if (yaw != null) p.yaw = yaw; p.grupo.position.set(x, 0, z); p.grupo.rotation.y = p.yaw; camera.position.set(x + Math.sin(cam.yaw) * cam.dist, 2.4, z + Math.cos(cam.yaw) * cam.dist); },
  cima(on) { if (on !== cima) $('btnCima').click(); },
  humor: (n) => fazerHumor(eu(), n), gesto: (n) => fazerGesto(eu(), n), trocar: () => definirGatos((ativo + 1) % jogadores.length), escolher: (i) => fecharEscolha(i),
  tick(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) passo(dt); },
  pausar() { renderer.setAnimationLoop(null); },
  png() { atualizarSombras(); renderer.render(cena, camera); return renderer.domElement.toDataURL('image/png'); },
  medir(n = 20) {       // teste de desempenho: tempo médio por quadro e quanto o celular desenha
    const gl = renderer.getContext(); let t0 = performance.now();
    for (let i = 0; i < n; i++) { passo(1 / 60); atualizarSombras(); renderer.render(cena, camera); }
    gl.finish(); const ms = (performance.now() - t0) / n; const r = renderer.info.render;
    return { modo: modoLeve ? 'leve' : 'bonito', ms: +ms.toFixed(1), desenhos: r.calls, triangulos: r.triangles, luzes: cena.children.filter((o) => o.isLight).length, px: renderer.getPixelRatio() };
  },
};
