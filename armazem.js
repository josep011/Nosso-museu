// Guarda as fotos dos quadros SÓ neste aparelho (IndexedDB do navegador).
// Nada é enviado para internet nem para o GitHub. Ficam até você remover a foto
// ou limpar os dados do site no navegador.
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

export async function todas() { const db = await abrir(); return pedido(loja(db, 'readonly').getAll()); }
export async function salvar(id, blob) { const db = await abrir(); return pedido(loja(db, 'readwrite').put({ id, blob, em: Date.now() })); }
export async function apagar(id) { const db = await abrir(); return pedido(loja(db, 'readwrite').delete(id)); }
