const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validarProducto, filtrarCampos } = require('../../src/validators/producto');

const VALIDO = { nombre: 'Teclado', categoria: 'perifericos', precio: 1000, stock: 5 };

describe('validarProducto (creación / reemplazo)', () => {
  test('acepta un producto completo y válido', () => {
    assert.deepEqual(validarProducto(VALIDO), []);
  });

  test('acepta precio 0 y stock 0 (valores límite)', () => {
    assert.deepEqual(validarProducto({ ...VALIDO, precio: 0, stock: 0 }), []);
  });

  test('categoria es opcional', () => {
    const sinCategoria = { ...VALIDO };
    delete sinCategoria.categoria;
    assert.deepEqual(validarProducto(sinCategoria), []);
  });

  for (const cuerpo of [null, [], 'texto', 42]) {
    test(`rechaza un cuerpo que no es objeto: ${JSON.stringify(cuerpo)}`, () => {
      assert.deepEqual(validarProducto(cuerpo), ['El cuerpo debe ser un objeto JSON']);
    });
  }

  const casosInvalidos = [
    ['nombre vacío', { nombre: '' }, /nombre/],
    ['nombre solo espacios', { nombre: '   ' }, /nombre/],
    ['nombre numérico', { nombre: 123 }, /nombre/],
    ['precio negativo', { precio: -1 }, /precio/],
    ['precio como texto', { precio: '1000' }, /precio/],
    ['precio infinito', { precio: Infinity }, /precio/],
    ['precio NaN', { precio: NaN }, /precio/],
    ['stock decimal', { stock: 1.5 }, /stock/],
    ['stock negativo', { stock: -3 }, /stock/],
    ['categoria vacía', { categoria: '' }, /categoria/],
    ['categoria numérica', { categoria: 7 }, /categoria/],
  ];

  for (const [descripcion, cambio, patron] of casosInvalidos) {
    test(`rechaza ${descripcion}`, () => {
      const errores = validarProducto({ ...VALIDO, ...cambio });
      assert.equal(errores.length, 1);
      assert.match(errores[0], patron);
    });
  }

  test('reporta todos los campos obligatorios faltantes a la vez', () => {
    assert.equal(validarProducto({}).length, 3);
  });
});

describe('validarProducto (actualización parcial)', () => {
  test('acepta un cuerpo vacío', () => {
    assert.deepEqual(validarProducto({}, { parcial: true }), []);
  });

  test('valida solo los campos presentes', () => {
    assert.deepEqual(validarProducto({ stock: 10 }, { parcial: true }), []);
    assert.equal(validarProducto({ stock: -1 }, { parcial: true }).length, 1);
  });
});

describe('filtrarCampos', () => {
  test('elimina campos no permitidos como id o propiedades extra', () => {
    assert.deepEqual(filtrarCampos({ ...VALIDO, id: 99, admin: true }), VALIDO);
  });

  test('no agrega campos que no venían', () => {
    assert.deepEqual(filtrarCampos({ stock: 1 }), { stock: 1 });
  });
});
