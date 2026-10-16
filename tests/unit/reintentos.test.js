const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { conReintentos } = require('../../src/reintentos');

describe('conReintentos', () => {
  test('devuelve el resultado si la operación funciona al primer intento', async () => {
    assert.equal(await conReintentos(async () => 'ok'), 'ok');
  });

  test('reintenta hasta que la operación funciona', async () => {
    let llamadas = 0;
    const fallos = [];
    const resultado = await conReintentos(async () => {
      llamadas++;
      if (llamadas < 3) throw new Error(`fallo ${llamadas}`);
      return 'conectado';
    }, { esperaInicialMs: 1, alFallar: (error, intento) => fallos.push(intento) });
    assert.equal(resultado, 'conectado');
    assert.equal(llamadas, 3);
    assert.deepEqual(fallos, [1, 2]);
  });

  test('lanza el último error al agotar los intentos', async () => {
    let llamadas = 0;
    await assert.rejects(
      conReintentos(async () => { llamadas++; throw new Error('base de datos no disponible'); }, { intentos: 3, esperaInicialMs: 1 }),
      /base de datos no disponible/,
    );
    assert.equal(llamadas, 3);
  });

  test('la espera crece de forma exponencial con un máximo', async (t) => {
    const esperas = [];
    t.mock.method(global, 'setTimeout', (fn, ms) => { esperas.push(ms); fn(); });
    await assert.rejects(conReintentos(async () => { throw new Error('x'); }, {
      intentos: 5, esperaInicialMs: 100, esperaMaximaMs: 500,
    }));
    assert.deepEqual(esperas, [100, 200, 400, 500]);
  });
});
