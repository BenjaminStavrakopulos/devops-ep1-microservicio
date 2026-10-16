const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const repo = require('../../src/data/productosRepository');

beforeEach(() => repo.reiniciar());

describe('productosRepository', () => {
  test('reiniciar restaura los datos iniciales sin compartir referencias', () => {
    repo.listar()[0].nombre = 'modificado';
    repo.reiniciar();
    assert.equal(repo.listar()[0].nombre, 'Teclado mecánico');
  });

  test('crear asigna ids incrementales y categoría por defecto', () => {
    const a = repo.crear({ nombre: 'A', precio: 1, stock: 1 });
    const b = repo.crear({ nombre: 'B', precio: 1, stock: 1, categoria: 'audio' });
    assert.equal(a.id, 4);
    assert.equal(a.categoria, 'general');
    assert.equal(b.id, 5);
    assert.equal(b.categoria, 'audio');
  });

  test('obtenerPorId devuelve undefined si no existe', () => {
    assert.equal(repo.obtenerPorId(999), undefined);
  });

  test('actualizar modifica solo los campos recibidos', () => {
    const producto = repo.actualizar(2, { stock: 0 });
    assert.equal(producto.stock, 0);
    assert.equal(producto.nombre, 'Mouse inalámbrico');
  });

  test('actualizar devuelve undefined si no existe', () => {
    assert.equal(repo.actualizar(999, { stock: 1 }), undefined);
  });

  test('eliminar quita el producto y lo devuelve', () => {
    assert.equal(repo.eliminar(1).id, 1);
    assert.deepEqual(repo.listar().map((p) => p.id), [2, 3]);
  });

  // Caso crítico: regresión del hotfix v1.0.1
  test('eliminar un id inexistente no borra ningún producto', () => {
    assert.equal(repo.eliminar(999), undefined);
    assert.equal(repo.listar().length, 3);
  });

  test('los ids no se reutilizan después de eliminar', () => {
    repo.eliminar(3);
    assert.equal(repo.crear({ nombre: 'X', precio: 1, stock: 1 }).id, 4);
  });
});
