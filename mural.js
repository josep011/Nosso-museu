// Mural de cortiça: post-its escritos e fotos, colocados onde quiser.
// Fica na parede da frente do Salão das fotos (à direita da recepção). Tudo é guardado só nos aparelhos de vocês
// (mesmo banco das fotos dos quadros, com ids "mural-...") e, no online, vai direto para o outro celular.
import * as THREE from 'three';
import * as armazem from './armazem.js?v=202610220925';

export const MURAL = { x: 7.56, y: 1.62, z: 7.955, w: 3.6, h: 1.8 };
const CW = 2048, CH = 1024;                 // "papel" do mural (mesma proporção 2:1)
const CORES = ['#ffe680', '#ffb3c7', '#b8e6c1', '#b3d4ff', '#ffcf99', '#e3cdfc'];
const NOTA = 230, FOTO = 300;               // tamanhos em pixels do papel
const FONTE = '"Segoe Print","Bradley Hand","Comic Sans MS","Chalkboard SE",cursive';
const idNovo = () => 'mural-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
const limpa = (t) => String(t || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 140);

function cortica() {                         // textura de cortiça feita na hora (sem arquivo)
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
  g.fillStyle = '#c4935e'; g.fillRect(0, 0, CW, CH);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26000; i++) {
    const x = rnd() * CW, y = rnd() * CH, r = 1 + rnd() * 3.2, t = rnd();
    g.fillStyle = t < 0.5 ? `rgba(120,78,40,${0.15 + rnd() * 0.3})` : `rgba(230,190,140,${0.12 + rnd() * 0.3})`;
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.6), rnd() * 3, 0, 7); g.fill();
  }
  const v = g.createRadialGradient(CW / 2, CH / 2, CH * 0.3, CW / 2, CH / 2, CW * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,30,10,0.22)');
  g.fillStyle = v; g.fillRect(0, 0, CW, CH); return c;
}

function quebrarTexto(g, texto, larg, max) {
  const palavras = texto.split(/\s+/).filter(Boolean), linhas = []; let atual = '';
  for (const p of palavras) {
    const t = atual ? atual + ' ' + p : p;
    if (g.measureText(t).width <= larg) atual = t;
    else { if (atual) linhas.push(atual); atual = p; while (g.measureText(atual).width > larg && atual.length > 1) { let k = atual.length - 1; while (k > 1 && g.measureText(atual.slice(0, k)).width > larg) k--; linhas.push(atual.slice(0, k)); atual = atual.slice(k); } }
    if (linhas.length >= max) break;
  }
  if (atual && linhas.length < max) linhas.push(atual);
  if (linhas.length === max && palavras.join(' ').length > linhas.join(' ').length) linhas[max - 1] = linhas[max - 1].replace(/.{0,2}$/, '…');
  return linhas;
}
function alfinete(g, x, y, cor) {
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 4, y + 5, 13, 0, 7); g.fill();
  g.fillStyle = cor; g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x - 4, y - 4, 4.5, 0, 7); g.fill();
}
const corAlfinete = (quem) => (/terno/i.test(quem || '') ? '#2f4a8a' : '#d0384f');
function tamanho(it) { if (it.tipo === 'nota') return [NOTA, NOTA]; const w = FOTO * (it.s || 1), ar = it.img ? it.img.height / it.img.width : 0.8; return [w, w * ar + 0.055 * w + 0.15 * w]; }

function desenharItem(g, it) {
  const [w, h] = tamanho(it);
  g.save(); g.translate(it.x * CW, it.y * CH); g.rotate(it.r || 0);
  g.shadowColor = 'rgba(40,20,5,0.35)'; g.shadowBlur = 14; g.shadowOffsetX = 5; g.shadowOffsetY = 7;
  if (it.tipo === 'nota') {
    g.fillStyle = CORES[it.cor % CORES.length] || CORES[0]; g.fillRect(-w / 2, -h / 2, w, h); g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(-w / 2, -h / 2, w, 26);
    g.fillStyle = '#3a2f28'; g.font = `600 30px ${FONTE}`; g.textBaseline = 'top';
    const linhas = quebrarTexto(g, it.texto || '', w - 30, 6);
    linhas.forEach((l, i) => g.fillText(l, -w / 2 + 15, -h / 2 + 34 + i * 31));
    alfinete(g, 0, -h / 2 + 14, corAlfinete(it.quem));
  } else {
    const m = 0.055 * w, base = 0.15 * w, iw = w - 2 * m, ih = h - m - base;
    g.fillStyle = '#fbf8f1'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowColor = 'transparent';
    if (it.img) g.drawImage(it.img, -w / 2 + m, -h / 2 + m, iw, ih);
    else { g.fillStyle = '#d9d2c4'; g.fillRect(-w / 2 + m, -h / 2 + m, iw, ih); g.fillStyle = '#8a8070'; g.font = '600 22px system-ui'; g.textAlign = 'center'; g.fillText('carregando…', 0, -h / 2 + m + ih / 2); g.textAlign = 'left'; }
    g.fillStyle = 'rgba(255,240,200,0.55)'; g.save(); g.translate(0, -h / 2 + 4); g.rotate(-0.06); g.fillRect(-48, -14, 96, 30); g.restore();   // fita adesiva
  }
  g.restore();
}

export function criarMural(cena, salao, { quem, aoMudar, aviso }) {
  const itens = new Map(), versoes = new Map();
  const fundo = cortica();
  const tela = document.createElement('canvas'); tela.width = CW; tela.height = CH; const g = tela.getContext('2d');
  const tex = new THREE.CanvasTexture(tela); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // ---------- o quadro na parede ----------
  const grupo = new THREE.Group(); grupo.position.set(MURAL.x, MURAL.y, MURAL.z); grupo.rotation.y = Math.PI; cena.add(grupo);
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(MURAL.w, MURAL.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  placa.position.z = 0.03; placa.receiveShadow = true; grupo.add(placa);
  const madeira = new THREE.MeshStandardMaterial({ color: 0x8a6444, roughness: 0.6 }), e = 0.07;
  for (const [w, h, x, y] of [[MURAL.w + 2 * e, e, 0, MURAL.h / 2 + e / 2], [MURAL.w + 2 * e, e, 0, -MURAL.h / 2 - e / 2], [e, MURAL.h, -MURAL.w / 2 - e / 2, 0], [e, MURAL.h, MURAL.w / 2 + e / 2, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), madeira); b.position.set(x, y, 0.035); b.castShadow = true; grupo.add(b);
  }
  const fundoPlaca = new THREE.Mesh(new THREE.BoxGeometry(MURAL.w, MURAL.h, 0.02), madeira); fundoPlaca.position.z = 0.01; grupo.add(fundoPlaca);
  const bandeja = new THREE.Mesh(new THREE.BoxGeometry(MURAL.w * 0.5, 0.03, 0.08), madeira); bandeja.position.set(0, -MURAL.h / 2 - e - 0.01, 0.06); grupo.add(bandeja);

  const ordenados = () => [...itens.values()].sort((a, b) => a.em - b.em);
  function desenharTudo(ctx) { ctx.drawImage(fundo, 0, 0); for (const it of ordenados()) desenharItem(ctx, it); }
  function atualizar() { desenharTudo(g); tex.needsUpdate = true; if (ed.aberto) ed.desenhar(); }

  // ---------- guardar no aparelho ----------
  const registro = (it) => ({ id: it.id, em: it.em, blob: it.blob || undefined, mural: { tipo: it.tipo, x: it.x, y: it.y, r: it.r || 0, s: it.s || 1, cor: it.cor || 0, texto: it.texto || '', quem: it.quem || '' } });
  const meta = (it) => ({ id: it.id, em: it.em, ...registro(it).mural });
  async function guardar(it) { versoes.set(it.id, it.em); try { await armazem.guardar(registro(it)); } catch { aviso && aviso('Não deu para guardar no aparelho.'); } }
  async function carregar() {
    try {
      for (const r of await armazem.todas()) {
        if (!r.id.startsWith('mural-')) continue;
        versoes.set(r.id, r.em || 1); if (r.apagado || !r.mural) continue;
        const it = { id: r.id, em: r.em || 1, ...r.mural, blob: r.blob || null };
        if (it.blob) { try { it.img = await createImageBitmap(it.blob); } catch { /* foto estragada */ } }
        itens.set(it.id, it);
      }
    } catch { /* sem nada guardado */ }
    atualizar();
  }

  // ---------- mudanças feitas aqui ----------
  function mudou(it, blobNovo) { it.em = Math.max(Date.now(), (versoes.get(it.id) || 0) + 1); guardar(it); atualizar(); aoMudar && aoMudar(meta(it), blobNovo ? it.blob : null, false); }
  function remover(it) {
    const em = Math.max(Date.now(), (versoes.get(it.id) || 0) + 1); itens.delete(it.id); versoes.set(it.id, em);
    armazem.apagar(it.id, em).catch(() => {}); atualizar(); aoMudar && aoMudar({ id: it.id, em }, null, true);
  }

  // ---------- mudanças vindas do outro celular (conferidas antes) ----------
  function validar(m) {
    if (!m || typeof m.id !== 'string' || !/^mural-[a-z0-9]{1,16}$/.test(m.id) || !Number.isFinite(m.em)) return null;
    if (m.tipo !== 'nota' && m.tipo !== 'foto') return null;
    const n = (v, a, b, p) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : p);
    return { id: m.id, em: m.em, tipo: m.tipo, x: n(m.x, 0, 1, 0.5), y: n(m.y, 0, 1, 0.5), r: n(m.r, -0.8, 0.8, 0), s: n(m.s, 0.5, 1.8, 1),
      cor: Number.isInteger(m.cor) && m.cor >= 0 && m.cor < CORES.length ? m.cor : 0, texto: limpa(m.texto), quem: limpa(m.quem).slice(0, 30) };
  }
  function aplicarRemoto(bruto) {          // devolve true se é uma foto que ainda precisa da imagem
    const m = validar(bruto); if (!m || m.em <= (versoes.get(m.id) || 0)) return false;
    const velho = itens.get(m.id), it = { ...m, blob: velho ? velho.blob : null, img: velho ? velho.img : null };
    itens.set(m.id, it); guardar(it); atualizar();
    return it.tipo === 'foto' && !it.blob;
  }
  async function receberImagem(id, blob) {
    const it = itens.get(id); if (!it || it.tipo !== 'foto' || it.blob || !(blob instanceof Blob) || blob.size > 4 * 1024 * 1024) return;
    let img; try { img = await createImageBitmap(blob); } catch { return; }
    if (img.width > 4096 || img.height > 4096) { img.close?.(); return; }
    it.blob = blob; it.img = img; guardar(it); atualizar();
  }
  function removerRemoto(id, em) {
    if (!/^mural-[a-z0-9]{1,16}$/.test(id) || !Number.isFinite(em) || em <= (versoes.get(id) || 0)) return;
    itens.delete(id); versoes.set(id, em); armazem.apagar(id, em).catch(() => {}); atualizar();
  }
  const pegar = (id) => { const it = itens.get(id); return it ? { meta: meta(it), blob: it.blob || null } : null; };

  // ---------- editor em tela cheia ----------
  const ed = criarEditor({ itens, ordenados, desenharTudo, tamanho, mudou, remover, quem, aviso,
    criar: (dados, blob, img) => { const it = { id: idNovo(), em: Date.now(), r: (Math.random() - 0.5) * 0.24, s: 1, cor: 0, texto: '', quem: quem(), ...dados, blob: blob || null, img: img || null }; itens.set(it.id, it); mudou(it, !!blob); return it; } });

  carregar();
  return { abrir: () => ed.abrir(), fechar: () => ed.fechar(), aberto: () => ed.aberto, aplicarRemoto, receberImagem, removerRemoto, pegar,
    versao: (id) => versoes.get(id) || 0, itens, centro: { x: MURAL.x, z: MURAL.z } };
}

// ---------- a tela do mural (arrastar, aproximar, escrever, foto) ----------
function criarEditor(o) {
  const css = document.createElement('style');
  css.textContent = `
  #muralUI{position:fixed;inset:0;z-index:7;background:rgba(18,16,20,.94);display:flex;flex-direction:column;touch-action:none}
  #muralUI[hidden]{display:none!important}
  #muralUI .topo{display:flex;align-items:center;justify-content:space-between;padding:max(10px,env(safe-area-inset-top)) 12px 8px}
  #muralUI .topo b{font-size:16px;font-weight:600}
  #muralUI .area{flex:1;position:relative;overflow:hidden}
  #muralUI canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
  #muralUI .barra{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:10px 12px max(12px,env(safe-area-inset-bottom))}
  #muralUI .barra button{font-size:14px;padding:9px 12px}
  #muralUI .forte{background:#e8c98f;color:#2a2830;border-color:transparent;font-weight:600}
  #muralUI .dica{font-size:12px;color:#b9b4a8;text-align:center;padding:0 12px}
  @media (orientation: landscape){#muralUI .deite{display:none}}
  #muralModal{position:fixed;inset:0;z-index:8;background:rgba(0,0,0,.45);display:grid;place-items:center;padding:16px}
  #muralModal[hidden]{display:none!important}
  #muralModal .caixa{width:min(360px,100%);background:#2a2830;border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px}
  #muralModal textarea{font:inherit;font-size:16px;min-height:110px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#fffbe8;color:#3a2f28;padding:10px;resize:none;user-select:text;-webkit-user-select:text}
  #muralModal .cores{display:flex;gap:8px;justify-content:center}
  #muralModal .cores button{width:34px;height:34px;border-radius:8px;padding:0;border:2px solid transparent}
  #muralModal .cores button.on{border-color:#fff}
  #muralModal .linha{display:flex;gap:8px;justify-content:flex-end}`;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.id = 'muralUI'; ui.hidden = true;
  ui.innerHTML = `<div class="topo"><b>Mural de recados</b><button data-a="fechar" class="forte">Concluir</button></div>
    <div class="area"><canvas></canvas></div>
    <p class="dica">Arraste para mudar de lugar · dois dedos para aproximar · toque num item para mexer nele<span class="deite"> · deite o celular para ver maior</span></p>
    <div class="barra" data-modo="geral"><button data-a="nota" class="forte">Novo recado</button><button data-a="foto">Foto</button><button data-a="menos" aria-label="Afastar">−</button><button data-a="mais" aria-label="Aproximar">+</button></div>
    <div class="barra" data-modo="item" hidden><button data-a="editar">Editar</button><button data-a="girar">Girar</button><button data-a="maior">Maior</button><button data-a="menor">Menor</button><button data-a="remover">Remover</button><button data-a="pronto" class="forte">Pronto</button></div>
    <input type="file" accept="image/*" hidden>`;
  const modal = document.createElement('div'); modal.id = 'muralModal'; modal.hidden = true;
  modal.innerHTML = `<div class="caixa"><b>Recado</b><textarea maxlength="140" placeholder="Escreva um recadinho…"></textarea><div class="cores"></div>
    <div class="linha"><button data-a="cancelar">Cancelar</button><button data-a="salvar" class="forte">Pregar no mural</button></div></div>`;
  document.body.append(ui, modal);
  const cv = ui.querySelector('canvas'), cx = cv.getContext('2d'), area = ui.querySelector('.area'), arq = ui.querySelector('input');
  const txt = modal.querySelector('textarea'), coresEl = modal.querySelector('.cores');
  for (const ev of ['keydown', 'keyup']) { txt.addEventListener(ev, (e) => e.stopPropagation()); ui.addEventListener(ev, (e) => e.stopPropagation()); }
  let corEscolhida = 0, editando = null;
  CORES.forEach((c, i) => { const b = document.createElement('button'); b.style.background = c; b.addEventListener('click', () => { corEscolhida = i; [...coresEl.children].forEach((x, k) => x.classList.toggle('on', k === i)); }); coresEl.append(b); });

  const ed = { aberto: false };
  let k = 1, ox = 0, oy = 0, kMin = 1, sel = null, dpr = 1;
  function encaixar() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); const r = area.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    kMin = Math.min(r.width / CW, r.height / CH) * 0.96; if (k < kMin) k = kMin; limitar();
  }
  function limitar() {
    const r = area.getBoundingClientRect(), w = CW * k, h = CH * k;
    ox = w <= r.width ? (r.width - w) / 2 : Math.min(0, Math.max(r.width - w, ox));
    oy = h <= r.height ? (r.height - h) / 2 : Math.min(0, Math.max(r.height - h, oy));
  }
  ed.desenhar = () => {
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
    cx.setTransform(k * dpr, 0, 0, k * dpr, ox * dpr, oy * dpr); o.desenharTudo(cx);
    if (sel && o.itens.has(sel.id)) {           // contorno do item escolhido
      const [w, h] = o.tamanho(sel); cx.save(); cx.translate(sel.x * CW, sel.y * CH); cx.rotate(sel.r || 0);
      cx.strokeStyle = '#ffffff'; cx.lineWidth = 5 / k / dpr * dpr; cx.setLineDash([16, 10]); cx.strokeRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20); cx.restore();
    }
  };
  const naPlaca = (px, py) => [(px - ox) / k, (py - oy) / k];
  function acertar(bx, by) {
    const lista = o.ordenados(); for (let i = lista.length - 1; i >= 0; i--) {
      const it = lista[i], [w, h] = o.tamanho(it), dx = bx - it.x * CW, dy = by - it.y * CH, c = Math.cos(-(it.r || 0)), s = Math.sin(-(it.r || 0));
      const lx = dx * c - dy * s, ly = dx * s + dy * c; if (Math.abs(lx) <= w / 2 + 6 && Math.abs(ly) <= h / 2 + 6) return it;
    }
    return null;
  }
  function selecionar(it) { sel = it; ui.querySelector('[data-modo="geral"]').hidden = !!it; ui.querySelector('[data-modo="item"]').hidden = !it;
    if (it) { ui.querySelector('[data-a="editar"]').hidden = it.tipo !== 'nota'; ui.querySelector('[data-a="maior"]').hidden = it.tipo !== 'foto'; ui.querySelector('[data-a="menor"]').hidden = it.tipo !== 'foto'; }
    ed.desenhar(); }

  // ---------- dedos / mouse ----------
  const dedos = new Map(); let arrastando = null, pinca = null, moveu = false;
  const ponto = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); const p = ponto(e); dedos.set(e.pointerId, p); moveu = false;
    if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pinca = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, ox, oy }; arrastando = null; return; }
    const [bx, by] = naPlaca(p[0], p[1]), it = acertar(bx, by);
    arrastando = it ? { it, dx: it.x * CW - bx, dy: it.y * CH - by } : { pan: true, x: p[0], y: p[1], ox, oy };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!dedos.has(e.pointerId)) return; const p = ponto(e); const ant = dedos.get(e.pointerId); dedos.set(e.pointerId, p);
    if (Math.hypot(p[0] - ant[0], p[1] - ant[1]) > 0.5) moveu = true;
    if (pinca && dedos.size >= 2) {
      const [a, b] = [...dedos.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), nk = Math.min(kMin * 5, Math.max(kMin, pinca.k * d / pinca.d));
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; ox = mx - (pinca.cx - pinca.ox) * nk / pinca.k; oy = my - (pinca.cy - pinca.oy) * nk / pinca.k; k = nk; limitar(); ed.desenhar(); return;
    }
    if (!arrastando) return;
    if (arrastando.pan) { ox = arrastando.ox + p[0] - arrastando.x; oy = arrastando.oy + p[1] - arrastando.y; limitar(); ed.desenhar(); return; }
    const [bx, by] = naPlaca(p[0], p[1]), it = arrastando.it;
    it.x = Math.min(1, Math.max(0, (bx + arrastando.dx) / CW)); it.y = Math.min(1, Math.max(0, (by + arrastando.dy) / CH)); arrastando.mexeu = true; ed.desenhar();
  });
  const soltar = (e) => {
    if (!dedos.has(e.pointerId)) return; dedos.delete(e.pointerId);
    if (dedos.size < 2) pinca = null;
    if (arrastando && dedos.size === 0) {
      const a = arrastando; arrastando = null;
      if (a.it && a.mexeu) { o.mudou(a.it); selecionar(a.it); }       // mudou de lugar: guarda e manda para o outro
      else if (a.it && !moveu) selecionar(a.it);
      else if (a.pan && !moveu) selecionar(null);
    }
  };
  cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = ponto(e), nk = Math.min(kMin * 5, Math.max(kMin, k * (e.deltaY < 0 ? 1.15 : 0.87))); ox = p[0] - (p[0] - ox) * nk / k; oy = p[1] - (p[1] - oy) * nk / k; k = nk; limitar(); ed.desenhar(); }, { passive: false });

  // ---------- botões ----------
  const centroVisivel = () => { const r = area.getBoundingClientRect(); const [bx, by] = naPlaca(r.width / 2, r.height / 2); return { x: Math.min(0.92, Math.max(0.08, bx / CW)), y: Math.min(0.88, Math.max(0.12, by / CH)) }; };
  function abrirRecado(it) { editando = it; txt.value = it ? it.texto : ''; corEscolhida = it ? it.cor : Math.floor(Math.random() * CORES.length); [...coresEl.children].forEach((x, i) => x.classList.toggle('on', i === corEscolhida)); modal.hidden = false; setTimeout(() => txt.focus(), 50); }
  modal.addEventListener('click', (e) => {
    const a = e.target.dataset && e.target.dataset.a; if (!a) return;
    if (a === 'cancelar') { modal.hidden = true; return; }
    if (a === 'salvar') {
      const texto = limpa(txt.value).trim(); if (!texto) { txt.focus(); return; }
      modal.hidden = true;
      if (editando) { editando.texto = texto; editando.cor = corEscolhida; o.mudou(editando); selecionar(editando); }
      else selecionar(o.criar({ tipo: 'nota', texto, cor: corEscolhida, ...centroVisivel() }));
    }
  });
  arq.addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }), esc = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86)), img = await createImageBitmap(blob);
      selecionar(o.criar({ tipo: 'foto', ...centroVisivel() }, blob, img));
    } catch { o.aviso && o.aviso('Não consegui abrir essa imagem.'); }
  });
  ui.addEventListener('click', (e) => {
    const a = e.target.dataset && e.target.dataset.a; if (!a) return;
    if (a === 'fechar') ed.fechar();
    else if (a === 'nota') abrirRecado(null);
    else if (a === 'foto') arq.click();
    else if (a === 'mais' || a === 'menos') { const r = area.getBoundingClientRect(), nk = Math.min(kMin * 5, Math.max(kMin, k * (a === 'mais' ? 1.4 : 0.7))); ox = r.width / 2 - (r.width / 2 - ox) * nk / k; oy = r.height / 2 - (r.height / 2 - oy) * nk / k; k = nk; limitar(); ed.desenhar(); }
    else if (!sel) return;
    else if (a === 'editar') abrirRecado(sel);
    else if (a === 'girar') { sel.r = ((sel.r || 0) + 0.15 > 0.6) ? -0.45 : (sel.r || 0) + 0.15; o.mudou(sel); ed.desenhar(); }
    else if (a === 'maior' || a === 'menor') { sel.s = Math.min(1.8, Math.max(0.5, (sel.s || 1) * (a === 'maior' ? 1.15 : 0.87))); o.mudou(sel); ed.desenhar(); }
    else if (a === 'remover') { o.remover(sel); selecionar(null); }
    else if (a === 'pronto') selecionar(null);
  });
  addEventListener('resize', () => { if (ed.aberto) { encaixar(); ed.desenhar(); } });
  ed.abrir = () => { ui.hidden = false; ed.aberto = true; k = 0; encaixar(); selecionar(null); };
  ed.fechar = () => { ui.hidden = true; modal.hidden = true; ed.aberto = false; sel = null; };
  return ed;
}
