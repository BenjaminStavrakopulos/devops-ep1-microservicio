// Repositorio persistente en PostgreSQL. Permite ejecutar varias réplicas del servicio
// compartiendo el mismo estado (las réplicas quedan sin estado propio).
const PRODUCTOS_INICIALES = [
  ['Teclado mecánico', 'perifericos', 45990, 12],
  ['Mouse inalámbrico', 'perifericos', 19990, 30],
  ['Monitor 27"', 'monitores', 189990, 5],
];

const COLUMNAS = 'id, nombre, categoria, precio, stock';
// Identificador arbitrario del lock que serializa la inicialización entre réplicas
const LOCK_INICIALIZACION = 727001;

// NUMERIC llega como texto desde el driver de pg; se convierte para mantener el mismo contrato que el repositorio en memoria
function mapear(fila) {
  return fila && { ...fila, precio: Number(fila.precio) };
}

/**
 * @param {import('pg').Pool} pool conexión a la base de datos (se inyecta para poder probarlo)
 */
function crearRepositorioPostgres(pool) {
  // Varias réplicas arrancan a la vez: el advisory lock garantiza que solo una crea la tabla y carga los datos iniciales
  async function inicializar() {
    const cliente = await pool.connect();
    try {
      await cliente.query('SELECT pg_advisory_lock($1)', [LOCK_INICIALIZACION]);
      await crearEsquemaYDatos(cliente);
    } finally {
      await cliente.query('SELECT pg_advisory_unlock($1)', [LOCK_INICIALIZACION]);
      cliente.release();
    }
  }

  async function crearEsquemaYDatos(cliente) {
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id        SERIAL PRIMARY KEY,
        nombre    TEXT NOT NULL,
        categoria TEXT NOT NULL DEFAULT 'general',
        precio    NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
        stock     INTEGER NOT NULL CHECK (stock >= 0)
      )`);
    const { rows } = await cliente.query('SELECT COUNT(*)::int AS total FROM productos');
    if (rows[0].total === 0) {
      for (const valores of PRODUCTOS_INICIALES) {
        await cliente.query('INSERT INTO productos (nombre, categoria, precio, stock) VALUES ($1, $2, $3, $4)', valores);
      }
    }
  }

  async function listar() {
    const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM productos ORDER BY id`);
    return rows.map(mapear);
  }

  async function obtenerPorId(id) {
    const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM productos WHERE id = $1`, [id]);
    return mapear(rows[0]);
  }

  async function crear({ nombre, categoria = 'general', precio, stock }) {
    const { rows } = await pool.query(
      `INSERT INTO productos (nombre, categoria, precio, stock) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
      [nombre, categoria, precio, stock],
    );
    return mapear(rows[0]);
  }

  async function actualizar(id, datos) {
    const actual = await obtenerPorId(id);
    if (!actual) return undefined;
    const { nombre, categoria, precio, stock } = { ...actual, ...datos };
    const { rows } = await pool.query(
      `UPDATE productos SET nombre = $2, categoria = $3, precio = $4, stock = $5 WHERE id = $1 RETURNING ${COLUMNAS}`,
      [id, nombre, categoria, precio, stock],
    );
    return mapear(rows[0]);
  }

  async function eliminar(id) {
    const { rows } = await pool.query(`DELETE FROM productos WHERE id = $1 RETURNING ${COLUMNAS}`, [id]);
    return mapear(rows[0]);
  }

  async function verificarConexion() {
    await pool.query('SELECT 1');
    return true;
  }

  function cerrar() {
    return pool.end();
  }

  return { tipo: 'postgres', inicializar, listar, obtenerPorId, crear, actualizar, eliminar, verificarConexion, cerrar };
}

module.exports = { crearRepositorioPostgres };
