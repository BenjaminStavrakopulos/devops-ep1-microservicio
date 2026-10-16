const CAMPOS_ORDENABLES = ['nombre', 'precio', 'stock'];

/**
 * Interpreta los query params del listado de productos.
 * Soporta: categoria, q (búsqueda por nombre), precioMin, precioMax y ordenar (ej. "precio" o "-precio").
 * @returns {{ filtros?: object, errores: string[] }}
 */
function parsearFiltros(query) {
  const errores = [];
  const filtros = {};

  if (query.categoria !== undefined) filtros.categoria = String(query.categoria).toLowerCase();
  if (query.q !== undefined) filtros.q = String(query.q).toLowerCase();

  for (const campo of ['precioMin', 'precioMax']) {
    if (query[campo] === undefined) continue;
    const valor = Number(query[campo]);
    if (query[campo] === '' || !Number.isFinite(valor) || valor < 0) {
      errores.push(`${campo} debe ser un número mayor o igual a 0`);
    } else {
      filtros[campo] = valor;
    }
  }

  if (filtros.precioMin !== undefined && filtros.precioMax !== undefined && filtros.precioMin > filtros.precioMax) {
    errores.push('precioMin no puede ser mayor que precioMax');
  }

  if (query.ordenar !== undefined) {
    const descendente = String(query.ordenar).startsWith('-');
    const campo = String(query.ordenar).replace(/^-/, '');
    if (!CAMPOS_ORDENABLES.includes(campo)) {
      errores.push(`ordenar debe ser uno de: ${CAMPOS_ORDENABLES.join(', ')} (prefijo "-" para descendente)`);
    } else {
      filtros.ordenar = { campo, descendente };
    }
  }

  return errores.length > 0 ? { errores } : { filtros, errores };
}

function aplicarFiltros(productos, filtros) {
  let resultado = productos.filter((p) =>
    (filtros.categoria === undefined || p.categoria.toLowerCase() === filtros.categoria)
    && (filtros.q === undefined || p.nombre.toLowerCase().includes(filtros.q))
    && (filtros.precioMin === undefined || p.precio >= filtros.precioMin)
    && (filtros.precioMax === undefined || p.precio <= filtros.precioMax));

  if (filtros.ordenar) {
    const { campo, descendente } = filtros.ordenar;
    const signo = descendente ? -1 : 1;
    resultado = [...resultado].sort((a, b) =>
      (typeof a[campo] === 'string' ? a[campo].localeCompare(b[campo]) : a[campo] - b[campo]) * signo);
  }

  return resultado;
}

module.exports = { parsearFiltros, aplicarFiltros };
