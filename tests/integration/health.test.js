const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarServidor } = require('./helpers');

let srv;
before(async () => { srv = await iniciarServidor(); });
after(() => srv.cerrar());

test('GET /health responde ok con la versión del servicio', async () => {
  const res = await fetch(`${srv.baseUrl}/health`);
  assert.equal(res.status, 200);
  const cuerpo = await res.json();
  assert.equal(cuerpo.status, 'ok');
  assert.equal(cuerpo.servicio, 'productos-service');
  assert.match(cuerpo.version, /^\d+\.\d+\.\d+$/);
});

test('una ruta inexistente responde 404', async () => {
  const res = await fetch(`${srv.baseUrl}/no-existe`);
  assert.equal(res.status, 404);
});
