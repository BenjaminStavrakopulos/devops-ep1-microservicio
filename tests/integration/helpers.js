const { crearApp } = require('../../src/app');

// Levanta la app en un puerto aleatorio y devuelve la URL base y una función para cerrarla.
function iniciarServidor() {
  return new Promise((resolve) => {
    const server = crearApp().listen(0, () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        cerrar: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

function enviarJson(url, metodo, cuerpo) {
  return fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

module.exports = { iniciarServidor, enviarJson };
