const os = require('node:os');
const express = require('express');
const helmet = require('helmet');
const productosRouter = require('./routes/productos');
const repo = require('./data');
const { version } = require('../package.json');

function crearApp() {
  const app = express();
  // Lo cambia server.js a false al recibir SIGTERM, para que el orquestador deje de enviar tráfico
  app.locals.aceptandoTrafico = true;

  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));

  // Liveness: el proceso está vivo (no consulta dependencias para evitar reinicios en cascada)
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      servicio: 'productos-service',
      version,
      commit: process.env.GIT_SHA || 'local',
      // Nombre del pod/contenedor que respondió: permite verificar el balanceo entre réplicas
      instancia: os.hostname(),
      almacenamiento: repo.tipo,
    });
  });

  // Readiness: la instancia puede recibir tráfico (base de datos disponible y no se está apagando)
  app.get('/ready', async (req, res) => {
    if (!app.locals.aceptandoTrafico) {
      return res.status(503).json({ status: 'apagando' });
    }
    try {
      await repo.verificarConexion();
      res.json({ status: 'listo' });
    } catch {
      res.status(503).json({ status: 'sin conexión a la base de datos' });
    }
  });

  app.use('/api/productos', productosRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Recurso no encontrado' });
  });

  // Manejador de errores centralizado (Express exige los 4 argumentos)
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El cuerpo de la petición supera el tamaño permitido' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { crearApp };
