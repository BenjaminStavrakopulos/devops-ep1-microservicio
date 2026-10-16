const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor, enviarJson } = require('./helpers');
const repo = require('../../src/data/productosRepository');

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

describe('PUT /api/productos/:id', () => {
  test('reemplaza un producto existente', async () => {
    const datos = { nombre: 'Teclado 60%', categoria: 'perifericos', precio: 39990, stock: 4 };
    const res = await enviarJson(`${srv.baseUrl}/api/productos/1`, 'PUT', datos);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { id: 1, ...datos });
  });

  test('exige todos los campos obligatorios', async () => {
    const res = await enviarJson(`${srv.baseUrl}/api/productos/1`, 'PUT', { precio: 100 });
    assert.equal(res.status, 400);
  });

  test('responde 404 si el producto no existe', async () => {
    const res = await enviarJson(`${srv.baseUrl}/api/productos/999`, 'PUT', { nombre: 'X', precio: 1, stock: 1 });
    assert.equal(res.status, 404);
  });
});

describe('PATCH /api/productos/:id', () => {
  test('actualiza solo los campos enviados', async () => {
    const res = await enviarJson(`${srv.baseUrl}/api/productos/2`, 'PATCH', { stock: 0 });
    assert.equal(res.status, 200);
    const producto = await res.json();
    assert.equal(producto.stock, 0);
    assert.equal(producto.nombre, 'Mouse inalámbrico');
  });

  test('valida los campos enviados', async () => {
    const res = await enviarJson(`${srv.baseUrl}/api/productos/2`, 'PATCH', { precio: 'gratis' });
    assert.equal(res.status, 400);
  });
});

describe('DELETE /api/productos/:id', () => {
  test('elimina un producto existente', async () => {
    const res = await fetch(`${srv.baseUrl}/api/productos/3`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    const consulta = await fetch(`${srv.baseUrl}/api/productos/3`);
    assert.equal(consulta.status, 404);
  });

  test('responde 404 y no elimina nada si el producto no existe', async () => {
    const res = await fetch(`${srv.baseUrl}/api/productos/999`, { method: 'DELETE' });
    assert.equal(res.status, 404);
    const listado = await (await fetch(`${srv.baseUrl}/api/productos`)).json();
    assert.deepEqual(listado.map((p) => p.id), [1, 2, 3]);
  });
});
