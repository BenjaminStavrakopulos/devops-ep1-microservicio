const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor } = require('./helpers');
const repo = require('../src/data/productosRepository');

let srv;
before(async () => { srv = await iniciarServidor(); });
after(() => srv.cerrar());
beforeEach(() => repo.reiniciar());

async function listar(query) {
  const res = await fetch(`${srv.baseUrl}/api/productos?${query}`);
  return { status: res.status, cuerpo: await res.json() };
}

describe('GET /api/productos con filtros', () => {
  test('filtra por categoría sin distinguir mayúsculas', async () => {
    const { status, cuerpo } = await listar('categoria=PERIFERICOS');
    assert.equal(status, 200);
    assert.deepEqual(cuerpo.map((p) => p.id), [1, 2]);
  });

  test('busca por texto en el nombre', async () => {
    const { cuerpo } = await listar('q=monitor');
    assert.deepEqual(cuerpo.map((p) => p.id), [3]);
  });

  test('filtra por rango de precio', async () => {
    const { cuerpo } = await listar('precioMin=20000&precioMax=200000');
    assert.deepEqual(cuerpo.map((p) => p.id), [1, 3]);
  });

  test('ordena por precio descendente', async () => {
    const { cuerpo } = await listar('ordenar=-precio');
    assert.deepEqual(cuerpo.map((p) => p.id), [3, 1, 2]);
  });

  test('ordena por nombre ascendente', async () => {
    const { cuerpo } = await listar('ordenar=nombre');
    assert.deepEqual(cuerpo.map((p) => p.nombre), ['Monitor 27"', 'Mouse inalámbrico', 'Teclado mecánico']);
  });

  test('combina filtros', async () => {
    const { cuerpo } = await listar('categoria=perifericos&ordenar=precio');
    assert.deepEqual(cuerpo.map((p) => p.id), [2, 1]);
  });

  test('rechaza parámetros inválidos con 400', async () => {
    for (const query of ['precioMin=abc', 'precioMin=10&precioMax=5', 'ordenar=color']) {
      const { status } = await listar(query);
      assert.equal(status, 400, `se esperaba 400 para ${query}`);
    }
  });
});
