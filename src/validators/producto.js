const CAMPOS_PERMITIDOS = ['nombre', 'categoria', 'precio', 'stock'];

/**
 * Valida el cuerpo de un producto.
 * @param {object} datos cuerpo recibido
 * @param {{ parcial?: boolean }} opciones si parcial es true, los campos son opcionales (PUT/PATCH)
 * @returns {string[]} lista de errores (vacía si es válido)
 */
function validarProducto(datos, { parcial = false } = {}) {
  const errores = [];

  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
    return ['El cuerpo debe ser un objeto JSON'];
  }

  const presente = (campo) => datos[campo] !== undefined;

  if (!parcial || presente('nombre')) {
    if (typeof datos.nombre !== 'string' || datos.nombre.trim() === '') {
      errores.push('nombre es obligatorio y debe ser un texto no vacío');
    }
  }

  if (!parcial || presente('precio')) {
    if (typeof datos.precio !== 'number' || !Number.isFinite(datos.precio) || datos.precio < 0) {
      errores.push('precio es obligatorio y debe ser un número mayor o igual a 0');
    }
  }

  if (!parcial || presente('stock')) {
    if (!Number.isInteger(datos.stock) || datos.stock < 0) {
      errores.push('stock es obligatorio y debe ser un entero mayor o igual a 0');
    }
  }

  if (presente('categoria') && (typeof datos.categoria !== 'string' || datos.categoria.trim() === '')) {
    errores.push('categoria debe ser un texto no vacío');
  }

  return errores;
}

function filtrarCampos(datos) {
  return Object.fromEntries(Object.entries(datos).filter(([campo]) => CAMPOS_PERMITIDOS.includes(campo)));
}

module.exports = { validarProducto, filtrarCampos };
