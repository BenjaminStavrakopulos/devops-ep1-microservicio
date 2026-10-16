/**
 * Ejecuta una operación asíncrona reintentando con espera exponencial.
 * En un orquestador los contenedores arrancan en cualquier orden: la API puede iniciar antes que la base de datos.
 * @param {() => Promise<T>} operacion
 * @param {{ intentos?: number, esperaInicialMs?: number, esperaMaximaMs?: number, alFallar?: (error: Error, intento: number) => void }} opciones
 * @returns {Promise<T>}
 * @template T
 */
async function conReintentos(operacion, { intentos = 10, esperaInicialMs = 500, esperaMaximaMs = 5000, alFallar = () => {} } = {}) {
  for (let intento = 1; ; intento++) {
    try {
      return await operacion();
    } catch (error) {
      if (intento >= intentos) throw error;
      alFallar(error, intento);
      const espera = Math.min(esperaInicialMs * 2 ** (intento - 1), esperaMaximaMs);
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
  }
}

module.exports = { conReintentos };
