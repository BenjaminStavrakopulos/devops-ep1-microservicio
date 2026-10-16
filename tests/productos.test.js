const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor, enviarJson } = require('./helpers');
const repo = require('../src/data/productosRepository');

let srv;
before(async () => { srv = await iniciarServidor(); });
after(() => srv.cerrar());
beforeEach(() => repo.reiniciar());

describe('GET /api/productos', () => {
  test('lista los productos iniciales', async () => {
    const res = await fetch(`${srv.baseUrl}/api/productos`);
    assert.equal(res.status, 200);
    const productos = await res.json();
    assert.equal(productos.length, 3);
  });
});

describe('GET /api/productos/:id', () => {
  test('devuelve un producto existente', async () => {
    const res = await fetch(`${srv.baseUrl}/api/productos/1`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).nombre, 'Teclado mecánico');
  });

  test('responde 404 si el producto no existe', async () => {
    const res = await fetch(`${srv.baseUrl}/api/productos/999`);
    assert.equal(res.status, 404);
  });

  test('responde 400 si el id no es válido', async () => {
    const res = await fetch(`${srv.baseUrl}/api/productos/abc`);
    assert.equal(res.status, 400);
  });
});

describe('POST /api/productos', () => {
  test('crea un producto válido', async () => {
    const nuevo = { nombre: 'Audífonos', categoria: 'audio', precio: 29990, stock: 8 };
    const res = await enviarJson(`${srv.baseUrl}/api/productos`, 'POST', nuevo);
    assert.equal(res.status, 201);
    const creado = await res.json();
    assert.equal(creado.id, 4);
    assert.equal(res.headers.get('location'), '/api/productos/4');
    assert.deepEqual({ ...creado, id: undefined }, { ...nuevo, id: undefined });
  });

  test('ignora campos no permitidos', async () => {
    const res = await enviarJson(`${srv.baseUrl}/api/productos`, 'POST', {
      nombre: 'Webcam', precio: 15990, stock: 3, admin: true,
    });
    const creado = await res.json();
    assert.equal(creado.admin, undefined);
    assert.equal(creado.categoria, 'general');
  });

  test('rechaza un producto inválido con 400 y la lista de errores', async () => {
    const res = await enviarJson(`${srv.baseUrl}/api/productos`, 'POST', { nombre: '', precio: -5 });
    assert.equal(res.status, 400);
    const { errores } = await res.json();
    assert.equal(errores.length, 3);
  });

  test('rechaza un JSON mal formado con 400', async () => {
    const res = await enviarJson(`${srv.baseUrl}/api/productos`, 'POST', '{"nombre":');
    assert.equal(res.status, 400);
  });
});
