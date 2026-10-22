// Guarda as fotos dos quadros SÓ nos aparelhos de vocês (IndexedDB do navegador).
// Nada vai para o GitHub nem para servidor nenhum. No online, as fotos passam direto de um celular para o outro
// e ficam guardadas nos dois. Cada registro tem a hora da mudança ("em"), para os dois celulares combinarem
// qual é a versão mais nova de cada quadro. Foto removida vira um registro "apagado" (para a remoção valer nos dois).
const BANCO = 'nosso-museu', LOJA = 'fotos';

function abrir() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
  });
}
const pedido = (rq) => new Promise((ok, erro) => { rq.onsuccess = () => ok(rq.result); rq.onerror = () => erro(rq.error); });
const loja = (db, modo) => db.transaction(LOJA, modo).objectStore(LOJA);

export async function todas() { const db = await abrir(); return pedido(loja(db, 'readonly').getAll()); }   // inclui os "apagados"
export async function uma(id) { const db = await abrir(); return pedido(loja(db, 'readonly').get(id)); }
export async function salvar(id, blob, em = Date.now()) { const db = await abrir(); return pedido(loja(db, 'readwrite').put({ id, blob, em })); }
export async function apagar(id, em = Date.now()) { const db = await abrir(); return pedido(loja(db, 'readwrite').put({ id, apagado: true, em })); }
