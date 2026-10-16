// Endpoints y comportamientos que usa el orquestador (liveness, readiness, apagado) y límites de seguridad.
const { test, describe, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearApp } = require('../../src/app');
const repo = require('../../src/data');
const { enviarJson } = require('./helpers');

let app;
let server;
let baseUrl;
const verificarOriginal = repo.verificarConexion;

before(async () => {
  app = crearApp();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((r) => server.close(r)));
afterEach(() => {
  app.locals.aceptandoTrafico = true;
  repo.verificarConexion = verificarOriginal;
});

describe('GET /health', () => {
  test('informa commit y tipo de almacenamiento para trazabilidad', async () => {
    const cuerpo = await (await fetch(`${baseUrl}/health`)).json();
    assert.equal(cuerpo.commit, 'local');
    assert.equal(cuerpo.almacenamiento, 'memoria');
  });
});

describe('GET /ready', () => {
  test('responde 200 cuando la instancia puede recibir tráfico', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    assert.equal(res.status, 200);
  });

  test('responde 503 durante el apagado ordenado', async () => {
    app.locals.aceptandoTrafico = false;
    const res = await fetch(`${baseUrl}/ready`);
    assert.equal(res.status, 503);
  });

  test('responde 503 si la base de datos no está disponible', async () => {
    repo.verificarConexion = async () => { throw new Error('sin conexión'); };
    const res = await fetch(`${baseUrl}/ready`);
    assert.equal(res.status, 503);
  });
});

describe('seguridad HTTP', () => {
  test('agrega cabeceras de seguridad y oculta la tecnología del servidor', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  test('rechaza cuerpos mayores a 10 KB con 413', async () => {
    const res = await enviarJson(`${baseUrl}/api/productos`, 'POST', { nombre: 'x'.repeat(11 * 1024), precio: 1, stock: 1 });
    assert.equal(res.status, 413);
  });

  test('responde 500 sin exponer detalles si ocurre un error inesperado', async () => {
    const listarOriginal = repo.listar;
    repo.listar = async () => { throw new Error('detalle interno'); };
    const errorOriginal = console.error;
    console.error = () => {};
    try {
      const res = await fetch(`${baseUrl}/api/productos`);
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: 'Error interno del servidor' });
    } finally {
      repo.listar = listarOriginal;
      console.error = errorOriginal;
    }
  });
});
