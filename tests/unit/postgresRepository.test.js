// Prueba el repositorio PostgreSQL contra una base emulada en memoria (pg-mem),
// así no se necesita un servidor de base de datos para ejecutar las pruebas.
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { newDb, DataType } = require('pg-mem');
const { crearRepositorioPostgres } = require('../../src/data/postgresRepository');

let repo;
let pool;

function crearBaseEmulada() {
  // pg-mem no implementa los advisory locks: se registran como funciones vacías
  const db = newDb({ noAstCoverageCheck: true });
  for (const name of ['pg_advisory_lock', 'pg_advisory_unlock']) {
    db.public.registerFunction({ name, args: [DataType.integer], returns: DataType.text, implementation: () => '' });
  }
  return db;
}

beforeEach(async () => {
  const { Pool } = crearBaseEmulada().adapters.createPg();
  pool = new Pool();
  repo = crearRepositorioPostgres(pool);
  await repo.inicializar();
});

describe('postgresRepository', () => {
  test('inicializar crea la tabla y carga los productos iniciales', async () => {
    const productos = await repo.listar();
    assert.deepEqual(productos.map((p) => p.id), [1, 2, 3]);
    assert.equal(typeof productos[0].precio, 'number');
  });

  test('inicializar no duplica los datos si se ejecuta de nuevo (varias réplicas)', async () => {
    await repo.inicializar();
    assert.equal((await repo.listar()).length, 3);
  });

  test('crear inserta y devuelve el producto con id y categoría por defecto', async () => {
    const creado = await repo.crear({ nombre: 'Audífonos', precio: 29990, stock: 4 });
    assert.deepEqual(creado, { id: 4, nombre: 'Audífonos', categoria: 'general', precio: 29990, stock: 4 });
    assert.deepEqual(await repo.obtenerPorId(4), creado);
  });

  test('obtenerPorId devuelve undefined si no existe', async () => {
    assert.equal(await repo.obtenerPorId(999), undefined);
  });

  test('actualizar combina los campos recibidos con los actuales', async () => {
    const actualizado = await repo.actualizar(2, { stock: 0 });
    assert.equal(actualizado.stock, 0);
    assert.equal(actualizado.nombre, 'Mouse inalámbrico');
  });

  test('actualizar devuelve undefined si no existe', async () => {
    assert.equal(await repo.actualizar(999, { stock: 1 }), undefined);
  });

  test('eliminar devuelve el producto eliminado', async () => {
    assert.equal((await repo.eliminar(1)).id, 1);
    assert.deepEqual((await repo.listar()).map((p) => p.id), [2, 3]);
  });

  test('eliminar un id inexistente no borra nada (regresión hotfix v1.0.1)', async () => {
    assert.equal(await repo.eliminar(999), undefined);
    assert.equal((await repo.listar()).length, 3);
  });

  test('la base de datos rechaza precios negativos aunque falle la validación de la API', async () => {
    await assert.rejects(repo.crear({ nombre: 'X', precio: -1, stock: 1 }));
  });

  test('verificarConexion responde true con la base disponible', async () => {
    assert.equal(await repo.verificarConexion(), true);
  });

  test('cerrar termina el pool de conexiones', async (t) => {
    const end = t.mock.method(pool, 'end', async () => {});
    await repo.cerrar();
    assert.equal(end.mock.callCount(), 1);
  });

  test('inicializar libera el lock aunque falle la creación del esquema', async (t) => {
    const consultas = [];
    const cliente = {
      query: async (sql) => {
        consultas.push(sql);
        if (sql.includes('CREATE TABLE')) throw new Error('fallo simulado');
        return { rows: [] };
      },
      release: t.mock.fn(),
    };
    const repoConFallo = crearRepositorioPostgres({ connect: async () => cliente });
    await assert.rejects(repoConFallo.inicializar(), /fallo simulado/);
    assert.ok(consultas.at(-1).includes('pg_advisory_unlock'));
    assert.equal(cliente.release.mock.callCount(), 1);
  });
});
