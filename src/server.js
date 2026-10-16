const { crearApp } = require('./app');
const repo = require('./data');
const { conReintentos } = require('./reintentos');

const PORT = Number(process.env.PORT) || 3000;
// Kubernetes espera 30 s por defecto (terminationGracePeriodSeconds) antes de forzar el cierre
const TIEMPO_MAXIMO_APAGADO_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10000;

async function iniciar() {
  await conReintentos(() => repo.inicializar(), {
    alFallar: (error, intento) => console.warn(`Base de datos no disponible (intento ${intento}): ${error.message}`),
  });
  const app = crearApp();
  const server = app.listen(PORT, () => {
    console.log(`productos-service escuchando en el puerto ${PORT} (almacenamiento: ${repo.tipo})`);
  });

  // Apagado ordenado: deja de aceptar tráfico, termina las peticiones en curso y cierra la base de datos.
  // Evita errores durante los rolling updates y el escalado hacia abajo.
  let apagando = false;
  const apagar = (senal) => {
    if (apagando) return;
    apagando = true;
    console.log(`${senal} recibido, iniciando apagado ordenado`);
    app.locals.aceptandoTrafico = false;
    setTimeout(() => {
      console.error('Tiempo de apagado excedido, forzando salida');
      process.exit(1);
    }, TIEMPO_MAXIMO_APAGADO_MS).unref();
    server.close(async () => {
      await repo.cerrar();
      console.log('Apagado completo');
      process.exit(0);
    });
  };
  process.on('SIGTERM', apagar);
  process.on('SIGINT', apagar);
}

iniciar().catch((err) => {
  console.error('No se pudo iniciar el servicio:', err);
  process.exit(1);
});
