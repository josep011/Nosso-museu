// Online para dois: conexão DIRETA entre os dois celulares (WebRTC), sem servidor pago.
// Para os dois se acharem, usamos uma "caixa de recados" pública e gratuita (ntfy.sh) só no começo:
// um deixa o convite, o outro responde, e pronto — a partir daí o jogo vai direto de um celular para o outro.
// O que passa: posição, gestos, emoções, assentos e carinhos dos gatinhos. Fotos NÃO passam.
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const pSinal = new URLSearchParams(location.search).get('sinal');
const SINAL = LOCAL && pSinal ? pSinal : 'https://ntfy.sh';     // trocar o servidor só é permitido em testes locais
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const novoCodigo = () => { const a = new Uint32Array(8); crypto.getRandomValues(a); return [...a].map((n) => ALFABETO[n % ALFABETO.length]).join(''); };
export const codigoValido = (c) => typeof c === 'string' && /^[A-Z2-9]{8}$/.test(c);
const topico = (c) => `nossomuseu-${c}`;
const idAleatorio = () => novoCodigo().toLowerCase();

// SDP (o "endereço" da conexão) vai comprimido para caber num recado
async function empacotar(txt) {
  if (!('CompressionStream' in window)) return 'p:' + btoa(unescape(encodeURIComponent(txt)));
  const buf = await new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return 'z:' + btoa(s);
}
async function desempacotar(p) {
  if (typeof p !== 'string' || p.length > 6000) throw new Error('recado inválido');
  const bin = atob(p.slice(2));
  if (p.startsWith('p:')) return decodeURIComponent(escape(bin));
  const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
}
function esperarIce(pc, ms = 3000) {      // junta os caminhos possíveis antes de mandar o convite (um recado só)
  return new Promise((ok) => {
    if (pc.iceGatheringState === 'complete') return ok();
    const fim = () => { pc.removeEventListener('icegatheringstatechange', ver); clearTimeout(t); ok(); };
    const ver = () => { if (pc.iceGatheringState === 'complete') fim(); };
    pc.addEventListener('icegatheringstatechange', ver); const t = setTimeout(fim, ms);
  });
}

export function criarOnline({ aoAbrir, aoMensagem, aoFechar, aoStatus }) {
  let tUltimo = 0, tPulso = 0, tentativas = 0, tRetorno = 0;
  let pc = null, dc = null, fonte = null, nOferta = '', tOferta = 0, codigo = null, papel = null, eu = idAleatorio(), parceiro = null, tOi = 0, ativo = false;
  const status = (s) => aoStatus && aoStatus(s);
  const publicar = (obj) => fetch(`${SINAL}/${topico(codigo)}`, { method: 'POST', body: JSON.stringify(obj) }).catch(() => status('erro-rede'));

  function ouvir() {
    fecharFonte();
    fonte = new EventSource(`${SINAL}/${topico(codigo)}/sse?since=90s`);
    fonte.onmessage = async (ev) => {
      let m; try { const d = JSON.parse(ev.data); if (d.event && d.event !== 'message') return; m = JSON.parse(d.message); } catch { return; }
      if (!m || typeof m !== 'object' || m.de === eu || typeof m.de !== 'string' || m.de.length > 16) return;
      try {
        if (papel === 'anfitriao' && m.tipo === 'oi' && !(dc && dc.readyState === 'open') && (m.de !== parceiro || Date.now() - tOferta > 15000)) await oferecer(m.de);
        else if (papel === 'anfitriao' && m.tipo === 'resposta' && m.para === eu && m.de === parceiro && m.n === nOferta && pc && !pc.currentRemoteDescription)
          await pc.setRemoteDescription({ type: 'answer', sdp: await desempacotar(m.sdp) });
        else if (papel === 'convidado' && m.tipo === 'oferta' && m.para === eu && m.n !== nOferta && !(dc && dc.readyState === 'open')) await responder(m);
      } catch (e) { console.warn('online: recado ignorado', e); }
    };
    fonte.onerror = () => status('reconectando-recados');
  }
  function fecharFonte() { if (fonte) { fonte.close(); fonte = null; } }

  function prepararCanal(canal) {
    dc = canal;
    canal.onopen = () => {
      if (canal !== dc) return;
      clearInterval(tOi); fecharFonte(); tentativas = 0; tUltimo = Date.now(); status('conectado'); aoAbrir && aoAbrir(papel);
      clearInterval(tPulso);
      tPulso = setInterval(() => {                     // "ainda está aí?": sem notícias por 15 s = caiu
        if (!dc || dc.readyState !== 'open') return clearInterval(tPulso);
        try { dc.send('{"t":"p"}'); } catch { /* ok */ }
        if (Date.now() - tUltimo > 15000) caiu();
      }, 1500);
    };
    canal.onmessage = (ev) => {
      if (canal !== dc) return;
      tUltimo = Date.now();
      if (typeof ev.data !== 'string' || ev.data.length > 2000) return;          // recados do outro celular: pequenos e em texto
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m && typeof m === 'object' && m.t !== 'p') aoMensagem(m);
    };
    canal.onclose = () => { if (canal === dc) caiu(); };      // só o canal atual conta
  }
  function novaConexao() {
    if (dc) { dc.onclose = dc.onmessage = dc.onopen = null; try { dc.close(); } catch { /* ok */ } dc = null; }
    if (pc) pc.close();
    pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onconnectionstatechange = () => { if (pc && pc.connectionState === 'failed') status('falhou'); };
    return pc;
  }
  async function oferecer(quem) {
    parceiro = quem; status('conectando'); nOferta = idAleatorio(); tOferta = Date.now();
    const c = novaConexao(); prepararCanal(c.createDataChannel('jogo'));
    await c.setLocalDescription(await c.createOffer()); await esperarIce(c);
    publicar({ tipo: 'oferta', de: eu, para: quem, n: nOferta, sdp: await empacotar(c.localDescription.sdp) });
  }
  async function responder(m) {
    parceiro = m.de; status('conectando'); nOferta = typeof m.n === 'string' ? m.n : '';
    const c = novaConexao(); c.ondatachannel = (ev) => prepararCanal(ev.channel);
    await c.setRemoteDescription({ type: 'offer', sdp: await desempacotar(m.sdp) });
    await c.setLocalDescription(await c.createAnswer()); await esperarIce(c);
    publicar({ tipo: 'resposta', de: eu, para: parceiro, n: nOferta, sdp: await empacotar(c.localDescription.sdp) });
  }
  function caiu() {
    if (!dc && !pc) return;
    clearInterval(tPulso); const canal = dc; dc = null; if (canal) { canal.onclose = null; try { canal.close(); } catch { /* ok */ } }
    if (!ativo) return;
    status('desconectado'); aoFechar && aoFechar();
    if (papel === 'anfitriao') reabrir();
    else if (++tentativas <= 5) { status('procurando'); clearTimeout(tRetorno); tRetorno = setTimeout(() => { if (ativo && papel === 'convidado') api.entrar(codigo, true); }, 2000); }
  }
  function reabrir() { if (pc) { pc.close(); pc = null; } parceiro = null; status('esperando'); ouvir(); }

  const api = {
    criarSala() { this.sair(); ativo = true; papel = 'anfitriao'; codigo = novoCodigo(); eu = idAleatorio(); status('esperando'); ouvir(); return codigo; },
    entrar(c, retomando = false) {
      if (!codigoValido(c)) return false;
      const n0 = tentativas; this.sair(); if (retomando) tentativas = n0; ativo = true; papel = 'convidado'; codigo = c; eu = idAleatorio(); status('procurando'); ouvir();
      let n = 0; const oi = () => { if (++n > 12 || (dc && dc.readyState === 'open') || pc) { clearInterval(tOi); return; } publicar({ tipo: 'oi', de: eu }); };
      setTimeout(oi, 400); tOi = setInterval(oi, 5000); return true;
    },
    enviar(obj) { if (dc && dc.readyState === 'open') { try { dc.send(JSON.stringify(obj)); } catch { /* canal fechando */ } } },
    conectado: () => !!(dc && dc.readyState === 'open'),
    papel: () => papel, codigo: () => codigo, ativo: () => ativo,
    sair() { ativo = false; clearInterval(tOi); clearInterval(tPulso); clearTimeout(tRetorno); fecharFonte(); if (dc) { try { dc.close(); } catch { /* ok */ } } dc = null; if (pc) pc.close(); pc = null; parceiro = null; papel = null; },
  };
  return api;
}
