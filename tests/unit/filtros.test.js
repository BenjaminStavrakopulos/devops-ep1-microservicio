const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parsearFiltros, aplicarFiltros } = require('../../src/filtros/productos');

const PRODUCTOS = [
  { id: 1, nombre: 'Teclado', categoria: 'perifericos', precio: 300, stock: 2 },
  { id: 2, nombre: 'Mouse', categoria: 'Perifericos', precio: 100, stock: 9 },
  { id: 3, nombre: 'Monitor', categoria: 'monitores', precio: 900, stock: 1 },
];

describe('parsearFiltros', () => {
  test('sin parámetros devuelve filtros vacíos', () => {
    assert.deepEqual(parsearFiltros({}), { filtros: {}, errores: [] });
  });

  test('normaliza categoria y q a minúsculas', () => {
    const { filtros } = parsearFiltros({ categoria: 'AUDIO', q: 'Tec' });
    assert.deepEqual(filtros, { categoria: 'audio', q: 'tec' });
  });

  test('convierte precios a número', () => {
    const { filtros } = parsearFiltros({ precioMin: '10', precioMax: '20.5' });
    assert.equal(filtros.precioMin, 10);
    assert.equal(filtros.precioMax, 20.5);
  });

  test('interpreta el prefijo "-" como orden descendente', () => {
    assert.deepEqual(parsearFiltros({ ordenar: '-stock' }).filtros.ordenar, { campo: 'stock', descendente: true });
    assert.deepEqual(parsearFiltros({ ordenar: 'nombre' }).filtros.ordenar, { campo: 'nombre', descendente: false });
  });

  for (const [query, patron] of [
    [{ precioMin: 'abc' }, /precioMin/],
    [{ precioMax: '' }, /precioMax/],
    [{ precioMin: '-1' }, /precioMin/],
    [{ precioMin: '50', precioMax: '10' }, /mayor que/],
    [{ ordenar: 'categoria' }, /ordenar/],
  ]) {
    test(`rechaza ${JSON.stringify(query)}`, () => {
      const resultado = parsearFiltros(query);
      assert.equal(resultado.filtros, undefined);
      assert.match(resultado.errores[0], patron);
    });
  }
});

describe('aplicarFiltros', () => {
  test('sin filtros devuelve todos los productos en el orden original', () => {
    assert.deepEqual(aplicarFiltros(PRODUCTOS, {}).map((p) => p.id), [1, 2, 3]);
  });

  test('categoria no distingue mayúsculas', () => {
    assert.deepEqual(aplicarFiltros(PRODUCTOS, { categoria: 'perifericos' }).map((p) => p.id), [1, 2]);
  });

  test('el rango de precio incluye los límites', () => {
    assert.deepEqual(aplicarFiltros(PRODUCTOS, { precioMin: 100, precioMax: 300 }).map((p) => p.id), [1, 2]);
  });

  test('ordena números y textos', () => {
    const porStock = aplicarFiltros(PRODUCTOS, { ordenar: { campo: 'stock', descendente: true } });
    assert.deepEqual(porStock.map((p) => p.id), [2, 1, 3]);
    const porNombre = aplicarFiltros(PRODUCTOS, { ordenar: { campo: 'nombre', descendente: false } });
    assert.deepEqual(porNombre.map((p) => p.nombre), ['Monitor', 'Mouse', 'Teclado']);
  });

  test('no modifica el arreglo original al ordenar', () => {
    const copia = PRODUCTOS.map((p) => p.id);
    aplicarFiltros(PRODUCTOS, { ordenar: { campo: 'precio', descendente: true } });
    assert.deepEqual(PRODUCTOS.map((p) => p.id), copia);
  });

  test('devuelve una lista vacía si nada coincide', () => {
    assert.deepEqual(aplicarFiltros(PRODUCTOS, { q: 'parlante' }), []);
  });
});
