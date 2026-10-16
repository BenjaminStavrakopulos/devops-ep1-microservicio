// Selecciona el repositorio según el entorno:
//   - DATABASE_URL definida -> PostgreSQL (staging / production / docker compose / kubernetes)
//   - sin DATABASE_URL      -> memoria (desarrollo local y pruebas)
const memoria = require('./productosRepository');

function crearRepositorio() {
  if (!process.env.DATABASE_URL) return memoria;

  const { Pool } = require('pg');
  const { crearRepositorioPostgres } = require('./postgresRepository');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return crearRepositorioPostgres(pool);
}

module.exports = crearRepositorio();
